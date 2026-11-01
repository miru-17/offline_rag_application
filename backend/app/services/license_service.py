"""
Signed offline licences.

A licence file is issued by the vendor with a private Ed25519 key that never
leaves the vendor's machine. The product only holds the matching PUBLIC key,
so it can check a licence but cannot create one. Editing the database or the
licence file breaks the signature, and the licence is rejected.

Licence file (JSON):
    {
      "format": "ragentis-license-v1",
      "kid": "<id of the signing key, optional>",
      "payload": "<base64url of the JSON payload>",
      "signature": "<base64url Ed25519 signature of the payload bytes>"
    }

Payload fields:
    license_id, product, customer, issued_at, not_before, expires_at,
    max_users, features (list, "*" = all), grace_days,
    installation_id (optional: the licence works only on that installation)

Several public keys can be trusted at once (key rotation): the main key plus
every .pem in LICENSE_KEYS_DIR.

After expiry (and the grace period) the system is READ-ONLY: people can still
open, search their history and export their data, but uploads, questions and
other new work are paused until a renewed licence is installed.
"""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, load_pem_public_key
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import LICENSE_KEYS_DIR, LICENSE_PUBLIC_KEY_PATH, LICENSE_WARNING_DAYS, PRODUCT_NAME
from app.models.installation import Installation
from app.models.license import License

LICENSE_FORMAT = "ragentis-license-v1"

ALL_FEATURES = {
    "chat",
    "documents",
    "analytics",
    "extraction",
    "compare",
    "groups",
    "insights",
    "api",
}

# Tolerated backwards clock movement before the licence is suspended.
CLOCK_TOLERANCE = timedelta(hours=24)


class LicenseError(ValueError):
    """The licence file is malformed, forged or not for this product."""


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def key_id(public_key: Ed25519PublicKey) -> str:
    """Short, stable ID of a public key (first 16 hex of SHA-256 of the raw key)."""
    raw = public_key.public_bytes(Encoding.Raw, PublicFormat.Raw)
    return hashlib.sha256(raw).hexdigest()[:16]


def _read_key(path) -> Ed25519PublicKey | None:
    try:
        key = load_pem_public_key(path.read_bytes())
    except (OSError, ValueError):
        return None
    return key if isinstance(key, Ed25519PublicKey) else None


@lru_cache(maxsize=1)
def trusted_keys() -> dict[str, Ed25519PublicKey]:
    """All public keys this server accepts, by key ID."""
    keys: dict[str, Ed25519PublicKey] = {}
    candidates = [LICENSE_PUBLIC_KEY_PATH]
    if LICENSE_KEYS_DIR.is_dir():
        candidates += sorted(LICENSE_KEYS_DIR.glob("*.pem"))
    for path in candidates:
        key = _read_key(path)
        if key is not None:
            keys[key_id(key)] = key
    return keys


def _load_public_key() -> Ed25519PublicKey | None:
    """Kept for older callers: the main key (or any trusted key)."""
    keys = trusted_keys()
    main = _read_key(LICENSE_PUBLIC_KEY_PATH)
    return main or (next(iter(keys.values())) if keys else None)


@lru_cache(maxsize=32)
def verify_license_text(license_text: str) -> dict:
    """Return the verified payload, or raise LicenseError."""

    keys = trusted_keys()
    if not keys:
        raise LicenseError(
            "No licence public key is installed on this server."
        )

    try:
        envelope = json.loads(license_text)
        if envelope.get("format") != LICENSE_FORMAT:
            raise LicenseError("Unknown licence format.")
        payload_bytes = _b64decode(envelope["payload"])
        signature = _b64decode(envelope["signature"])
        kid = envelope.get("kid")
    except LicenseError:
        raise
    except (ValueError, KeyError, TypeError, AttributeError):
        raise LicenseError("The licence file is not valid.")

    if kid is not None:
        if kid not in keys:
            raise LicenseError("This licence was signed with a key this server does not trust "
                               "(retired or unknown). Ask the vendor for a new licence.")
        candidates = [keys[kid]]
    else:
        candidates = list(keys.values())
    for public_key in candidates:
        try:
            public_key.verify(signature, payload_bytes)
            break
        except InvalidSignature:
            continue
    else:
        raise LicenseError("The licence signature is not valid.")

    try:
        payload = json.loads(payload_bytes)
        if payload.get("product") != PRODUCT_NAME:
            raise LicenseError("This licence is for a different product.")
        payload["_expires_at"] = _parse_time(payload["expires_at"])
        payload["_not_before"] = _parse_time(payload.get("not_before") or payload["issued_at"])
        payload["grace_days"] = max(0, int(payload.get("grace_days", 7)))
        payload["max_users"] = payload.get("max_users")
        payload["features"] = list(payload.get("features") or ["*"])
        payload["installation_id"] = payload.get("installation_id") or None
        payload["_kid"] = kid
    except LicenseError:
        raise
    except (ValueError, KeyError, TypeError):
        raise LicenseError("The licence content is not valid.")

    return payload


def get_installation_id(db: Session) -> str:
    """This installation's ID, created on first use."""
    row = db.get(Installation, 1)
    if row is None:
        parts = [secrets.token_hex(2).upper() for _ in range(4)]
        row = Installation(id=1, installation_id="RGI-" + "-".join(parts))
        db.add(row)
        try:
            db.commit()
        except Exception:      # another request created it at the same moment
            db.rollback()
            row = db.get(Installation, 1)
    return row.installation_id


