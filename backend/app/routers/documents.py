from pathlib import Path
from uuid import UUID

import mimetypes

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
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
from app.models.dataset import Dataset
from app.services import audit_service, document_ingestion_service as ingestion, table_service
from app.services.analytics_service import AnalyticsError, load_dataset
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
    data["uploaded_at"] = document.created_at
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
def get_documents(
    include_history: bool = Query(False, description="Also list superseded older versions"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group_ids = get_user_group_ids(db, current_user)
    stmt = (
        select(Document)
        .options(selectinload(Document.group), selectinload(Document.user))
        .where(readable_documents_clause(current_user, group_ids))
        .order_by(Document.created_at.desc())
    )
    if not include_history:
        stmt = stmt.where(Document.status != "superseded")
    return [_serialize(d) for d in db.scalars(stmt).all()]


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
    replace_document_id: UUID | None = Form(None),
    current_user: User = Depends(require_valid_license_for_editors),
    db: Session = Depends(get_db),
):
    """
    ADMIN: TENANT (default), PRIVATE or GROUP.
    USER : PRIVATE (default) or GROUP for team spaces they belong to.
    VIEWER / expired licence: not allowed.
    """

    admin = is_admin(current_user)

    previous = None
    if replace_document_id is not None:
        # New version: inherits sharing from the document it replaces.
        previous = db.scalar(select(Document).where(Document.id == replace_document_id,
                                                    Document.tenant_id == current_user.tenant_id))
        if previous is None or (not admin and previous.user_id != current_user.id):
            raise HTTPException(status_code=404, detail="Document to replace not found.")
        if previous.status in {"queued", "processing"}:
            raise HTTPException(status_code=409, detail="The current version is still being processed.")
        if previous.status == "superseded":
            raise HTTPException(status_code=409, detail="Upload the new version against the latest version.")
        visibility = previous.visibility
        group_id = previous.group_id

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
                Document.status.not_in(["failed", "superseded"]),
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
        version=(previous.version + 1) if previous else 1,
        replaces_document_id=previous.id if previous else None,
    )
    db.add(document)
    db.flush()
    document.version_group_id = previous.version_group_id or previous.id if previous else document.id
    if previous is not None and previous.version_group_id is None:
        previous.version_group_id = previous.id
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
                                  "size": stored["file_size"], "type": stored["file_type"],
                                  "version": document.version},
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

    if document.legal_hold:
        raise HTTPException(status_code=409, detail="This document is under legal hold and cannot be deleted.")

    # Deleting a document removes all of its versions.
    versions = [document]
    if document.version_group_id is not None:
        versions = db.scalars(select(Document).where(Document.version_group_id == document.version_group_id,
                                                     Document.tenant_id == current_user.tenant_id)).all()
    if any(v.status in {"queued", "processing"} for v in versions):
        raise HTTPException(status_code=409, detail="The document is still being processed. Try again shortly.")
    if any(v.legal_hold for v in versions):
        raise HTTPException(status_code=409, detail="A version of this document is under legal hold.")

    try:
        for version in versions:
            purge_document_storage(version)
    except Exception:
        logger.exception("Vector delete failed", extra={"fields": {"document_id": str(document.id)}})
        raise HTTPException(status_code=500, detail="Failed to delete document vectors")

    label = document.filename
    for version in versions:
        db.delete(version)
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


# ------------------------------------------------------------
# Original file (open at the cited page), versions, legal hold
# ------------------------------------------------------------

@router.get("/{document_id}/file")
def download_file(
    request: Request,
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stream the original file to someone allowed to read its content. The PDF
    viewer can then open it at the cited page (#page=N).
    """
    document = get_content_document(db, current_user, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    path = Path(document.file_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="The stored file is missing.")
    media_type = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
    }.get(document.file_type) or mimetypes.guess_type(document.filename)[0] or "application/octet-stream"
    inline = document.file_type in {"pdf", "png", "jpg"}
    audit_service.record("document.viewed", actor=current_user, target_type="document", target_id=document.id,
                         target_label=document.filename, request=request)
    return FileResponse(
        path,
        media_type=media_type,
        filename=document.filename,
        content_disposition_type="inline" if inline else "attachment",
        headers={"Content-Security-Policy": "sandbox", "Cache-Control": "private, no-store"},
    )


@router.get("/{document_id}/versions")
def list_versions(document_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group_ids = get_user_group_ids(db, current_user)
    document = db.scalar(select(Document).where(Document.id == document_id,
                                                readable_documents_clause(current_user, group_ids)))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.version_group_id is None:
        return [_serialize(document)]
    versions = db.scalars(
        select(Document)
        .options(selectinload(Document.group), selectinload(Document.user))
        .where(Document.version_group_id == document.version_group_id,
               readable_documents_clause(current_user, group_ids))
        .order_by(Document.version.desc())
    ).all()
    return [_serialize(v) for v in versions]


@router.patch("/{document_id}/legal-hold")
def set_legal_hold(
    request: Request,
    document_id: UUID,
    hold: bool = Query(...),
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    """Admins can protect a document from deletion and retention clean-up."""
    document = db.scalar(select(Document).where(Document.id == document_id, Document.tenant_id == current_user.tenant_id))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    document.legal_hold = hold
    db.commit()
    audit_service.record("document.legal_hold", actor=current_user, target_type="document", target_id=document.id,
                         target_label=document.filename, details={"hold": hold}, request=request)
    return _serialize(document)


# ------------------------------------------------------------
# Tables in Word / Excel -> Data Dashboard
# ------------------------------------------------------------

@router.get("/{document_id}/tables")
async def document_tables(document_id: UUID, current_user: User = Depends(require_feature("analytics")),
                          db: Session = Depends(get_db)):
    document = _ready_content_document(db, current_user, document_id)
    try:
        tables = await run_in_threadpool(table_service.list_tables, document.file_path, document.file_type)
    except AnalyticsError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"document_id": str(document.id), "filename": document.filename, "tables": table_service.summarise(tables)}


@router.post("/{document_id}/tables/{table_index}/dataset", status_code=status.HTTP_201_CREATED)
async def table_to_dataset(
    request: Request,
    document_id: UUID,
    table_index: int,
    current_user: User = Depends(require_feature("analytics", "ADMIN", "USER")),
    db: Session = Depends(get_db),
):
    document = _ready_content_document(db, current_user, document_id)
    try:
        tables = await run_in_threadpool(table_service.list_tables, document.file_path, document.file_type)
        table = next((t for t in tables if t["index"] == table_index), None)
        if table is None:
            raise HTTPException(status_code=404, detail="Table not found.")
        path = await run_in_threadpool(table_service.write_csv, current_user.id, table)
        frame, columns = await run_in_threadpool(load_dataset, path, "csv")
    except AnalyticsError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    dataset = Dataset(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        name=f"{document.filename} – {table['name']}",
        file_path=path,
        file_type="csv",
        file_size=Path(path).stat().st_size,
        row_count=int(len(frame)),
        columns=columns,
        visibility="PRIVATE",
        origin="document",
    )
    db.add(dataset)
    db.commit()
    audit_service.record("dataset.from_document", actor=current_user, target_type="dataset", target_id=dataset.id,
                         target_label=dataset.name, request=request)
    return {"dataset_id": str(dataset.id), "name": dataset.name, "rows": dataset.row_count}
