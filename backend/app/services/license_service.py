"""
Signed offline licences.

A licence file is issued by the vendor with a private Ed25519 key that never
leaves the vendor's machine. The product only holds the matching PUBLIC key,
so it can check a licence but cannot create one. Editing the database or the
licence file breaks the signature, and the licence is rejected.

Licence file (JSON):
    {
      "format": "ragentis-license-v1",
      "payload": "<base64url of the JSON payload>",
      "signature": "<base64url Ed25519 signature of the payload bytes>"
    }

Payload fields:
    license_id, product, customer, issued_at, not_before, expires_at,
    max_users, features (list, "*" = all), grace_days
"""

from __future__ import annotations

import base64
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import LICENSE_PUBLIC_KEY_PATH, PRODUCT_NAME
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


@lru_cache(maxsize=1)
def _load_public_key() -> Ed25519PublicKey | None:
    try:
        key = load_pem_public_key(LICENSE_PUBLIC_KEY_PATH.read_bytes())
    except (OSError, ValueError):
        return None
    if not isinstance(key, Ed25519PublicKey):
        return None
    return key


@lru_cache(maxsize=32)
def verify_license_text(license_text: str) -> dict:
    """Return the verified payload, or raise LicenseError."""

    public_key = _load_public_key()
    if public_key is None:
        raise LicenseError(
            "No licence public key is installed on this server."
        )

    try:
        envelope = json.loads(license_text)
        if envelope.get("format") != LICENSE_FORMAT:
            raise LicenseError("Unknown licence format.")
        payload_bytes = _b64decode(envelope["payload"])
        signature = _b64decode(envelope["signature"])
    except LicenseError:
        raise
    except (ValueError, KeyError, TypeError, AttributeError):
        raise LicenseError("The licence file is not valid.")

    try:
        public_key.verify(signature, payload_bytes)
    except InvalidSignature:
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
    except LicenseError:
        raise
    except (ValueError, KeyError, TypeError):
        raise LicenseError("The licence content is not valid.")

    return payload


@dataclass
class LicenseState:
    state: str  # valid | grace | expired | not_yet_valid | invalid | missing | clock_tampered
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
