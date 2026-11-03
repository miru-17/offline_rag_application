from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.security import generate_temporary_password, hash_password
from app.database.connection import get_db
from app.dependencies.auth import require_roles
from app.models.group import GroupMember
from app.models.role import Role
from app.models.user import User
from app.routers.auth import _enforce_user_limit
from app.schemas.users import (
    CreateUserRequest,
    ManagedUserResponse,
    UpdateUserRoleRequest,
    UpdateUserStatusRequest,
)
from app.services import audit_service, mfa_service, session_service

router = APIRouter(prefix="/users", tags=["Users"])


def _serialize(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "tenant_id": user.tenant_id,
        "role": user.role.name,
        "is_active": user.is_active,
        "groups": sorted(m.group.name for m in user.group_memberships if m.group),
        "last_login_at": user.last_login_at,
        "mfa_enabled": user.mfa_enabled,
        "auth_source": user.auth_source,
        "must_change_password": user.must_change_password,
        "locked": bool(user.locked_until and user.locked_until > datetime.utcnow()),
    }


def _get_tenant_user(db: Session, user_id: uuid.UUID, admin: User) -> User:
    user = db.scalar(
        select(User)
        .options(selectinload(User.group_memberships).selectinload(GroupMember.group))
        .where(User.id == user_id, User.tenant_id == admin.tenant_id)
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@router.get("/", response_model=list[ManagedUserResponse])
def get_users(current_user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    users = db.scalars(
        select(User)
        .options(selectinload(User.group_memberships).selectinload(GroupMember.group))
        .where(User.tenant_id == current_user.tenant_id)
        .order_by(User.username.asc())
    ).all()
    return [_serialize(user) for user in users]


@router.post("/", response_model=ManagedUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    request: Request,
    payload: CreateUserRequest,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    if db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status_code=400, detail="Username already exists.")
    if db.scalar(select(User).where(func.lower(User.email) == payload.email.lower())):
        raise HTTPException(status_code=400, detail="Email already exists.")

    role = db.scalar(select(Role).where(Role.name == payload.role.upper()))
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role.")

    _enforce_user_limit(db, current_user.tenant_id)

    new_user = User(
        id=uuid.uuid4(),
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        tenant_id=current_user.tenant_id,
        role_id=role.id,
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username or email already exists.")

    audit_service.record("user.created", actor=current_user, target_type="user", target_id=new_user.id,
                         target_label=new_user.username, details={"role": role.name}, request=request)
    return _serialize(_get_tenant_user(db, new_user.id, current_user))


@router.patch("/{user_id}/role", response_model=ManagedUserResponse)
def update_user_role(
    request: Request,
    user_id: uuid.UUID,
    payload: UpdateUserRoleRequest,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role.")

    user = _get_tenant_user(db, user_id, current_user)
    role = db.scalar(select(Role).where(Role.name == payload.role.upper()))
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role.")

    old_role = user.role.name
    user.role_id = role.id
    db.commit()
    db.refresh(user)

    audit_service.record("user.role_changed", actor=current_user, target_type="user", target_id=user.id,
                         target_label=user.username, details={"from": old_role, "to": role.name}, request=request)
    return _serialize(user)


@router.patch("/{user_id}/status", response_model=ManagedUserResponse)
def update_user_status(
    request: Request,
    user_id: uuid.UUID,
    payload: UpdateUserStatusRequest,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    """Deactivate (or re-activate) an account. Deactivation ends its sessions."""

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate yourself.")

    user = _get_tenant_user(db, user_id, current_user)
    if user.is_active == payload.is_active:
        return _serialize(user)

    user.is_active = payload.is_active
    if not payload.is_active:
        user.token_version = (user.token_version or 0) + 1
        session_service.revoke_all_for_user(db, user.id)
    db.commit()
    db.refresh(user)

    audit_service.record("user.activated" if payload.is_active else "user.deactivated", actor=current_user,
                         target_type="user", target_id=user.id, target_label=user.username, request=request)
    return _serialize(user)


@router.post("/{user_id}/reset-password")
def reset_password(
    request: Request,
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    """
    Give a user a one-time temporary password. They must choose a new one at
    their next sign-in; all their current sessions end now. The temporary
    password is shown once and never stored in readable form.
    """
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Use Settings to change your own password.")
    user = _get_tenant_user(db, user_id, current_user)
    if user.auth_source == "ldap":
        raise HTTPException(status_code=400, detail="This user's password is managed in Active Directory.")

    temporary = generate_temporary_password()
    user.password_hash = hash_password(temporary)
    user.must_change_password = True
    user.failed_login_count = 0
    user.locked_until = None
    user.token_version = (user.token_version or 0) + 1
    session_service.revoke_all_for_user(db, user.id)
    db.commit()

    audit_service.record("user.password_reset", actor=current_user, target_type="user", target_id=user.id,
                         target_label=user.username, request=request)
    return {"username": user.username, "temporary_password": temporary}


@router.post("/{user_id}/unlock", response_model=ManagedUserResponse)
def unlock_user(
    request: Request,
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    """End a lockout caused by repeated wrong passwords or codes."""
    user = _get_tenant_user(db, user_id, current_user)
    user.failed_login_count = 0
    user.locked_until = None
    db.commit()
    db.refresh(user)
    audit_service.record("user.unlocked", actor=current_user, target_type="user", target_id=user.id,
                         target_label=user.username, request=request)
    return _serialize(user)


@router.post("/{user_id}/mfa/reset", response_model=ManagedUserResponse)
def reset_mfa(
    request: Request,
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    """Turn off two-step login for a user who lost their phone."""
    user = _get_tenant_user(db, user_id, current_user)
    mfa_service.disable(user)
    user.token_version = (user.token_version or 0) + 1
    session_service.revoke_all_for_user(db, user.id)
    db.commit()
    db.refresh(user)
    audit_service.record("user.mfa_reset", actor=current_user, target_type="user", target_id=user.id,
                         target_label=user.username, request=request)
    return _serialize(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    request: Request,
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete yourself.")

    user = _get_tenant_user(db, user_id, current_user)
    label = user.username

    # Remove the user's indexed vectors and stored files, not only DB rows.
    from app.models.dataset import Dataset
    from app.models.document import Document
    from app.routers.documents import purge_document_storage
    from pathlib import Path

    documents = db.scalars(select(Document).where(Document.user_id == user.id)).all()
    if any(d.status in {"queued", "processing"} for d in documents):
        raise HTTPException(status_code=409, detail="This user's documents are still being processed. Try again shortly.")
    for document in documents:
        purge_document_storage(document)
    for dataset in db.scalars(select(Dataset).where(Dataset.user_id == user.id)).all():
        Path(dataset.file_path).unlink(missing_ok=True)

    db.delete(user)
    db.commit()

    audit_service.record("user.deleted", actor=current_user, target_type="user", target_id=user_id,
                         target_label=label, request=request)
    return None
