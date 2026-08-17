from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import SECRET_KEY, ALGORITHM
from app.database.connection import get_db
from app.models.user import User


security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:

    token = credentials.credentials

    print("================================")
    print("TOKEN RECEIVED:", token[:30], "...")
    print("SECRET KEY:", SECRET_KEY[:10], "...")
    print("ALGORITHM:", ALGORITHM)
    print("================================")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        print("JWT PAYLOAD:", payload)

        user_id = payload.get("sub")

        if user_id is None:
            print("ERROR: sub missing from token")
            raise credentials_exception

    except JWTError as e:
        print("JWT ERROR:", repr(e))
        raise credentials_exception

    user = db.scalar(
        select(User).where(
            User.id == user_id
        )
    )

    print("USER FOUND:", user is not None)

    if user is None:
        print("ERROR: User not found for ID:", user_id)
        raise credentials_exception

    return user


def require_roles(*allowed_roles: str) -> Callable:
    """
    Restrict an endpoint to specific roles.

    Example:
        Depends(require_roles("ADMIN"))
    """

    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        # Get role from database
        user_role = current_user.role.name.upper()

        allowed = {
            role.upper()
            for role in allowed_roles
        }

        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        return current_user

    return role_checker