import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, DATA_ENCRYPTION_KEY, get_jwt_secret

# Fails at import (= at startup) when the secret is missing or weak.
SECRET_KEY = get_jwt_secret()

ALGORITHM = "HS256"


class TokenError(Exception):
    """Raised when a JWT cannot be validated."""


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        raise ValueError("Password must not exceed 72 bytes")

    hashed = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(rounds=12),
    )

    return hashed.decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    password_bytes = plain_password.encode("utf-8")

    if len(password_bytes) > 72:
        return False

    try:
        return bcrypt.checkpw(
            password_bytes,
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        return False


# A real bcrypt hash used to keep login timing the same when the
# username does not exist (prevents username discovery by timing).
_DUMMY_HASH = bcrypt.hashpw(b"timing-equaliser", bcrypt.gensalt(rounds=12)).decode()


def burn_password_check(plain_password: str) -> None:
    verify_password(plain_password[:72], _DUMMY_HASH)


def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": now})
    to_encode.setdefault("typ", "access")

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc


def decode_access_token(token: str) -> dict:
    payload = _decode(token)
    # Short-lived MFA challenge tokens can never be used as access tokens.
    if payload.get("typ", "access") != "access":
        raise TokenError("wrong token type")
    return payload


MFA_TOKEN_MINUTES = 5


def create_mfa_token(user_id: str, token_version: int) -> str:
    return create_access_token(
        {"sub": user_id, "ver": token_version, "typ": "mfa"},
        expires_delta=timedelta(minutes=MFA_TOKEN_MINUTES),
    )


def decode_mfa_token(token: str) -> dict:
    payload = _decode(token)
    if payload.get("typ") != "mfa":
        raise TokenError("wrong token type")
    return payload


# ------------------------------------------------------------------
# Refresh tokens (opaque; only the hash is stored)
# ------------------------------------------------------------------

def new_refresh_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(48)
    return token, hash_refresh_token(token)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_temporary_password() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    while True:
        value = "".join(secrets.choice(alphabet) for _ in range(12))
        if any(c.isdigit() for c in value) and any(c.isalpha() for c in value):
            return value


# ------------------------------------------------------------------
# Encryption of stored secrets (MFA)
# ------------------------------------------------------------------

def _fernet() -> Fernet:
    material = DATA_ENCRYPTION_KEY or ("ragentis-data-key:" + SECRET_KEY)
    key = base64.urlsafe_b64encode(hashlib.sha256(material.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str | None:
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None
