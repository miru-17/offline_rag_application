from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User
from app.services.license_service import LicenseService


def _check(db: Session, user: User, feature: str | None = None) -> None:
    state = LicenseService.evaluate(db, user.tenant_id)

    if not state.usable:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"A valid license is required. {state.message}",
        )

    if feature and not state.has_feature(feature):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your license does not include the '{feature}' feature.",
        )


def require_valid_license(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Any role, tenant licence must be valid (or in its grace period)."""
    _check(db, current_user)
    return current_user


def require_valid_license_for_editors(
    current_user: User = Depends(require_roles("ADMIN", "USER")),
    db: Session = Depends(get_db),
) -> User:
    """ADMIN or USER, with a valid licence. VIEWER is rejected first."""
    _check(db, current_user)
    return current_user


def require_feature(feature: str, *roles: str):
    """Valid licence that includes `feature`; optionally limited to roles."""

    role_dependency = require_roles(*roles) if roles else get_current_user

    def checker(
        current_user: User = Depends(role_dependency),
        db: Session = Depends(get_db),
    ) -> User:
        _check(db, current_user, feature)
        return current_user

    return checker
