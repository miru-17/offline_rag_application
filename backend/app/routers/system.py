import shutil

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import CHROMA_PATH, UPLOAD_ROOT
from app.database.connection import get_db
from app.dependencies.auth import require_roles
from app.models.dataset import Dataset
from app.models.document import Document
from app.models.user import User
from app.services import document_ingestion_service as ingestion
from app.services import ollama_service
from app.services.license_service import LicenseService

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/status")
def system_status():
    """Public runtime status used by the login and dashboard pages."""
    status = ollama_service.model_status()
    return {
        "api": "healthy",
        "ollama": status["ollama"],
        "model": ollama_service.MODEL_NAME,
        "model_status": status["model_status"],
        "vector_store": "ChromaDB",
        "deployment": "self-hosted",
        "mode": "offline",
    }


def _disk(path) -> dict:
    try:
        usage = shutil.disk_usage(path if path.exists() else ".")
        return {"free_gb": round(usage.free / 1e9, 1), "total_gb": round(usage.total / 1e9, 1),
                "used_percent": round(100 * usage.used / usage.total, 1)}
    except OSError:
        return {}


@router.get("/health")
def system_health(current_user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    """Admin health page: everything the client's IT team needs at a glance."""
    try:
        db.execute(text("SELECT 1"))
        database = "online"
    except Exception:
        database = "offline"

    tenant_id = current_user.tenant_id
    status_counts = dict(
        db.execute(
            select(Document.status, func.count(Document.id))
            .where(Document.tenant_id == tenant_id)
            .group_by(Document.status)
        ).all()
    )
    license_state = LicenseService.evaluate(db, tenant_id, record_time=False)
    llm = ollama_service.model_status()

    return {
        "database": database,
        "ollama": llm["ollama"],
        "model": ollama_service.MODEL_NAME,
        "model_status": llm["model_status"],
        "ingestion_queue": ingestion.queue_length(),
        "llm_waiting": ollama_service.queue_depth(),
        "documents": status_counts,
        "datasets": db.scalar(select(func.count(Dataset.id)).where(Dataset.tenant_id == tenant_id)),
        "users": db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant_id)),
        "license": {"state": license_state.state, "days_left": license_state.days_left,
                    "message": license_state.message},
        "disk": {"uploads": _disk(UPLOAD_ROOT), "vector_store": _disk(CHROMA_PATH)},
    }
