from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.database.connection import get_db
from app.dependencies.auth import (get_current_user, require_roles,
)
from app.models.role import Role
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# --------------------------------------------------
# Authentication Test
# --------------------------------------------------

@router.get("/test")
def authentication_test():
    return {
        "message": "Authentication router is working"
    }


# --------------------------------------------------
# User Registration
# --------------------------------------------------

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_data: RegisterRequest,
    db: Session = Depends(get_db),
):
    # Check if username already exists
    existing_username = db.scalar(
        select(User).where(
            User.username == user_data.username
        )
    )

    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # Check if email already exists
    existing_email = db.scalar(
        select(User).where(
            User.email == user_data.email
        )
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Get default USER role
    user_role = db.scalar(
        select(Role).where(
            Role.name == "USER"
        )
    )

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default USER role not configured",
        )

    # Hash password using bcrypt
    hashed_password = hash_password(
        user_data.password
    )

    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        role_id=user_role.id,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User registered successfully",
        "user": {
            "id": str(new_user.id),
            "username": new_user.username,
            "email": new_user.email,
            "role": user_role.name,
        },
    }


# --------------------------------------------------
# User Login
# --------------------------------------------------

@router.post("/login")
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    # Find user by username
    user = db.scalar(
        select(User).where(
            User.username == login_data.username
        )
    )

    # Don't reveal whether username exists
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Verify password
    if not verify_password(
        login_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Create JWT access token
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role.name,
        },
        expires_delta=timedelta(minutes=30),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }
@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role.name,
    }
# --------------------------------------------------
# RBAC Test Endpoints
# --------------------------------------------------

@router.get("/admin-test")
def admin_test(
    current_user: User = Depends(
        require_roles("ADMIN")
    ),
):
    return {
        "message": "Admin access granted",
        "username": current_user.username,
        "role": current_user.role.name,
    }


@router.get("/user-test")
def user_test(
    current_user: User = Depends(
        require_roles("ADMIN", "USER")
    ),
):
    return {
        "message": "User access granted",
        "username": current_user.username,
        "role": current_user.role.name,
    }


@router.get("/viewer-test")
def viewer_test(
    current_user: User = Depends(
        require_roles("ADMIN", "USER", "VIEWER")
    ),
):
    return {
        "message": "Authenticated user access granted",
        "username": current_user.username,
        "role": current_user.role.name,
    }