import uuid
from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.security import TokenError, decode_access_token
from app.database.connection import get_db
from app.models.group import GroupMember
from app.models.user import User


security = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate authentication credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


# Paths a user may still call while a password change is required.
_PASSWORD_CHANGE_ALLOWED = {"/auth/me", "/auth/change-password", "/auth/logout", "/auth/refresh"}


def _user_from_api_key(request: Request, raw: str, db: Session) -> User:
    from app.services import api_key_service
    from app.services.license_service import LicenseService

    key = api_key_service.authenticate(db, raw)
    if key is None:
        raise HTTPException(status_code=401, detail="Invalid or expired API key.")
    allowed, scope = api_key_service.required_scope(request.method, request.url.path)
    if not allowed:
        raise HTTPException(status_code=403, detail="API keys cannot use this endpoint.")
    if scope is not None and scope not in (key.scopes or []):
        raise HTTPException(status_code=403, detail=f"This API key does not have the '{scope}' scope.")
    user = key.user
    if user is None or not user.is_active or user.tenant_id != key.tenant_id or user.role is None:
        raise HTTPException(status_code=401, detail="Invalid or expired API key.")
    if not LicenseService.evaluate(db, user.tenant_id, record_time=False).has_feature("api"):
        raise HTTPException(status_code=403, detail="Your license does not include the 'api' feature.")
    request.state.api_key_id = str(key.id)
    request.state.api_key_name = key.name
    return user


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    api_key: str | None = Depends(api_key_header),
    db: Session = Depends(get_db),
) -> User:
    if (credentials is None or not credentials.credentials) and api_key:
        return _user_from_api_key(request, api_key, db)
    if credentials is None or not credentials.credentials:
        raise _UNAUTHORIZED

    try:
        payload = decode_access_token(credentials.credentials)
        user_uuid = uuid.UUID(str(payload.get("sub")))
    except (TokenError, ValueError, TypeError):
        raise _UNAUTHORIZED

    user = db.scalar(
        select(User)
        .options(joinedload(User.role), joinedload(User.tenant))
        .where(User.id == user_uuid)
    )

    if user is None or not user.is_active:
        raise _UNAUTHORIZED

    # Tokens issued before a password change / deactivation are revoked.
    if int(payload.get("ver", 0)) != int(user.token_version or 0):
        raise _UNAUTHORIZED

    if user.tenant_id is None or user.role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not fully configured",
        )

    if user.must_change_password and request.url.path.rstrip("/") not in _PASSWORD_CHANGE_ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required. Choose a new password to continue.",
        )

    return user


def require_roles(*allowed_roles: str) -> Callable:
    allowed = {role.upper() for role in allowed_roles}

    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role.name.upper() not in allowed:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this resource",
            )
        return current_user

    return role_checker


def is_admin(user: User) -> bool:
    return user.role is not None and user.role.name.upper() == "ADMIN"


def get_user_group_ids(db: Session, user: User) -> list[str]:
    rows = db.scalars(
        select(GroupMember.group_id).where(GroupMember.user_id == user.id)
    ).all()
    return [str(group_id) for group_id in rows]
