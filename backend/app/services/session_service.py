"""
Sign-in sessions: short access tokens (30 min) + rotating refresh tokens.

* Every refresh returns a NEW refresh token and revokes the old one.
* Presenting an already-used token revokes the whole family (theft signal).
* Password change, deactivation and admin reset revoke all sessions.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_REUSE_GRACE_SECONDS, REFRESH_TOKEN_DAYS
from app.core.security import create_access_token, hash_refresh_token, new_refresh_token
from app.models.refresh_token import RefreshToken
from app.models.user import User


class SessionError(Exception):
    """Refresh token invalid, expired or revoked."""


def _access_token(user: User) -> str:
    return create_access_token({"sub": str(user.id), "role": user.role.name, "ver": user.token_version})


def issue_tokens(db: Session, user: User, user_agent: str | None = None, ip: str | None = None,
                 family_id: uuid.UUID | None = None) -> dict:
    token, token_hash = new_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        family_id=family_id or uuid.uuid4(),
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_DAYS),
        user_agent=(user_agent or "")[:255] or None,
        ip_address=ip,
    ))
    db.commit()
    return {
        "access_token": _access_token(user),
        "refresh_token": token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


def rotate(db: Session, refresh_token: str, user_agent: str | None = None, ip: str | None = None) -> tuple[User, dict]:
    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)))
    if record is None:
        raise SessionError("Unknown session")

    now = datetime.utcnow()
    if record.revoked_at is not None:
        concurrent = (
            record.rotated_at is not None
            and (now - record.rotated_at).total_seconds() <= REFRESH_REUSE_GRACE_SECONDS
            and record.expires_at > now
        )
        if not concurrent:
            # Re-use of an old token: assume theft, end every session in the family.
            revoke_family(db, record.family_id)
            raise SessionError("Session was already used")
        # Another tab refreshed a moment ago: continue the same session.
        user = db.get(User, record.user_id)
        if user is None or not user.is_active:
            revoke_family(db, record.family_id)
            raise SessionError("Account unavailable")
        return user, issue_tokens(db, user, user_agent, ip, family_id=record.family_id)
    if record.expires_at <= now:
        raise SessionError("Session expired")

    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        revoke_family(db, record.family_id)
        raise SessionError("Account unavailable")

    record.revoked_at = now
    record.rotated_at = now
    db.flush()
    return user, issue_tokens(db, user, user_agent, ip, family_id=record.family_id)


def revoke(db: Session, refresh_token: str) -> None:
    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)))
    if record is not None and record.revoked_at is None:
        record.revoked_at = datetime.utcnow()
        db.commit()


def revoke_family(db: Session, family_id) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.utcnow())
    )
    db.commit()


def revoke_all_for_user(db: Session, user_id) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.utcnow())
    )
    db.flush()
