from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.rag_settings import RAGSettingsResponse, RAGSettingsUpdate
from app.services import audit_service

router = APIRouter(prefix="/rag-settings", tags=["RAG Settings"])


def _settings(tenant) -> dict:
    return {
        "retrieval_depth": tenant.retrieval_depth,
        "source_attribution": tenant.source_attribution,
        "pii_mode": tenant.pii_mode,
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

    tenant.retrieval_depth = settings.retrieval_depth
    tenant.source_attribution = settings.source_attribution
    if settings.pii_mode is not None:
        tenant.pii_mode = settings.pii_mode
    db.commit()
    db.refresh(tenant)

    after = _settings(tenant)
    changed = {k: f"{before[k]} -> {after[k]}" for k in after if before[k] != after[k]}
    audit_service.record("settings.updated", actor=current_user, target_type="tenant", target_id=tenant.id,
                         target_label=tenant.name, details=changed, request=request)
    return after
