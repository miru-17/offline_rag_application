import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import require_roles
from app.models.audit_event import AuditEvent
from app.models.user import User
from app.services.csv_safety import safe_cell

router = APIRouter(prefix="/audit", tags=["Audit"])


def _filtered(current_user: User, action: str | None, outcome: str | None, actor: str | None,
              date_from: datetime | None, date_to: datetime | None):
    stmt = select(AuditEvent).where(AuditEvent.tenant_id == current_user.tenant_id)
    if action:
        stmt = stmt.where(AuditEvent.action.like(f"{action}%"))
    if outcome:
        stmt = stmt.where(AuditEvent.outcome == outcome)
    if actor:
        stmt = stmt.where(AuditEvent.actor_username.ilike(f"%{actor}%"))
    if date_from:
        stmt = stmt.where(AuditEvent.created_at >= date_from)
    if date_to:
        stmt = stmt.where(AuditEvent.created_at <= date_to)
    return stmt


def _row(event: AuditEvent) -> dict:
    return {
        "id": str(event.id),
        "created_at": event.created_at,
        "actor": event.actor_username,
        "action": event.action,
        "outcome": event.outcome,
        "target_type": event.target_type,
        "target_id": event.target_id,
        "target": event.target_label,
        "details": event.details,
        "ip_address": event.ip_address,
    }


@router.get("/")
def list_events(
    action: str | None = Query(None, max_length=60),
    outcome: str | None = Query(None, max_length=20),
    actor: str | None = Query(None, max_length=100),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    stmt = _filtered(current_user, action, outcome, actor, date_from, date_to)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    events = db.scalars(stmt.order_by(AuditEvent.created_at.desc()).limit(limit).offset(offset)).all()
    return {"total": total, "items": [_row(e) for e in events]}


@router.get("/export")
def export_events(
    action: str | None = Query(None, max_length=60),
    outcome: str | None = Query(None, max_length=20),
    actor: str | None = Query(None, max_length=100),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    stmt = _filtered(current_user, action, outcome, actor, date_from, date_to)
    events = db.scalars(stmt.order_by(AuditEvent.created_at.desc()).limit(50000)).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["time", "actor", "action", "outcome", "target", "ip", "details"])
    for e in events:
        writer.writerow([safe_cell(v) for v in (e.created_at.isoformat(), e.actor_username, e.action,
                                                e.outcome, e.target_label, e.ip_address, e.details)])
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit-log.csv"},
    )
