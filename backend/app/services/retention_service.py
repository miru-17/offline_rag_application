"""
Data retention: automatic clean-up chosen by each organisation's admin.

  conversation_retention_days  chats not used for N days are deleted
  audit_retention_days         audit entries older than N days are deleted
  document_retention_days      documents uploaded more than N days ago are
                               deleted (file + vectors), all versions together

Empty = keep forever (the default). Documents under legal hold, and every
version of them, are never deleted. Each run is written to the audit log
with counts only.
"""

from __future__ import annotations

import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.core.config import RETENTION_INTERVAL_HOURS
from app.core.logging import get_logger
from app.database.connection import SessionLocal
from app.models.audit_event import AuditEvent
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.tenant import Tenant
from app.services import audit_service

logger = get_logger("retention")

MIN_DAYS = {"conversation_retention_days": 1, "audit_retention_days": 30, "document_retention_days": 30}


def _utc_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _purge_document_files(document: Document) -> None:
    # Imported here to avoid a circular import with the documents router.
    from app.routers.documents import purge_document_storage

    purge_document_storage(document)


def apply(db, tenant: Tenant, now: datetime | None = None) -> dict:
    """Run retention for one organisation. Returns how much was removed."""
    now = now or datetime.utcnow()
    removed = {"conversations": 0, "audit_events": 0, "documents": 0, "kept_on_hold": 0}

    if tenant.conversation_retention_days:
        cutoff = now - timedelta(days=tenant.conversation_retention_days)
        old = db.scalars(select(Conversation).where(Conversation.tenant_id == tenant.id,
                                                    Conversation.updated_at < cutoff)).all()
        for conversation in old:
            db.delete(conversation)          # messages are removed with it
        removed["conversations"] = len(old)

    if tenant.document_retention_days:
        cutoff = now - timedelta(days=tenant.document_retention_days)
        candidates = db.scalars(select(Document).where(Document.tenant_id == tenant.id,
                                                       Document.created_at < cutoff,
                                                       Document.status.not_in(["queued", "processing"]))).all()
        handled_groups: set = set()
        for document in candidates:
            group_key = document.version_group_id or document.id
            if group_key in handled_groups:
                continue
            handled_groups.add(group_key)
            versions = [document]
            if document.version_group_id is not None:
                versions = db.scalars(select(Document).where(Document.version_group_id == document.version_group_id)).all()
            if any(v.legal_hold for v in versions):
                removed["kept_on_hold"] += len(versions)
                continue
            # Keep the whole history while its newest version is still young.
            if any(_utc_naive(v.created_at) >= cutoff or v.status in {"queued", "processing"} for v in versions):
                continue
            for version in versions:
                try:
                    _purge_document_files(version)
                except Exception:
                    logger.exception("Retention could not remove document files",
                                     extra={"fields": {"document_id": str(version.id)}})
                    continue
                db.delete(version)
                removed["documents"] += 1

    if tenant.audit_retention_days:
        cutoff = now - timedelta(days=tenant.audit_retention_days)
        result = db.execute(delete(AuditEvent).where(AuditEvent.tenant_id == tenant.id, AuditEvent.created_at < cutoff))
        removed["audit_events"] = result.rowcount or 0

    db.commit()
    if any(removed[k] for k in ("conversations", "audit_events", "documents")):
        audit_service.record("retention.applied", tenant_id=tenant.id, actor_username="system",
                             target_type="tenant", target_id=tenant.id, target_label=tenant.name, details=removed)
    return removed


def run_all() -> dict:
    db = SessionLocal()
    totals: dict[str, int] = {}
    try:
        for tenant in db.scalars(select(Tenant)).all():
            if not (tenant.conversation_retention_days or tenant.audit_retention_days or tenant.document_retention_days):
                continue
            try:
                for key, value in apply(db, tenant).items():
                    totals[key] = totals.get(key, 0) + value
            except Exception:
                db.rollback()
                logger.exception("Retention failed for a tenant", extra={"fields": {"tenant_id": str(tenant.id)}})
    finally:
        db.close()
    return totals


_stop = threading.Event()


def _loop() -> None:
    # First run shortly after start-up, then every RETENTION_INTERVAL_HOURS.
    if _stop.wait(60):
        return
    while not _stop.is_set():
        try:
            totals = run_all()
            if totals:
                logger.info("Retention run finished", extra={"fields": totals})
        except Exception:
            logger.exception("Retention run failed")
        if _stop.wait(max(1, RETENTION_INTERVAL_HOURS) * 3600):
            return


def start() -> None:
    threading.Thread(target=_loop, name="ragentis-retention", daemon=True).start()


def stop() -> None:
    _stop.set()
