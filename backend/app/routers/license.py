from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.services.license_service import LicenseService


router = APIRouter(
    prefix="/license",
    tags=["License"],
)


class LicenseCreateRequest(BaseModel):
    expires_at: datetime

class LicenseExtensionRequest(BaseModel):
    days: int | None = None
    expires_at: datetime | None = None


@router.post(
    "/create",
    status_code=status.HTTP_201_CREATED,
)
def create_license(
    license_data: LicenseCreateRequest,
    current_user: User = Depends(
        require_roles("ADMIN")
    ),
    db: Session = Depends(get_db),
):
    # Normalize the incoming expiry datetime to UTC
    expires_at = license_data.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    expires_at = expires_at.astimezone(timezone.utc)

    print(
        "RECEIVED EXPIRY:",
        license_data.expires_at,
    )
    print(
        "NORMALIZED EXPIRY:",
        expires_at,
    )
    print(
        "CURRENT UTC:",
        datetime.now(timezone.utc),
    )

    # Prevent creation of an already-expired license
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="License expiry must be in the future.",
        )

    # Check whether this tenant already has a license
    existing_license = LicenseService.get_license(
        db=db,
        tenant_id=current_user.tenant_id,
    )

    if existing_license:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A license already exists for this tenant.",
        )

    # Create the license
    license = LicenseService.create_license(
        db=db,
        tenant_id=current_user.tenant_id,
        expires_at=expires_at,
    )

    return {
        "message": "License created successfully",
        "license": {
            "id": str(license.id),
            "license_key": license.license_key,
            "tenant_id": str(license.tenant_id),
            "issued_at": license.issued_at,
            "expires_at": license.expires_at,
            "is_active": license.is_active,
        },
    }


@router.get("/status")
def license_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get the license for the current user's tenant
    license = LicenseService.get_license(
        db=db,
        tenant_id=current_user.tenant_id,
    )

    # No license exists
    if license is None:
        return {
            "licensed": False,
            "message": "No license found for this tenant.",
        }

    # Check whether the license is currently valid
    valid = LicenseService.is_license_valid(
        db=db,
        tenant_id=current_user.tenant_id,
    )

    return {
        "licensed": valid,
        "license": {
            "license_key": license.license_key,
            "issued_at": license.issued_at,
            "expires_at": license.expires_at,
            "is_active": license.is_active,
        },
    }


@router.patch("/extend")
def extend_license(
    license_data: LicenseExtensionRequest,
    current_user: User = Depends(
        require_roles("ADMIN")
    ),
    db: Session = Depends(get_db),
):
    try:
        license = LicenseService.extend_license(
            db=db,
            tenant_id=current_user.tenant_id,
            days=license_data.days,
            expires_at=license_data.expires_at,
        )

        return {
            "message": "License updated successfully",
            "license": {
                "license_key": license.license_key,
                "tenant_id": str(license.tenant_id),
                "issued_at": license.issued_at,
                "expires_at": license.expires_at,
                "is_active": license.is_active,
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    