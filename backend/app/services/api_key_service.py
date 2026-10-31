"""
API keys for the REST API (ERP, intranet portal, scripts).

Format: rgk_<8 hex prefix>_<secret>. Only the SHA-256 hash is stored.
A key can do only what its scopes allow AND what its user's role allows.
"""

from __future__ import annotations

import hashlib
import re
import secrets
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.api_key import ApiKey
from app.models.user import User

SCOPES = {
    "query": "Ask questions (POST /query/, /query/stream)",
    "documents:read": "List documents, read details, download originals",
    "documents:write": "Upload, re-process and delete documents",
}

KEY_PATTERN = re.compile(r"^rgk_[0-9a-f]{8}_[A-Za-z0-9_-]{32,64}$")

# (method, path pattern, scope). Anything not listed is refused for API keys.
_ROUTES = [
    ("POST", re.compile(r"^/query$"), "query"),
    ("POST", re.compile(r"^/query/stream$"), "query"),
    ("GET", re.compile(r"^/conversations(/[0-9a-f-]{36})?$"), "query"),
    ("GET", re.compile(r"^/documents$"), "documents:read"),
    ("GET", re.compile(r"^/documents/[0-9a-f-]{36}$"), "documents:read"),
    ("GET", re.compile(r"^/documents/[0-9a-f-]{36}/(file|versions)$"), "documents:read"),
    ("POST", re.compile(r"^/documents/upload$"), "documents:write"),
    ("POST", re.compile(r"^/documents/[0-9a-f-]{36}/retry$"), "documents:write"),
    ("DELETE", re.compile(r"^/documents/[0-9a-f-]{36}$"), "documents:write"),
    ("GET", re.compile(r"^/auth/me$"), None),       # "who am I" for any valid key
]


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_key() -> tuple[str, str]:
    prefix = secrets.token_hex(4)
    return f"rgk_{prefix}_{secrets.token_urlsafe(32)}", prefix


def required_scope(method: str, path: str) -> tuple[bool, str | None]:
    """(allowed for API keys at all, scope needed)."""
    path = path.rstrip("/") or "/"
    for route_method, pattern, scope in _ROUTES:
        if method == route_method and pattern.match(path):
            return True, scope
    return False, None


def authenticate(db: Session, raw: str) -> ApiKey | None:
    if not raw or not KEY_PATTERN.match(raw):
        return None
    key = db.scalar(
        select(ApiKey).options(joinedload(ApiKey.user).joinedload(User.role), joinedload(ApiKey.user).joinedload(User.tenant))
        .where(ApiKey.key_hash == hash_key(raw))
    )
    if key is None or key.revoked_at is not None:
        return None
    now = datetime.utcnow()
    if key.expires_at is not None and key.expires_at <= now:
        return None
    if key.last_used_at is None or (now - key.last_used_at).total_seconds() > 60:
        key.last_used_at = now
        db.commit()
    return key
