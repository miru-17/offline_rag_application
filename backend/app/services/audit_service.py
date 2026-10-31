"""
Audit trail.

record() writes one row per security-relevant action. It uses its own
database session, so an audit row is kept even when the caller's
transaction is rolled back (e.g. a failed login), and an audit failure
never breaks the user's request.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request

from app.core.logging import get_logger
from app.database.connection import SessionLocal
from app.models.audit_event import AuditEvent

logger = get_logger("audit")

# Keys that must never be written to the audit log.
_FORBIDDEN_KEYS = {"password", "new_password", "current_password", "content", "text",
                   "query", "question", "answer", "token", "license_text"}


def client_ip(request: Request | None) -> str | None:
    if request is None or request.client is None:
        return None
    return request.client.host


def _clean(details: dict | None) -> dict | None:
    if not details:
        return None
    cleaned: dict[str, Any] = {}
    for key, value in details.items():
        if key.lower() in _FORBIDDEN_KEYS:
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            cleaned[key] = value if not isinstance(value, str) else value[:255]
        elif isinstance(value, (list, tuple)):
            cleaned[key] = [str(v)[:100] for v in list(value)[:20]]
        else:
            cleaned[key] = str(value)[:255]
    return cleaned


def record(
    action: str,
    *,
    actor=None,
    tenant_id=None,
    outcome: str = "success",
    target_type: str | None = None,
    target_id=None,
    target_label: str | None = None,
    details: dict | None = None,
    request: Request | None = None,
    actor_username: str | None = None,
) -> None:
    api_key_name = getattr(getattr(request, "state", None), "api_key_name", None) if request is not None else None
    if api_key_name:
        details = {**(details or {}), "via_api_key": api_key_name}
    db = SessionLocal()
    try:
        event = AuditEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id if tenant_id is not None else getattr(actor, "tenant_id", None),
            actor_id=getattr(actor, "id", None),
            actor_username=actor_username or getattr(actor, "username", None),
            action=action,
            outcome=outcome,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            target_label=(target_label or None) and str(target_label)[:255],
            details=_clean(details),
            ip_address=client_ip(request),
        )
        db.add(event)
        db.commit()
    except Exception:  # never break the request because of auditing
        db.rollback()
        logger.exception("Failed to write audit event", extra={"fields": {"action": action}})
    finally:
        db.close()
