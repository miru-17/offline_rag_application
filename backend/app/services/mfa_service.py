"""Two-step login with any TOTP authenticator app (Google/Microsoft Authenticator)."""

from __future__ import annotations

import hmac
import time

import pyotp

from app.core.config import MFA_ISSUER
from app.core.security import decrypt_secret, encrypt_secret
from app.models.user import User


def start_setup(user: User) -> dict:
    secret = pyotp.random_base32()
    user.mfa_pending_secret = encrypt_secret(secret)
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.username, issuer_name=MFA_ISSUER)
    return {"secret": secret, "otpauth_uri": uri}


def _matching_step(secret: str | None, code: str) -> int | None:
    """The 30-second step the code belongs to (previous/current/next for clock drift), or None."""
    if not secret or not code:
        return None
    code = code.strip().replace(" ", "")
    if not code.isdigit() or len(code) != 6:
        return None
    totp = pyotp.TOTP(secret)
    now = int(time.time())
    for drift in (-1, 0, 1):
        moment = now + drift * totp.interval
        if hmac.compare_digest(totp.at(moment), code):
            return moment // totp.interval
    return None


def _verify(secret: str | None, code: str) -> bool:
    return _matching_step(secret, code) is not None


def confirm_setup(user: User, code: str) -> bool:
    secret = decrypt_secret(user.mfa_pending_secret) if user.mfa_pending_secret else None
    step = _matching_step(secret, code)
    if step is None:
        return False
    user.mfa_last_step = step
    user.mfa_secret = user.mfa_pending_secret
    user.mfa_pending_secret = None
    user.mfa_enabled = True
    return True


def verify_login(user: User, code: str) -> bool:
    """Check a sign-in code. Each code works only once (replay protection)."""
    if not user.mfa_enabled or not user.mfa_secret:
        return False
    step = _matching_step(decrypt_secret(user.mfa_secret), code)
    if step is None or (user.mfa_last_step is not None and step <= user.mfa_last_step):
        return False
    user.mfa_last_step = step          # caller commits
    return True


def disable(user: User) -> None:
    user.mfa_enabled = False
    user.mfa_secret = None
    user.mfa_pending_secret = None
    user.mfa_last_step = None
