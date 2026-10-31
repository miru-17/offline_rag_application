import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.license import require_feature
from app.models.report import Report
from app.models.user import User
from app.services import audit_service, report_service

router = APIRouter(prefix="/reports", tags=["Reports"])


class ScheduleUpdate(BaseModel):
    schedule: str


def _serialize(report: Report) -> dict:
    return {
        "id": str(report.id),
        "kind": report.kind,
        "period_start": report.period_start,
        "period_end": report.period_end,
        "created_at": report.created_at,
        "file_size": report.file_size,
    }


@router.get("/")
def list_reports(current_user: User = Depends(require_feature("insights", "ADMIN")), db: Session = Depends(get_db)):
    reports = db.scalars(select(Report).where(Report.tenant_id == current_user.tenant_id)
                         .order_by(Report.created_at.desc()).limit(200)).all()
    return {"schedule": current_user.tenant.report_schedule, "reports": [_serialize(r) for r in reports]}


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_report(
    request: Request,
    days: int = Query(7, ge=1, le=366),
    current_user: User = Depends(require_feature("insights", "ADMIN")),
    db: Session = Depends(get_db),
):
    report = await run_in_threadpool(report_service.generate, db, current_user.tenant, days, "manual", current_user.id)
    audit_service.record("report.generated", actor=current_user, target_type="report", target_id=report.id,
                         details={"kind": "manual", "days": days}, request=request)
    return _serialize(report)


@router.patch("/schedule")
def set_schedule(
    request: Request,
    payload: ScheduleUpdate,
    current_user: User = Depends(require_feature("insights", "ADMIN")),
    db: Session = Depends(get_db),
):
    if payload.schedule not in {"weekly", "off"}:
        raise HTTPException(status_code=400, detail="Schedule must be 'weekly' or 'off'.")
    tenant = current_user.tenant
    tenant.report_schedule = payload.schedule
    db.commit()
    audit_service.record("settings.updated", actor=current_user, target_type="tenant", target_id=tenant.id,
                         details={"report_schedule": payload.schedule}, request=request)
    return {"schedule": tenant.report_schedule}


def _get(db: Session, user: User, report_id: uuid.UUID) -> Report:
    report = db.scalar(select(Report).where(Report.id == report_id, Report.tenant_id == user.tenant_id))
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    return report


@router.get("/{report_id}/file")
def download_report(
    report_id: uuid.UUID,
    current_user: User = Depends(require_feature("insights", "ADMIN")),
    db: Session = Depends(get_db),
):
    report = _get(db, current_user, report_id)
    path = Path(report.file_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="The report file is missing.")
    return FileResponse(path, media_type="application/pdf",
                        filename=f"ragentis-report-{report.period_end:%Y-%m-%d}.pdf",
                        headers={"Cache-Control": "private, no-store"})


@router.delete("/{report_id}")
def delete_report(
    request: Request,
    report_id: uuid.UUID,
    current_user: User = Depends(require_feature("insights", "ADMIN")),
    db: Session = Depends(get_db),
):
    report = _get(db, current_user, report_id)
    Path(report.file_path).unlink(missing_ok=True)
    db.delete(report)
    db.commit()
    audit_service.record("report.deleted", actor=current_user, target_type="report", target_id=report_id,
                         request=request)
    return {"deleted": True}
