from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user, is_admin, require_roles
from app.models.user import User
from app.services import audit_service
from sqlalchemy import select

from app.models.audit_event import AuditEvent
from app.services.license_service import LicenseError, LicenseService, activation_request, get_installation_id

router = APIRouter(prefix="/license", tags=["License"])


class LicenseInstallRequest(BaseModel):
    license_text: str = Field(min_length=20, max_length=20000)


@router.get("/status")
def license_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    state = LicenseService.evaluate(db, current_user.tenant_id)

    response = {
        "licensed": state.usable,
        "state": state.state,
        "message": state.message,
        "days_left": state.days_left,
        "read_only": state.read_only,
        "warning": state.warning,
    }

    if state.payload:
        payload = state.payload
        response["license"] = {
            "license_key": payload.get("license_id"),
            "expires_at": payload["_expires_at"],
            "issued_at": payload.get("issued_at"),
            "is_active": state.usable,
        }
        if is_admin(current_user):
            response["license"].update({
                "customer": payload.get("customer"),
                "max_users": payload.get("max_users"),
                "features": payload.get("features"),
                "grace_days": payload.get("grace_days"),
                "bound_to_installation": bool(payload.get("installation_id")),
            })
    if is_admin(current_user):
        response["installation_id"] = get_installation_id(db)
    return response


@router.post("/install")
def install_license(
    request: Request,
    payload: LicenseInstallRequest,
    current_user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    """Install the signed .license file issued by the vendor."""
    try:
        license = LicenseService.install(db, current_user.tenant_id, payload.license_text)
    except LicenseError as exc:
        audit_service.record("license.install", actor=current_user, outcome="failure",
                             details={"reason": str(exc)}, request=request)
        raise HTTPException(status_code=400, detail=str(exc))

    audit_service.record("license.install", actor=current_user, target_type="license",
                         target_id=license.license_key, target_label=license.customer,
                         details={"expires_at": license.expires_at.isoformat(), "max_users": license.max_users},
                         request=request)
    return {"message": "Licence installed", **license_status(current_user, db)}


@router.get("/activation-request")
def get_activation_request(current_user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    """Code to send to the vendor to receive a licence bound to this installation."""
    return activation_request(db, current_user.tenant.name if current_user.tenant else "")


@router.get("/history")
def license_history(current_user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    """Every licence installation attempt for this organisation (from the audit log)."""
    events = db.scalars(
        select(AuditEvent)
        .where(AuditEvent.tenant_id == current_user.tenant_id, AuditEvent.action == "license.install")
        .order_by(AuditEvent.created_at.desc())
        .limit(100)
    ).all()
    return [
        {
            "at": e.created_at,
            "by": e.actor_username,
            "outcome": e.outcome,
            "license_id": e.target_id,
            "customer": e.target_label,
            "expires_at": (e.details or {}).get("expires_at"),
            "max_users": (e.details or {}).get("max_users"),
            "reason": (e.details or {}).get("reason"),
        }
        for e in events
    ]
