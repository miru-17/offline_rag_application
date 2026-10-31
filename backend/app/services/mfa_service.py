"""Two-step login with any TOTP authenticator app (Google/Microsoft Authenticator)."""

from __future__ import annotations

import pyotp

from app.core.config import MFA_ISSUER
from app.core.security import decrypt_secret, encrypt_secret
from app.models.user import User


def start_setup(user: User) -> dict:
    secret = pyotp.random_base32()
    user.mfa_pending_secret = encrypt_secret(secret)
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.username, issuer_name=MFA_ISSUER)
    return {"secret": secret, "otpauth_uri": uri}


def _verify(secret: str | None, code: str) -> bool:
    if not secret or not code:
        return False
    code = code.strip().replace(" ", "")
    if not code.isdigit() or len(code) != 6:
        return False
    # valid_window=1 accepts the previous/next 30 s step (clock drift).
    return pyotp.TOTP(secret).verify(code, valid_window=1)


def confirm_setup(user: User, code: str) -> bool:
    secret = decrypt_secret(user.mfa_pending_secret) if user.mfa_pending_secret else None
    if not _verify(secret, code):
        return False
    user.mfa_secret = user.mfa_pending_secret
    user.mfa_pending_secret = None
    user.mfa_enabled = True
    return True


def verify_login(user: User, code: str) -> bool:
    if not user.mfa_enabled or not user.mfa_secret:
        return False
    return _verify(decrypt_secret(user.mfa_secret), code)


def disable(user: User) -> None:
    user.mfa_enabled = False
    user.mfa_secret = None
    user.mfa_pending_secret = None
