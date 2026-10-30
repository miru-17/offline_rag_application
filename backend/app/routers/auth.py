from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import ALLOW_SELF_REGISTRATION, LOGIN_RATE_LIMIT, REGISTER_RATE_LIMIT
from app.core.rate_limit import limiter
from app.core.security import burn_password_check, create_access_token, hash_password, verify_password
from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest
from app.services import audit_service
from app.services.license_service import LicenseService

router = APIRouter(prefix="/auth", tags=["Authentication"])

DEFAULT_TENANT = "Default Tenant"


@router.get("/setup-status")
def setup_status(db: Session = Depends(get_db)):
    """Tells the login page whether first-run setup or sign-up is available."""
    has_users = db.scalar(select(func.count(User.id))) > 0
    return {
        "needs_setup": not has_users,
        "self_registration": ALLOW_SELF_REGISTRATION or not has_users,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit(REGISTER_RATE_LIMIT)
def register(request: Request, user_data: RegisterRequest, db: Session = Depends(get_db)):
    """
    First run (no users yet): creates the first account as ADMIN.
    Afterwards: allowed only when ALLOW_SELF_REGISTRATION=true, as USER.
    Admins add people from the Users page instead.
    """

    first_user = db.scalar(select(func.count(User.id))) == 0

    if not first_user and not ALLOW_SELF_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-registration is disabled. Ask your administrator to create an account.",
        )

    if db.scalar(select(User).where(User.username == user_data.username)):
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.scalar(select(User).where(func.lower(User.email) == user_data.email.lower())):
        raise HTTPException(status_code=400, detail="Email already registered")

    tenant = db.scalar(select(Tenant).where(Tenant.name == DEFAULT_TENANT))
    role = db.scalar(select(Role).where(Role.name == ("ADMIN" if first_user else "USER")))
    if tenant is None or role is None:
        raise HTTPException(status_code=500, detail="Server is not initialised. Run the database bootstrap.")

    if not first_user:
        _enforce_user_limit(db, tenant.id)

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        tenant_id=tenant.id,
        role_id=role.id,
    )
    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create user")

    audit_service.record(
        "user.registered", actor=new_user, target_type="user", target_id=new_user.id,
        target_label=new_user.username, details={"role": role.name, "first_admin": first_user},
        request=request,
    )

    return {
        "message": "User registered successfully",
        "user": {
            "id": str(new_user.id),
            "username": new_user.username,
            "email": new_user.email,
            "role": role.name,
            "tenant_id": str(new_user.tenant_id),
            "tenant_name": tenant.name,
        },
    }


def _enforce_user_limit(db: Session, tenant_id) -> None:
    state = LicenseService.evaluate(db, tenant_id, record_time=False)
    if state.payload and state.payload.get("max_users"):
        count = db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant_id))
        if count >= int(state.payload["max_users"]):
            raise HTTPException(
                status_code=403,
                detail=f"Your licence allows {state.payload['max_users']} users. Remove a user or upgrade the licence.",
            )


@router.post("/login")
@limiter.limit(LOGIN_RATE_LIMIT)
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == login_data.username))

    if user is None:
        burn_password_check(login_data.password)  # same timing as a real check
        audit_service.record("auth.login", outcome="failure", actor_username=login_data.username[:100],
                             details={"reason": "unknown_user"}, request=request)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not verify_password(login_data.password, user.password_hash):
        audit_service.record("auth.login", actor=user, outcome="failure",
                             details={"reason": "bad_password"}, request=request)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not user.is_active:
        audit_service.record("auth.login", actor=user, outcome="failure",
                             details={"reason": "deactivated"}, request=request)
        raise HTTPException(status_code=403, detail="This account has been deactivated.")

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role.name, "ver": user.token_version})
    audit_service.record("auth.login", actor=user, request=request)

    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def get_my_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role.name,
        "tenant_id": str(current_user.tenant_id),
        "tenant_name": current_user.tenant.name,
    }


@router.patch("/change-password")
def change_password(
    request: Request,
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(password_data.current_password, current_user.password_hash):
        audit_service.record("auth.password_change", actor=current_user, outcome="failure", request=request)
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if password_data.current_password == password_data.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    current_user.password_hash = hash_password(password_data.new_password)
    # Log out every other session that used the old password.
    current_user.token_version = (current_user.token_version or 0) + 1

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to change password")

    audit_service.record("auth.password_change", actor=current_user, request=request)

    token = create_access_token(
        {"sub": str(current_user.id), "role": current_user.role.name, "ver": current_user.token_version}
    )
    return {"message": "Password changed successfully", "access_token": token, "token_type": "bearer"}
