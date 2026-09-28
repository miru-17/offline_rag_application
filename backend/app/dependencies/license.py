from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.services.license_service import LicenseService


def require_valid_license(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Require the current user's tenant to have a valid license.
    """

    if not LicenseService.is_license_valid(
        db=db,
        tenant_id=current_user.tenant_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A valid license is required to access this resource.",
        )

    return current_user


def require_valid_license_for_editors(
    current_user: User = Depends(
        require_roles("ADMIN", "USER")
    ),
    db: Session = Depends(get_db),
) -> User:
    """
    Require:
        1. User must be ADMIN or USER
        2. Tenant must have a valid license

    VIEWER users are rejected before reaching the license check.
    """

    if not LicenseService.is_license_valid(
        db=db,
        tenant_id=current_user.tenant_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A valid license is required to upload documents.",
        )

    return current_user