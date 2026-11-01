#!/usr/bin/env python3
"""
RAGENTIS licence issuer  --  VENDOR TOOL, never shipped to customers.

The private key it creates must stay on the vendor's own machine. It is
written outside the repository by default and must never be committed.

1) Create the key pair once:

    python tools/license_issuer.py init-keys

   -> private key: ~/.ragentis/license_signing_key.pem   (keep secret, back up)
   -> public key : backend/app/core/license_public_key.pem (ships with product)

2) Issue a licence for a customer:

    python tools/license_issuer.py issue --customer "ABC Pvt Ltd" --days 365 \
        --max-users 25 --features "*" --out abc.license

3) Admin installs the .license file from the Licence page in the app.

Licence for ONE installation (recommended): the customer copies the
activation request code from the Licence page and sends it to you:

    python tools/license_issuer.py issue --activation-request RGX-REQ-... --days 365 --out abc.license

Signing key protection: the private key is encrypted with a passphrase
(asked when needed, or read from RAGENTIS_SIGNING_PASSPHRASE). Protect an
older unencrypted key with:  python tools/license_issuer.py protect-key

Key rotation: python tools/license_issuer.py init-keys --name 2027
(new private key in ~/.ragentis/, public key in app/core/license_keys/).

Vendor console (every issued licence is recorded in ~/.ragentis/issued.json):

    python tools/license_issuer.py list                     # all customers
    python tools/license_issuer.py list --expiring 30       # renewals due in 30 days
    python tools/license_issuer.py renew --license-id LIC-XXXX --days 365 --out abc-2027.license
    python tools/license_issuer.py export --out customers.csv
"""

import argparse
import base64
import getpass
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

DEFAULT_PRIVATE = Path.home() / ".ragentis" / "license_signing_key.pem"
DEFAULT_PUBLIC = Path(__file__).resolve().parents[1] / "app" / "core" / "license_public_key.pem"
DEFAULT_REGISTRY = Path.home() / ".ragentis" / "issued.json"
DEFAULT_KEYS_DIR = Path(__file__).resolve().parents[1] / "app" / "core" / "license_keys"


def load_registry(path) -> list[dict]:
    path = Path(path).expanduser()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text())
    except ValueError:
        sys.exit(f"The registry file is damaged: {path}. Restore it from your backup.")
    return data if isinstance(data, list) else []


def save_registry(path, entries: list[dict]) -> None:
    path = Path(path).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(entries, indent=2))
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def key_id_of(public_key) -> str:
    raw = public_key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return hashlib.sha256(raw).hexdigest()[:16]


def _new_passphrase() -> bytes | None:
    env = os.environ.get("RAGENTIS_SIGNING_PASSPHRASE")
    if env:
        return env.encode()
    if not sys.stdin.isatty():
        sys.exit("Set RAGENTIS_SIGNING_PASSPHRASE (or run in a terminal) to encrypt the signing key, "
                 "or pass --no-encrypt.")
    first = getpass.getpass("New passphrase for the signing key (min 12 characters): ")
    if len(first) < 12:
        sys.exit("The passphrase must have at least 12 characters.")
    if getpass.getpass("Repeat the passphrase: ") != first:
        sys.exit("The passphrases do not match.")
    return first.encode()


def _write_private(path: Path, key, passphrase: bytes | None) -> None:
    encryption = (serialization.BestAvailableEncryption(passphrase) if passphrase
                  else serialization.NoEncryption())
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, encryption))
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def load_private_key(path) -> Ed25519PrivateKey:
    data = Path(path).expanduser().read_bytes()
    try:
        return serialization.load_pem_private_key(data, password=None)
    except TypeError:          # encrypted -> needs the passphrase
        pass
    passphrase = os.environ.get("RAGENTIS_SIGNING_PASSPHRASE")
    if not passphrase:
        if not sys.stdin.isatty():
            sys.exit("The signing key is encrypted: set RAGENTIS_SIGNING_PASSPHRASE.")
        passphrase = getpass.getpass("Signing key passphrase: ")
    try:
        return serialization.load_pem_private_key(data, password=passphrase.encode())
    except ValueError:
        sys.exit("Wrong passphrase for the signing key.")


def init_keys(args) -> None:
    private_path = Path(args.private_key).expanduser()
    public_path = Path(args.public_key).expanduser()
    if args.name:
        safe = "".join(c for c in args.name if c.isalnum() or c in "-_")
        if not safe:
            sys.exit("--name may contain letters, digits, - and _ only.")
        if args.private_key == str(DEFAULT_PRIVATE):
            private_path = DEFAULT_PRIVATE.with_name(f"license_signing_key-{safe}.pem")
        if args.public_key == str(DEFAULT_PUBLIC):
            public_path = DEFAULT_KEYS_DIR / f"{safe}.pem"

    if private_path.exists() and not args.force:
        sys.exit(f"Refusing to overwrite existing private key: {private_path} (use --force)")

    key = Ed25519PrivateKey.generate()
    passphrase = None if args.no_encrypt else _new_passphrase()
    _write_private(private_path, key, passphrase)
    if passphrase is None:
        print("WARNING: the private key is NOT encrypted. Run 'protect-key' later.")

    public_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.write_bytes(
        key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )
    print(f"Private key (KEEP SECRET): {private_path}")
    print(f"Public key  (ship it)    : {public_path}")
    print(f"Key ID                   : {key_id_of(key.public_key())}")
    print("Back up the private key (and its passphrase) in two safe places.")


