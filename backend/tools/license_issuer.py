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
"""

import argparse
import base64
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


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def init_keys(args) -> None:
    private_path = Path(args.private_key).expanduser()
    public_path = Path(args.public_key).expanduser()

    if private_path.exists() and not args.force:
        sys.exit(f"Refusing to overwrite existing private key: {private_path} (use --force)")

    key = Ed25519PrivateKey.generate()
    private_path.parent.mkdir(parents=True, exist_ok=True)
    private_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    os.chmod(private_path, 0o600)

    public_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.write_bytes(
        key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )
    print(f"Private key (KEEP SECRET): {private_path}")
    print(f"Public key  (ship it)    : {public_path}")


def issue(args) -> None:
    private_path = Path(args.private_key).expanduser()
    key = serialization.load_pem_private_key(private_path.read_bytes(), password=None)

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
    payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    envelope = {
        "format": "ragentis-license-v1",
        "payload": b64(payload_bytes),
        "signature": b64(key.sign(payload_bytes)),
    }
    Path(args.out).write_text(json.dumps(envelope, indent=2))
    print(f"Licence {payload['license_id']} for '{args.customer}' valid until {expires.date()} -> {args.out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init-keys", help="create the signing key pair")
    p_init.add_argument("--private-key", default=str(DEFAULT_PRIVATE))
    p_init.add_argument("--public-key", default=str(DEFAULT_PUBLIC))
    p_init.add_argument("--force", action="store_true")
    p_init.set_defaults(func=init_keys)

    p_issue = sub.add_parser("issue", help="issue a signed licence file")
    p_issue.add_argument("--private-key", default=str(DEFAULT_PRIVATE))
    p_issue.add_argument("--customer", required=True)
    p_issue.add_argument("--days", type=int, default=365)
    p_issue.add_argument("--expires", help="YYYY-MM-DD (overrides --days)")
    p_issue.add_argument("--max-users", type=int, default=None)
    p_issue.add_argument("--features", default="*",
                         help='comma list: chat,documents,analytics,extraction,compare,groups,insights or "*"')
    p_issue.add_argument("--grace-days", type=int, default=7)
    p_issue.add_argument("--out", required=True)
    p_issue.set_defaults(func=issue)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
