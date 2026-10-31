from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import HYBRID_SEARCH
from app.database.connection import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.document import Document
from app.models.user import User
from app.schemas.rag_settings import RAGSettingsResponse, RAGSettingsUpdate
from app.services import audit_service, document_ingestion_service as ingestion, ollama_service, retention_service
from app.services.embedding_service import MODEL_NAME as EMBEDDING_MODEL
from app.services.prompt_builder import LANGUAGES

router = APIRouter(prefix="/rag-settings", tags=["RAG Settings"])

RETENTION_FIELDS = ("conversation_retention_days", "audit_retention_days", "document_retention_days")


def _settings(tenant) -> dict:
    return {
        "retrieval_depth": tenant.retrieval_depth,
        "source_attribution": tenant.source_attribution,
        "pii_mode": tenant.pii_mode,
        "hybrid_search": bool(tenant.hybrid_search),
        "answer_language": tenant.answer_language or "auto",
        "llm_model": ollama_service.model_for_tenant(tenant),
        "conversation_retention_days": tenant.conversation_retention_days,
        "audit_retention_days": tenant.audit_retention_days,
        "document_retention_days": tenant.document_retention_days,
    }


@router.get("/", response_model=RAGSettingsResponse)
def get_rag_settings(current_user: User = Depends(get_current_user)):
    return _settings(current_user.tenant)


@router.patch("/", response_model=RAGSettingsResponse)
def update_rag_settings(
    request: Request,
    settings: RAGSettingsUpdate,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    tenant = current_user.tenant
    before = _settings(tenant)
    sent = settings.model_fields_set

    if "llm_model" in sent and settings.llm_model is not None:
        if settings.llm_model not in ollama_service.allowed_models():
            raise HTTPException(status_code=400, detail="This model is not offered on this server.")
        tenant.llm_model = None if settings.llm_model == ollama_service.MODEL_NAME else settings.llm_model

    for name in ("retrieval_depth", "source_attribution", "pii_mode", "hybrid_search", "answer_language"):
        value = getattr(settings, name)
        if name in sent and value is not None:
            setattr(tenant, name, value)
    for name in RETENTION_FIELDS:
        if name in sent:
            setattr(tenant, name, getattr(settings, name))

    db.commit()
    db.refresh(tenant)

    after = _settings(tenant)
    changed = {k: f"{before[k]} -> {after[k]}" for k in after if before[k] != after[k]}
    audit_service.record("settings.updated", actor=current_user, target_type="tenant", target_id=tenant.id,
                         target_label=tenant.name, details=changed, request=request)
    return after


@router.get("/options")
def settings_options(current_user: User = Depends(get_current_user)):
    """Choices for the settings page: models on this server, languages, search."""
    installed = ollama_service.installed_models()
    return {
        "models": [
            {"name": name, "default": name == ollama_service.MODEL_NAME,
             "installed": None if installed is None else name in installed}
            for name in ollama_service.allowed_models()
        ],
        "languages": [{"code": "auto", "name": "Same as the question"}]
                     + [{"code": c, "name": n} for c, n in LANGUAGES.items()],
        "hybrid_search_available": HYBRID_SEARCH,
        "embedding_model": EMBEDDING_MODEL,
        "retention_minimum_days": retention_service.MIN_DAYS,
    }


@router.post("/retention/run")
def run_retention_now(
    request: Request,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    """Apply this organisation's retention rules now."""
    removed = retention_service.apply(db, current_user.tenant)
    audit_service.record("retention.run_requested", actor=current_user, target_type="tenant",
                         target_id=current_user.tenant_id, details=removed, request=request)
    return removed


@router.post("/reindex")
async def reindex_documents(
    request: Request,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    """
    Re-read every ready document of this organisation (for example after
    switching to the multilingual embedding model). Each document is
    refreshed in the background and is unavailable for answers for the few
    seconds it is being re-read.
    """
    ids = db.scalars(select(Document.id).where(Document.tenant_id == current_user.tenant_id,
                                               Document.status.in_(["ready", "failed"]))).all()
    for document_id in ids:
        document = db.get(Document, document_id)
        document.status = "queued"
    db.commit()
    for document_id in ids:
        await run_in_threadpool(ingestion.enqueue, document_id)
    audit_service.record("documents.reindex", actor=current_user, target_type="tenant",
                         target_id=current_user.tenant_id, details={"documents": len(ids)}, request=request)
    return {"queued": len(ids), "embedding_model": EMBEDDING_MODEL}
