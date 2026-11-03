"""Who may read which document or dataset. Used by every router."""

from __future__ import annotations

from sqlalchemy import and_, false, or_, select
from sqlalchemy.orm import Session

from app.dependencies.auth import get_user_group_ids, is_admin
from app.models.dataset import Dataset
from app.models.document import Document
from app.models.user import User


def readable_documents_clause(user: User, group_ids: list[str]):
    """
    ADMIN: metadata of every document in the tenant.
    Others: own PRIVATE + TENANT + GROUP documents of their team spaces.
    """
    if is_admin(user):
        return Document.tenant_id == user.tenant_id
    group_clause = (
        and_(Document.visibility == "GROUP", Document.group_id.in_(group_ids)) if group_ids else false()
    )
    return and_(
        Document.tenant_id == user.tenant_id,
        or_(
            Document.visibility == "TENANT",
            and_(Document.visibility == "PRIVATE", Document.user_id == user.id),
            group_clause,
        ),
    )


def content_readable_clause(user: User, group_ids: list[str]):
    """SQL version of content_readable (same rules as retrieval)."""
    group_clause = (
        and_(Document.visibility == "GROUP", Document.group_id.in_(group_ids)) if group_ids else false()
    )
    return and_(
        Document.tenant_id == user.tenant_id,
        or_(
            Document.visibility == "TENANT",
            and_(Document.visibility == "PRIVATE", Document.user_id == user.id),
            group_clause,
        ),
    )


def searchable_documents(db: Session, user: User, group_ids: list[str]) -> list[dict]:
    """id + filename of the ready documents whose text this user may search."""
    rows = db.execute(
        select(Document.id, Document.filename)
        .where(content_readable_clause(user, group_ids), Document.status == "ready")
    ).all()
    return [{"document_id": str(i), "filename": name} for i, name in rows]


def content_readable(user: User, document: Document, group_ids: list[str]) -> bool:
    """
    Reading document CONTENT (summary, compare, extraction) follows the same
    rules as retrieval: admins do not read other users' private documents
    or team spaces they are not part of.
    """
    if document.tenant_id != user.tenant_id:
        return False
    if document.visibility == "TENANT":
        return True
    if document.visibility == "PRIVATE":
        return document.user_id == user.id
    if document.visibility == "GROUP":
        return document.group_id is not None and str(document.group_id) in group_ids
    return False


def get_content_document(db: Session, user: User, document_id) -> Document | None:
    document = db.scalar(select(Document).where(Document.id == document_id, Document.tenant_id == user.tenant_id))
    if document is None or not content_readable(user, document, get_user_group_ids(db, user)):
        return None
    return document


def readable_datasets_clause(user: User):
    return and_(
        Dataset.tenant_id == user.tenant_id,
        or_(Dataset.visibility == "TENANT", Dataset.user_id == user.id),
    )