def protect_key(args) -> None:
    path = Path(args.private_key).expanduser()
    data = path.read_bytes()
    try:
        key = serialization.load_pem_private_key(data, password=None)
    except TypeError:
        sys.exit(f"{path} is already encrypted.")
    _write_private(path, key, _new_passphrase())
    print(f"Encrypted {path}. Remember the passphrase: without it no new licences can be issued.")


def key_info(args) -> None:
    key = load_private_key(args.private_key)
    print(f"Key ID: {key_id_of(key.public_key())}")


def parse_activation_request(code: str) -> dict:
    code = code.strip()
    if code.startswith("@"):
        code = Path(code[1:]).read_text().strip()
    if not code.startswith("RGX-REQ-"):
        sys.exit("The activation request must start with RGX-REQ-")
    raw = code[len("RGX-REQ-"):]
    try:
        data = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
    except ValueError:
        sys.exit("The activation request is damaged. Ask the customer to copy it again.")
    if data.get("product") != "RAGENTIS" or not str(data.get("installation_id", "")).startswith("RGI-"):
        sys.exit("This is not a RAGENTIS activation request.")
    return data


def issue(args) -> dict:
    key = load_private_key(args.private_key)

    installation_id = getattr(args, "installation_id", None)
    request_code = getattr(args, "activation_request", None)
    if request_code:
        request = parse_activation_request(request_code)
        installation_id = request["installation_id"]
        if not getattr(args, "customer", None):
            args.customer = request.get("organisation") or "Customer"
    if not getattr(args, "customer", None):
        sys.exit("--customer is required (or give --activation-request).")

    now = datetime.now(timezone.utc).replace(microsecond=0)
    if args.expires:
        expires = datetime.fromisoformat(args.expires).replace(tzinfo=timezone.utc)
    else:
        expires = now + timedelta(days=args.days)

    features = [f.strip() for f in args.features.split(",") if f.strip()] or ["*"]

    payload = {
        "license_id": f"LIC-{uuid.uuid4().hex[:12].upper()}",
        "product": "RAGENTIS",
        "customer": args.customer,
        "issued_at": now.isoformat(),
        "not_before": now.isoformat(),
        "expires_at": expires.isoformat(),
        "max_users": args.max_users,
        "features": features,
        "grace_days": args.grace_days,
    }
    if installation_id:
        payload["installation_id"] = installation_id
    payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    envelope = {
        "format": "ragentis-license-v1",
        "kid": key_id_of(key.public_key()),
        "payload": b64(payload_bytes),
        "signature": b64(key.sign(payload_bytes)),
    }
    Path(args.out).write_text(json.dumps(envelope, indent=2))
    bound = f", bound to {installation_id}" if installation_id else ""
    print(f"Licence {payload['license_id']} for '{args.customer}' valid until {expires.date()}{bound} -> {args.out}")

    registry_path = getattr(args, "registry", None)
    if registry_path:
        entries = load_registry(registry_path)
        entries.append({
            **payload,
            "file": str(Path(args.out).resolve()),
            "renews": getattr(args, "renews", None),
            "note": getattr(args, "note", None),
        })
        save_registry(registry_path, entries)
    return payload


def _days_left(entry: dict, now: datetime) -> int:
    return (datetime.fromisoformat(entry["expires_at"]) - now).days


def _current(entries: list[dict]) -> list[dict]:
    """The newest licence per customer (renewed ones are replaced)."""
    renewed = {e.get("renews") for e in entries if e.get("renews")}
    return [e for e in entries if e["license_id"] not in renewed]


def list_licences(args) -> None:
    now = datetime.now(timezone.utc)
    entries = load_registry(args.registry)
    if not args.all:
        entries = _current(entries)
    if args.expiring is not None:
        entries = [e for e in entries if _days_left(e, now) <= args.expiring]
    entries.sort(key=lambda e: e["expires_at"])
    if not entries:
        print("No licences found." if args.expiring is None else f"No licences expire within {args.expiring} days.")
        return
    print(f"{'LICENCE':<17} {'CUSTOMER':<28} {'EXPIRES':<11} {'DAYS':>5} {'USERS':>5}  {'INSTALLATION':<23} FEATURES")
    for e in entries:
        days = _days_left(e, now)
        state = "EXPIRED" if days < 0 else str(days)
        users = "-" if e.get("max_users") is None else str(e["max_users"])
        print(f"{e['license_id']:<17} {e['customer'][:28]:<28} {e['expires_at'][:10]:<11} {state:>5} {users:>5}  "
              f"{(e.get('installation_id') or 'any'):<23} {','.join(e.get('features') or ['*'])}")


