from datetime import timedelta

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.database.connection import get_db
from app.dependencies.auth import (
    get_current_user,
    require_roles,
)
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
)


# ============================================================
# ROUTER
# ============================================================

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
    # --------------------------------------------------
    # Check if username already exists
    # --------------------------------------------------

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

    # --------------------------------------------------
    # Check if email already exists
    # --------------------------------------------------

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

    # --------------------------------------------------
    # Get Default Tenant
    # --------------------------------------------------

    default_tenant = db.scalar(
        select(Tenant).where(
            Tenant.name == "Default Tenant"
        )
    )

    if not default_tenant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default tenant not configured",
        )

    # --------------------------------------------------
    # Get Default USER Role
    # --------------------------------------------------

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

    # --------------------------------------------------
    # Hash Password
    # --------------------------------------------------

    hashed_password = hash_password(
        user_data.password
    )

    # --------------------------------------------------
    # Create New User
    # --------------------------------------------------

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        tenant_id=default_tenant.id,
        role_id=user_role.id,
    )

    db.add(new_user)

    try:
        db.commit()
        db.refresh(new_user)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        )

    # --------------------------------------------------
    # Registration Response
    # --------------------------------------------------

    return {
        "message": "User registered successfully",
        "user": {
            "id": str(new_user.id),
            "username": new_user.username,
            "email": new_user.email,
            "role": user_role.name,
            "tenant_id": str(new_user.tenant_id),
            "tenant_name": default_tenant.name,
        },
    }


# --------------------------------------------------
# User Login
# --------------------------------------------------

@router.post("/login")
@limiter.limit("5/minute")
def login(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    # --------------------------------------------------
    # Find User
    # --------------------------------------------------

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

    # --------------------------------------------------
    # Verify Password
    # --------------------------------------------------

    if not verify_password(
        login_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # --------------------------------------------------
    # Create JWT Access Token
    # --------------------------------------------------

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


# --------------------------------------------------
# Current User Profile
# --------------------------------------------------

@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    if not current_user.role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User role is not configured",
        )

    if not current_user.tenant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User tenant is not configured",
        )

    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role.name,
        "tenant_id": str(current_user.tenant_id),
        "tenant_name": current_user.tenant.name,
    }


# --------------------------------------------------
# Change Password
# --------------------------------------------------

@router.patch("/change-password")
def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(
        password_data.current_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if (
        password_data.current_password
        == password_data.new_password
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "New password must be different "
                "from current password"
            ),
        )

    current_user.password_hash = hash_password(
        password_data.new_password
    )

    try:
        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password",
        )

    return {
        "message": "Password changed successfully"
    }


# --------------------------------------------------
# RBAC Test - ADMIN
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
        "tenant_id": str(current_user.tenant_id),
    }


# --------------------------------------------------
# RBAC Test - USER
# --------------------------------------------------

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
        "tenant_id": str(current_user.tenant_id),
    }


# --------------------------------------------------
# RBAC Test - VIEWER
# --------------------------------------------------

@router.get("/viewer-test")
def viewer_test(
    current_user: User = Depends(
        require_roles(
            "ADMIN",
            "USER",
            "VIEWER",
        )
    ),
):
    return {
        "message": "Authenticated user access granted",
        "username": current_user.username,
        "role": current_user.role.name,
        "tenant_id": str(current_user.tenant_id),
    }

