import uuid
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.security import SECRET_KEY, ALGORITHM
from app.database.connection import get_db
from app.models.user import User


security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.scalar(
        select(User)
        .options(
            joinedload(User.role),
            joinedload(User.tenant),
        )
        .where(User.id == user_uuid)
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

def require_roles(*allowed_roles: str) -> Callable:

    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.role is None:
            raise HTTPException(
                status_code=403,
                detail="User role is not configured",
            )

        user_role = current_user.role.name.upper()
        allowed = {role.upper() for role in allowed_roles}

        if user_role not in allowed:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this resource",
            )

        return current_user

    return role_checker