def renew(args) -> None:
    entries = load_registry(args.registry)
    old = next((e for e in entries if e["license_id"] == args.license_id), None)
    if old is None:
        sys.exit(f"Licence {args.license_id} is not in the registry {args.registry}.")
    # New licence starts when the old one ends (no lost days) or today if already expired.
    now = datetime.now(timezone.utc).replace(microsecond=0)
    start = max(now, datetime.fromisoformat(old["expires_at"]))
    args.customer = old["customer"]
    args.expires = None
    args.days = args.days + max(0, (start - now).days)
    args.max_users = args.max_users if args.max_users is not None else old.get("max_users")
    args.features = args.features or ",".join(old.get("features") or ["*"])
    args.grace_days = args.grace_days if args.grace_days is not None else old.get("grace_days", 7)
    args.renews = old["license_id"]
    args.installation_id = old.get("installation_id")
    args.activation_request = None
    issue(args)


def export(args) -> None:
    import csv

    now = datetime.now(timezone.utc)
    entries = load_registry(args.registry)
    with open(args.out, "w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["license_id", "customer", "issued_at", "expires_at", "days_left", "max_users",
                         "features", "installation_id", "renews", "file"])
        for e in entries:
            writer.writerow([e["license_id"], e["customer"], e["issued_at"], e["expires_at"], _days_left(e, now),
                             e.get("max_users") or "", ",".join(e.get("features") or []), e.get("installation_id") or "",
                             e.get("renews") or "",
                             e.get("file") or ""])
    print(f"{len(entries)} licences -> {args.out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init-keys", help="create the signing key pair")
    p_init.add_argument("--private-key", default=str(DEFAULT_PRIVATE))
    p_init.add_argument("--public-key", default=str(DEFAULT_PUBLIC))
    p_init.add_argument("--force", action="store_true")
    p_init.add_argument("--name", default=None, help="extra key for rotation, e.g. 2027")
    p_init.add_argument("--no-encrypt", action="store_true", help="store the private key without a passphrase")
    p_init.set_defaults(func=init_keys)

    p_protect = sub.add_parser("protect-key", help="encrypt an existing private key with a passphrase")
    p_protect.add_argument("--private-key", default=str(DEFAULT_PRIVATE))
    p_protect.set_defaults(func=protect_key)

    p_info = sub.add_parser("key-info", help="show the key ID of a private key")
    p_info.add_argument("--private-key", default=str(DEFAULT_PRIVATE))
    p_info.set_defaults(func=key_info)

    p_issue = sub.add_parser("issue", help="issue a signed licence file")
    p_issue.add_argument("--private-key", default=str(DEFAULT_PRIVATE))
    p_issue.add_argument("--customer", default=None)
    p_issue.add_argument("--activation-request", default=None,
                         help="RGX-REQ-... code from the customer's Licence page (or @file)")
    p_issue.add_argument("--installation-id", default=None, help="bind to this installation (RGI-...)")
    p_issue.add_argument("--days", type=int, default=365)
    p_issue.add_argument("--expires", help="YYYY-MM-DD (overrides --days)")
    p_issue.add_argument("--max-users", type=int, default=None)
    p_issue.add_argument("--features", default="*",
                         help='comma list: chat,documents,analytics,extraction,compare,groups,insights or "*"')
    p_issue.add_argument("--grace-days", type=int, default=7)
    p_issue.add_argument("--out", required=True)
    p_issue.add_argument("--note", default=None, help="free text kept in the registry (e.g. order number)")
    p_issue.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    p_issue.set_defaults(func=issue)

    p_list = sub.add_parser("list", help="show issued licences")
    p_list.add_argument("--expiring", type=int, default=None, help="only licences ending within N days")
    p_list.add_argument("--all", action="store_true", help="include licences that were already renewed")
    p_list.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    p_list.set_defaults(func=list_licences)

    p_renew = sub.add_parser("renew", help="issue the next licence for a customer")
    p_renew.add_argument("--license-id", required=True)
    p_renew.add_argument("--days", type=int, default=365)
    p_renew.add_argument("--max-users", type=int, default=None, help="default: same as before")
    p_renew.add_argument("--features", default=None, help="default: same as before")
    p_renew.add_argument("--grace-days", type=int, default=None)
    p_renew.add_argument("--private-key", default=str(DEFAULT_PRIVATE))
    p_renew.add_argument("--out", required=True)
    p_renew.add_argument("--note", default=None)
    p_renew.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    p_renew.set_defaults(func=renew)

    p_export = sub.add_parser("export", help="write the registry as CSV")
    p_export.add_argument("--out", required=True)
    p_export.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    p_export.set_defaults(func=export)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
