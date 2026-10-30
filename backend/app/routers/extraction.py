import csv
import io
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.license import require_feature
from app.models.extraction_job import ExtractionJob
from app.models.user import User
from app.services import audit_service, extraction_service
from app.services.access import get_content_document
from app.services.csv_safety import safe_cell

router = APIRouter(prefix="/extraction", tags=["Structured extraction"])

editor_access = require_feature("extraction", "ADMIN", "USER")

MAX_DOCUMENTS = 50
MAX_FIELDS = 15


class FieldSpec(BaseModel):
    name: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z][A-Za-z0-9 _-]*$")
    description: str | None = Field(None, max_length=200)


class ExtractionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    document_ids: list[uuid.UUID] = Field(min_length=1, max_length=MAX_DOCUMENTS)
    fields: list[FieldSpec] = Field(min_length=1, max_length=MAX_FIELDS)

    @field_validator("fields")
    @classmethod
    def unique_names(cls, fields):
        names = [f.name.strip().lower() for f in fields]
        if len(names) != len(set(names)):
            raise ValueError("Field names must be unique.")
        return fields


def _serialize(job: ExtractionJob, full: bool = False) -> dict:
    data = {
        "id": str(job.id),
        "name": job.name,
        "status": job.status,
        "fields": job.fields,
        "document_count": len(job.document_ids),
        "processed_count": job.processed_count,
        "error_message": job.error_message,
        "dataset_id": str(job.dataset_id) if job.dataset_id else None,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
    }
    if full:
        data["results"] = job.results or []
    return data


def _get_job(db: Session, user: User, job_id: uuid.UUID) -> ExtractionJob:
    job = db.scalar(select(ExtractionJob).where(ExtractionJob.id == job_id, ExtractionJob.user_id == user.id,
                                                ExtractionJob.tenant_id == user.tenant_id))
    if job is None:
        raise HTTPException(status_code=404, detail="Extraction not found.")
    return job


@router.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
def create_job(request: Request, payload: ExtractionCreate, current_user: User = Depends(editor_access),
               db: Session = Depends(get_db)):
    document_ids = list(dict.fromkeys(payload.document_ids))
    for document_id in document_ids:
        document = get_content_document(db, current_user, document_id)
        if document is None:
            raise HTTPException(status_code=404, detail="One of the selected documents was not found.")
        if document.status != "ready":
            raise HTTPException(status_code=409, detail=f"'{document.filename}' is not ready yet.")

    job = ExtractionJob(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        name=payload.name.strip(),
        fields=[f.model_dump() for f in payload.fields],
        document_ids=[str(d) for d in document_ids],
        status="queued",
        processed_count=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    extraction_service.enqueue(job.id)

    audit_service.record("extraction.started", actor=current_user, target_type="extraction", target_id=job.id,
                         target_label=job.name,
                         details={"documents": len(document_ids), "fields": [f.name for f in payload.fields]},
                         request=request)
    return _serialize(job)


@router.get("/jobs")
def list_jobs(current_user: User = Depends(editor_access), db: Session = Depends(get_db)):
    jobs = db.scalars(select(ExtractionJob).where(ExtractionJob.user_id == current_user.id,
                                                  ExtractionJob.tenant_id == current_user.tenant_id)
                      .order_by(ExtractionJob.created_at.desc()).limit(100)).all()
    return [_serialize(j) for j in jobs]


@router.get("/jobs/{job_id}")
def get_job(job_id: uuid.UUID, current_user: User = Depends(editor_access), db: Session = Depends(get_db)):
    return _serialize(_get_job(db, current_user, job_id), full=True)


@router.get("/jobs/{job_id}/export")
def export_job(request: Request, job_id: uuid.UUID, current_user: User = Depends(editor_access),
               db: Session = Depends(get_db)):
    job = _get_job(db, current_user, job_id)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Document", "Status"] + [safe_cell(f["name"]) for f in job.fields])
    for row in job.results or []:
        writer.writerow([safe_cell(row["filename"]), row["status"]] +
                        [safe_cell(row["values"].get(f["name"])) for f in job.fields])
    audit_service.record("extraction.exported", actor=current_user, target_type="extraction", target_id=job.id,
                         target_label=job.name, request=request)
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=extraction.csv"})


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: uuid.UUID, current_user: User = Depends(editor_access), db: Session = Depends(get_db)):
    job = _get_job(db, current_user, job_id)
    if job.status in {"queued", "processing"}:
        raise HTTPException(status_code=409, detail="The extraction is still running.")
    db.delete(job)
    db.commit()
    return None
