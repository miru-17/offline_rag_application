import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database.connection import get_db
from app.dependencies.auth import get_current_user, is_admin
from app.dependencies.license import require_feature
from app.models.document import Document
from app.models.group import Group, GroupMember
from app.models.user import User
from app.services import audit_service

router = APIRouter(prefix="/groups", tags=["Team spaces"])


class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(None, max_length=255)


class MemberChange(BaseModel):
    user_id: uuid.UUID


def _serialize(group: Group, document_count: int = 0) -> dict:
    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
        "members": sorted(
            ({"id": str(m.user.id), "username": m.user.username} for m in group.members if m.user),
            key=lambda m: m["username"],
        ),
        "document_count": document_count,
        "created_at": group.created_at,
    }


def _get_group(db: Session, group_id: uuid.UUID, user: User) -> Group:
    group = db.scalar(
        select(Group)
        .options(selectinload(Group.members).selectinload(GroupMember.user))
        .where(Group.id == group_id, Group.tenant_id == user.tenant_id)
    )
    if group is None:
        raise HTTPException(status_code=404, detail="Team space not found.")
    return group


@router.get("/")
def list_groups(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admins see every team space; others see the spaces they belong to."""
    stmt = select(Group).options(selectinload(Group.members).selectinload(GroupMember.user)).where(
        Group.tenant_id == current_user.tenant_id
    )
    if not is_admin(current_user):
        stmt = stmt.join(GroupMember, GroupMember.group_id == Group.id).where(GroupMember.user_id == current_user.id)
    groups = db.scalars(stmt.order_by(Group.name)).unique().all()
    counts = dict(
        db.execute(
            select(Document.group_id, func.count(Document.id))
            .where(Document.tenant_id == current_user.tenant_id, Document.group_id.is_not(None))
            .group_by(Document.group_id)
        ).all()
    )
    return [_serialize(g, counts.get(g.id, 0)) for g in groups]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_group(
    request: Request,
    payload: GroupCreate,
    current_user: User = Depends(require_feature("groups", "ADMIN")),
    db: Session = Depends(get_db),
):
    group = Group(tenant_id=current_user.tenant_id, name=payload.name.strip(), description=payload.description)
    db.add(group)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A team space with this name already exists.")
    audit_service.record("group.created", actor=current_user, target_type="group", target_id=group.id,
                         target_label=group.name, request=request)
    return _serialize(_get_group(db, group.id, current_user))


@router.post("/{group_id}/members")
def add_member(
    request: Request,
    group_id: uuid.UUID,
    payload: MemberChange,
    current_user: User = Depends(require_feature("groups", "ADMIN")),
    db: Session = Depends(get_db),
):
    group = _get_group(db, group_id, current_user)
    user = db.scalar(select(User).where(User.id == payload.user_id, User.tenant_id == current_user.tenant_id))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if not any(m.user_id == user.id for m in group.members):
        db.add(GroupMember(group_id=group.id, user_id=user.id))
        db.commit()
        audit_service.record("group.member_added", actor=current_user, target_type="group", target_id=group.id,
                             target_label=group.name, details={"user": user.username}, request=request)
    db.expire_all()
    return _serialize(_get_group(db, group_id, current_user))


@router.delete("/{group_id}/members/{user_id}")
def remove_member(
    request: Request,
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(require_feature("groups", "ADMIN")),
    db: Session = Depends(get_db),
):
    group = _get_group(db, group_id, current_user)
    membership = next((m for m in group.members if m.user_id == user_id), None)
    if membership is None:
        raise HTTPException(status_code=404, detail="User is not a member of this team space.")
    username = membership.user.username if membership.user else str(user_id)
    db.delete(membership)
    db.commit()
    audit_service.record("group.member_removed", actor=current_user, target_type="group", target_id=group.id,
                         target_label=group.name, details={"user": username}, request=request)
    db.expire_all()
    return _serialize(_get_group(db, group_id, current_user))


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    request: Request,
    group_id: uuid.UUID,
    current_user: User = Depends(require_feature("groups", "ADMIN")),
    db: Session = Depends(get_db),
):
    group = _get_group(db, group_id, current_user)
    in_use = db.scalar(select(func.count(Document.id)).where(Document.group_id == group.id))
    if in_use:
        raise HTTPException(status_code=409, detail="Delete or move this team space's documents first.")
    name = group.name
    db.delete(group)
    db.commit()
    audit_service.record("group.deleted", actor=current_user, target_type="group", target_id=group_id,
                         target_label=name, request=request)
    return None
