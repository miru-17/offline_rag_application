from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user, is_admin, require_roles
from app.models.user import User
from app.services import audit_service
from app.services.license_service import LicenseError, LicenseService

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
            })
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
