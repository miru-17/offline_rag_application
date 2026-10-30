from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import UPLOAD_RATE_LIMIT
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.database.connection import get_db
from app.dependencies.auth import get_current_user, get_user_group_ids, is_admin, require_roles
from app.dependencies.license import require_feature, require_valid_license, require_valid_license_for_editors
from app.models.document import Document
from app.models.group import Group
from app.models.user import User
from app.schemas.document import CompareRequest, DocumentResponse
from app.services import audit_service, document_ingestion_service as ingestion
from app.services.access import get_content_document, readable_documents_clause
from app.services.document_processor import ExtractionError
from app.services.document_service import UploadValidationError, save_uploaded_file
from app.services.document_tools_service import compare_documents, summarize_document, summarize_changes
from app.services.ollama_service import LLMError
from app.services.vector_store import VectorStore

router = APIRouter(prefix="/documents", tags=["Documents"])
logger = get_logger("documents")


def _serialize(document: Document) -> dict:
    data = DocumentResponse.model_validate(document).model_dump()
    data["group_name"] = document.group.name if document.group else None
    data["owner"] = document.user.username if document.user else None
    return data


def purge_document_storage(document: Document) -> None:
    """Remove vectors and the stored file of a document (DB row handled by caller)."""
    VectorStore().delete_document_vectors(
        document_id=str(document.id),
        user_id=str(document.user_id),
        tenant_id=str(document.tenant_id),
        visibility=document.visibility,
    )
    try:
        Path(document.file_path).unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not delete stored file", extra={"fields": {"document_id": str(document.id)}})


# ------------------------------------------------------------
# List / details
# ------------------------------------------------------------

@router.get("/", response_model=list[DocumentResponse])
def get_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group_ids = get_user_group_ids(db, current_user)
    documents = db.scalars(
        select(Document)
        .options(selectinload(Document.group), selectinload(Document.user))
        .where(readable_documents_clause(current_user, group_ids))
        .order_by(Document.created_at.desc())
    ).all()
    return [_serialize(d) for d in documents]


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group_ids = get_user_group_ids(db, current_user)
    document = db.scalar(
        select(Document).where(Document.id == document_id, readable_documents_clause(current_user, group_ids))
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return _serialize(document)


# ------------------------------------------------------------
# Upload (returns immediately; processing runs in the background)
# ------------------------------------------------------------

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(UPLOAD_RATE_LIMIT)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    visibility: str | None = Form(None),
    group_id: UUID | None = Form(None),
    allow_duplicate: bool = Form(False),
    current_user: User = Depends(require_valid_license_for_editors),
    db: Session = Depends(get_db),
):
    """
    ADMIN: TENANT (default), PRIVATE or GROUP.
    USER : PRIVATE (default) or GROUP for team spaces they belong to.
    VIEWER / expired licence: not allowed.
    """

    admin = is_admin(current_user)
    visibility = (visibility or ("TENANT" if admin else "PRIVATE")).upper()

    if visibility not in {"PRIVATE", "TENANT", "GROUP"}:
        raise HTTPException(status_code=400, detail="Visibility must be PRIVATE, TENANT or GROUP.")
    if visibility == "TENANT" and not admin:
        raise HTTPException(status_code=403, detail="Only administrators can share documents with the whole organisation.")

    group = None
    if visibility == "GROUP":
        if group_id is None:
            raise HTTPException(status_code=400, detail="Choose a team space for GROUP documents.")
        group = db.scalar(select(Group).where(Group.id == group_id, Group.tenant_id == current_user.tenant_id))
        if group is None or (not admin and str(group.id) not in get_user_group_ids(db, current_user)):
            raise HTTPException(status_code=403, detail="You are not a member of this team space.")
    elif group_id is not None:
        raise HTTPException(status_code=400, detail="group_id is only used with GROUP visibility.")

    try:
        stored = await save_uploaded_file(file=file, user_id=current_user.id)
    except UploadValidationError as exc:
        audit_service.record("document.upload_rejected", actor=current_user, outcome="failure",
                             target_label=(file.filename or "")[:200], details={"reason": str(exc)}, request=request)
        raise HTTPException(status_code=400, detail=str(exc))

    if not allow_duplicate:
        group_ids = get_user_group_ids(db, current_user)
        existing = db.scalar(
            select(Document).where(
                Document.content_hash == stored["content_hash"],
                readable_documents_clause(current_user, group_ids),
                Document.status != "failed",
            )
        )
        if existing is not None:
            Path(stored["file_path"]).unlink(missing_ok=True)
            raise HTTPException(
                status_code=409,
                detail={
                    "message": f"This file was already uploaded as '{existing.filename}'.",
                    "existing_document_id": str(existing.id),
                },
            )

    document = Document(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        filename=stored["filename"],
        file_type=stored["file_type"],
        file_path=stored["file_path"],
        file_size=stored["file_size"],
        content_hash=stored["content_hash"],
        visibility=visibility,
        group_id=group.id if group else None,
        processed=False,
        status="queued",
    )
    db.add(document)
    try:
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        Path(stored["file_path"]).unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Failed to save document record")

    ingestion.enqueue(document.id)

    audit_service.record("document.uploaded", actor=current_user, target_type="document", target_id=document.id,
                         target_label=document.filename,
                         details={"visibility": visibility, "group": group.name if group else None,
                                  "size": stored["file_size"], "type": stored["file_type"]},
                         request=request)
    return _serialize(document)