@dataclass
class LicenseState:
    state: str  # valid | grace | expired | not_yet_valid | invalid | missing | clock_tampered | wrong_installation
    message: str
    license: License | None = None
    payload: dict | None = None
    days_left: int | None = None
    features: set[str] = field(default_factory=set)

    @property
    def usable(self) -> bool:
        return self.state in {"valid", "grace"}

    def has_feature(self, name: str) -> bool:
        return self.usable and ("*" in self.features or name in self.features)

    @property
    def read_only(self) -> bool:
        """Expired after the grace period: existing data stays readable and exportable."""
        return self.state == "expired"

    def can_read(self, name: str | None = None) -> bool:
        if not (self.usable or self.read_only):
            return False
        return name is None or "*" in self.features or name in self.features

    @property
    def warning(self) -> dict | None:
        """Banner for administrators, or None when nothing needs attention."""
        if self.state == "valid":
            if self.days_left is not None and self.days_left <= LICENSE_WARNING_DAYS:
                level = "critical" if self.days_left <= 7 else ("warning" if self.days_left <= 15 else "info")
                return {"level": level, "message": f"The licence expires in {self.days_left} day(s). "
                                                   "Ask the vendor for the renewal licence now."}
            return None
        if self.state == "grace":
            return {"level": "critical", "message": self.message + " Install the renewed licence to avoid "
                                                                   "read-only mode."}
        if self.state == "expired":
            return {"level": "critical", "message": "The licence has expired. RAGENTIS is read-only: you can open "
                                                    "and export your data, but uploads and questions are paused."}
        if self.state == "missing":
            return {"level": "warning", "message": "No licence is installed yet."}
        return {"level": "critical", "message": self.message}


class LicenseService:

    @staticmethod
    def get_license(db: Session, tenant_id) -> License | None:
        return db.scalar(select(License).where(License.tenant_id == tenant_id))

    @staticmethod
    def evaluate(db: Session, tenant_id, record_time: bool = True) -> LicenseState:
        license = LicenseService.get_license(db, tenant_id)

        if license is None or not license.signed_license:
            return LicenseState("missing", "No signed licence is installed.", license)

        try:
            payload = verify_license_text(license.signed_license)
        except LicenseError as exc:
            return LicenseState("invalid", str(exc), license)

        now = _utcnow()

        # Clock roll-back protection.
        if license.last_seen_at is not None:
            last_seen = license.last_seen_at.replace(tzinfo=timezone.utc)
            if now + CLOCK_TOLERANCE < last_seen:
                return LicenseState(
                    "clock_tampered",
                    "The system clock is earlier than a previously seen time. "
                    "Correct the clock to continue.",
                    license,
                    payload,
                )

        if record_time and (
            license.last_seen_at is None
            or now.replace(tzinfo=None) - license.last_seen_at > timedelta(minutes=30)
        ):
            license.last_seen_at = now.replace(tzinfo=None)
            db.commit()

        if payload.get("installation_id") and payload["installation_id"] != get_installation_id(db):
            return LicenseState("wrong_installation",
                                "This licence belongs to a different installation. Ask the vendor for a licence "
                                "for this installation (Licence page → activation request).", license, payload)

        features = set(payload["features"])
        expires_at = payload["_expires_at"]
        days_left = int((expires_at - now).total_seconds() // 86400)

        if now < payload["_not_before"]:
            return LicenseState("not_yet_valid", "The licence is not active yet.", license, payload, days_left, features)

        if now <= expires_at:
            return LicenseState("valid", "Licence is valid.", license, payload, days_left, features)

        grace_end = expires_at + timedelta(days=payload["grace_days"])
        if now <= grace_end:
            grace_left = int((grace_end - now).total_seconds() // 86400)
            return LicenseState(
                "grace",
                f"Licence expired. Grace period ends in {grace_left} day(s).",
                license,
                payload,
                days_left,
                features,
            )

        return LicenseState("expired", "The licence has expired.", license, payload, days_left, features)

    @staticmethod
    def is_license_valid(db: Session, tenant_id) -> bool:
        return LicenseService.evaluate(db, tenant_id).usable

    @staticmethod
    def install(db: Session, tenant_id, license_text: str) -> License:
        license_text = license_text.strip()
        payload = verify_license_text(license_text)

        if payload["_expires_at"] <= _utcnow() - timedelta(days=payload["grace_days"]):
            raise LicenseError("This licence has already expired.")
        if payload.get("installation_id") and payload["installation_id"] != get_installation_id(db):
            raise LicenseError("This licence was issued for a different installation "
                               f"({payload['installation_id']}). This installation is {get_installation_id(db)}.")

        license = LicenseService.get_license(db, tenant_id)
        if license is None:
            license = License(tenant_id=tenant_id)
            db.add(license)

        license.license_key = str(payload.get("license_id") or hashlib.sha256(license_text.encode()).hexdigest()[:32])
        license.signed_license = license_text
        license.customer = str(payload.get("customer") or "")[:255]
        license.max_users = payload.get("max_users")
        license.features = payload["features"]
        license.issued_at = _parse_time(payload["issued_at"]).replace(tzinfo=None)
        # Informational copy only; validity always comes from the signature.
        license.expires_at = payload["_expires_at"].replace(tzinfo=None)
        license.is_active = True
        if license.last_seen_at is None:
            license.last_seen_at = _utcnow().replace(tzinfo=None)

        db.commit()
        db.refresh(license)
        return license


def activation_request(db: Session, tenant_name: str) -> dict:
    """Code the customer sends to the vendor to get a licence bound to this installation."""
    installation_id = get_installation_id(db)
    body = {
        "product": PRODUCT_NAME,
        "installation_id": installation_id,
        "organisation": tenant_name,
        "requested_at": _utcnow().replace(microsecond=0).isoformat(),
    }
    raw = json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
    code = "RGX-REQ-" + base64.urlsafe_b64encode(raw).decode().rstrip("=")
    return {**body, "code": code}
