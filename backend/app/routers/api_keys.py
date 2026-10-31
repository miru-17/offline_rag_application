import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.license import require_feature
from app.models.api_key import ApiKey
from app.models.user import User
from app.services import api_key_service, audit_service

router = APIRouter(prefix="/api-keys", tags=["API keys"])

MAX_ACTIVE_KEYS = 50


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    scopes: list[str] = Field(min_length=1)
    expires_in_days: int | None = Field(365, ge=1, le=1825)
    # The account the key acts as (default: you). Use a dedicated account
    # with the smallest role that is enough, e.g. a USER for uploads.
    user_id: uuid.UUID | None = None


def _serialize(key: ApiKey) -> dict:
    now = datetime.utcnow()
    state = "revoked" if key.revoked_at else ("expired" if key.expires_at and key.expires_at <= now else "active")
    return {
        "id": str(key.id),
        "name": key.name,
        "prefix": f"rgk_{key.prefix}_…",
        "scopes": key.scopes,
        "user": key.user.username if key.user else None,
        "created_at": key.created_at,
        "expires_at": key.expires_at,
        "last_used_at": key.last_used_at,
        "revoked_at": key.revoked_at,
        "state": state,
    }


@router.get("/scopes")
def list_scopes(current_user: User = Depends(require_feature("api", "ADMIN"))):
    return [{"scope": k, "description": v} for k, v in api_key_service.SCOPES.items()]


@router.get("/")
def list_keys(current_user: User = Depends(require_feature("api", "ADMIN")), db: Session = Depends(get_db)):
    keys = db.scalars(select(ApiKey).where(ApiKey.tenant_id == current_user.tenant_id)
                      .order_by(ApiKey.created_at.desc())).all()
    return [_serialize(k) for k in keys]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_key(
    request: Request,
    payload: ApiKeyCreate,
    current_user: User = Depends(require_feature("api", "ADMIN")),
    db: Session = Depends(get_db),
):
    scopes = sorted(set(payload.scopes))
    unknown = [s for s in scopes if s not in api_key_service.SCOPES]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown scope: {', '.join(unknown)}")

    owner = current_user
    if payload.user_id is not None and payload.user_id != current_user.id:
        owner = db.scalar(select(User).where(User.id == payload.user_id, User.tenant_id == current_user.tenant_id))
        if owner is None or not owner.is_active:
            raise HTTPException(status_code=404, detail="User not found.")

    active = db.scalars(select(ApiKey).where(ApiKey.tenant_id == current_user.tenant_id,
                                             ApiKey.revoked_at.is_(None))).all()
    if len(active) >= MAX_ACTIVE_KEYS:
        raise HTTPException(status_code=409, detail="Too many active API keys. Revoke unused keys first.")

    raw, prefix = api_key_service.new_key()
    key = ApiKey(
        tenant_id=current_user.tenant_id,
        user_id=owner.id,
        created_by=current_user.id,
        name=payload.name.strip(),
        prefix=prefix,
        key_hash=api_key_service.hash_key(raw),
        scopes=scopes,
        expires_at=datetime.utcnow() + timedelta(days=payload.expires_in_days) if payload.expires_in_days else None,
    )
    db.add(key)
    db.commit()
    db.refresh(key)
    audit_service.record("api_key.created", actor=current_user, target_type="api_key", target_id=key.id,
                         target_label=key.name, details={"scopes": scopes, "acts_as": owner.username},
                         request=request)
    # The full key is returned only now.
    return {**_serialize(key), "key": raw}


@router.delete("/{key_id}")
def revoke_key(
    request: Request,
    key_id: uuid.UUID,
    current_user: User = Depends(require_feature("api", "ADMIN")),
    db: Session = Depends(get_db),
):
    key = db.scalar(select(ApiKey).where(ApiKey.id == key_id, ApiKey.tenant_id == current_user.tenant_id))
    if key is None:
        raise HTTPException(status_code=404, detail="API key not found.")
    if key.revoked_at is None:
        key.revoked_at = datetime.utcnow()
        db.commit()
        audit_service.record("api_key.revoked", actor=current_user, target_type="api_key", target_id=key.id,
                             target_label=key.name, request=request)
    return _serialize(key)