@router.post("/{document_id}/retry", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
def retry_document(
    request: Request,
    document_id: UUID,
    current_user: User = Depends(require_valid_license_for_editors),
    db: Session = Depends(get_db),
):
    document = db.scalar(select(Document).where(Document.id == document_id, Document.tenant_id == current_user.tenant_id))
    if document is None or (not is_admin(current_user) and document.user_id != current_user.id):
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.status not in {"failed"}:
        raise HTTPException(status_code=409, detail="Only failed documents can be retried.")

    document.status = "queued"
    document.error_message = None
    db.commit()
    ingestion.enqueue(document.id)
    audit_service.record("document.retried", actor=current_user, target_type="document", target_id=document.id,
                         target_label=document.filename, request=request)
    return _serialize(document)


# ------------------------------------------------------------
# Delete
# ------------------------------------------------------------

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    request: Request,
    document_id: UUID,
    current_user: User = Depends(require_roles("ADMIN", "USER")),
    db: Session = Depends(get_db),
):
    document = db.scalar(select(Document).where(Document.id == document_id, Document.tenant_id == current_user.tenant_id))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    if not is_admin(current_user) and document.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can delete only your own documents")

    if document.status in {"queued", "processing"}:
        raise HTTPException(status_code=409, detail="The document is still being processed. Try again shortly.")

    try:
        purge_document_storage(document)
    except Exception:
        logger.exception("Vector delete failed", extra={"fields": {"document_id": str(document.id)}})
        raise HTTPException(status_code=500, detail="Failed to delete document vectors")

    label = document.filename
    db.delete(document)
    db.commit()

    audit_service.record("document.deleted", actor=current_user, target_type="document", target_id=document_id,
                         target_label=label, request=request)
    return None


# ------------------------------------------------------------
# Summary and comparison
# ------------------------------------------------------------

def _ready_content_document(db: Session, user: User, document_id: UUID) -> Document:
    document = get_content_document(db, user, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.status != "ready":
        raise HTTPException(status_code=409, detail="The document is not ready yet.")
    return document


@router.post("/{document_id}/summary")
async def document_summary(
    request: Request,
    document_id: UUID,
    current_user: User = Depends(require_valid_license),
    db: Session = Depends(get_db),
):
    document = _ready_content_document(db, current_user, document_id)
    try:
        result = await run_in_threadpool(summarize_document, document.file_path, document.file_type, document.filename)
    except (ExtractionError, LLMError) as exc:
        raise HTTPException(status_code=503 if isinstance(exc, LLMError) else 422, detail=str(exc))

    audit_service.record("document.summarized", actor=current_user, target_type="document",
                         target_id=document.id, target_label=document.filename, request=request)
    return {"document_id": str(document.id), "filename": document.filename, **result}


@router.post("/compare")
async def compare(
    request: Request,
    payload: CompareRequest,
    current_user: User = Depends(require_feature("compare")),
    db: Session = Depends(get_db),
):
    if payload.document_a == payload.document_b:
        raise HTTPException(status_code=400, detail="Choose two different documents.")

    doc_a = _ready_content_document(db, current_user, payload.document_a)
    doc_b = _ready_content_document(db, current_user, payload.document_b)

    try:
        result = await run_in_threadpool(compare_documents, doc_a.file_path, doc_a.file_type,
                                         doc_b.file_path, doc_b.file_type)
        summary = None
        if payload.summarize:
            summary = await run_in_threadpool(summarize_changes, result, doc_a.filename, doc_b.filename)
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except LLMError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    audit_service.record("document.compared", actor=current_user, target_type="document", target_id=doc_a.id,
                         target_label=f"{doc_a.filename} vs {doc_b.filename}", request=request)
    return {
        "document_a": {"id": str(doc_a.id), "filename": doc_a.filename},
        "document_b": {"id": str(doc_b.id), "filename": doc_b.filename},
        "summary": summary,
        **result,
    }
