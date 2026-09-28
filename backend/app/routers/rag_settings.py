from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.rag_settings import (
    RAGSettingsResponse,
    RAGSettingsUpdate,
)


router = APIRouter(
    prefix="/rag-settings",
    tags=["RAG Settings"],
)


@router.get(
    "/",
    response_model=RAGSettingsResponse,
)
def get_rag_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant = current_user.tenant

    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found.",
        )

    return {
        "retrieval_depth": tenant.retrieval_depth,
        "source_attribution": tenant.source_attribution,
    }


@router.patch(
    "/",
    response_model=RAGSettingsResponse,
)
def update_rag_settings(
    settings: RAGSettingsUpdate,
    current_user: User = Depends(
        require_roles("ADMIN")
    ),
    db: Session = Depends(get_db),
):
    tenant = current_user.tenant

    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found.",
        )

    tenant.retrieval_depth = settings.retrieval_depth
    tenant.source_attribution = settings.source_attribution

    db.commit()
    db.refresh(tenant)

    return {
        "retrieval_depth": tenant.retrieval_depth,
        "source_attribution": tenant.source_attribution,
    }