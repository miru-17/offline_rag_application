from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import (
    ALLOW_SELF_REGISTRATION,
    LOGIN_LOCK_MINUTES,
    LOGIN_LOCK_THRESHOLD,
    LOGIN_RATE_LIMIT,
    REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_SECURE,
    REFRESH_TOKEN_DAYS,
    REGISTER_RATE_LIMIT,
)
from app.core.rate_limit import limiter
import secrets

from app.core.security import (
    TokenError,
    burn_password_check,
    create_mfa_token,
    decode_mfa_token,
    hash_password,
    verify_password,
)
from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MfaCodeRequest,
    MfaDisableRequest,
    MfaVerifyRequest,
    RefreshRequest,
    RegisterRequest,
)
from app.services import audit_service, ldap_service, mfa_service, session_service
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
        "directory_login": ldap_service.enabled(),
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


MFA_RATE_LIMIT = "10/minute"


def _client(request: Request) -> tuple[str | None, str | None]:
    return request.headers.get("user-agent"), (request.client.host if request.client else None)


# ------------------------------------------------------------------
# Session cookie: the refresh token is kept in an HttpOnly cookie, so
# scripts in the page (and any injected script) can never read it.
# ------------------------------------------------------------------

def _cookie_secure(request: Request) -> bool:
    if REFRESH_COOKIE_SECURE in {"true", "1", "yes"}:
        return True
    if REFRESH_COOKIE_SECURE in {"false", "0", "no"}:
        return False
    return request.url.scheme == "https"


def _with_session_cookie(response: Response, request: Request, tokens: dict) -> dict:
    refresh_token = tokens.pop("refresh_token", None)
    if refresh_token:
        response.set_cookie(
            REFRESH_COOKIE_NAME,
            refresh_token,
            max_age=REFRESH_TOKEN_DAYS * 86400,
            httponly=True,
            secure=_cookie_secure(request),
            samesite="strict",
            path="/",
        )
    return tokens


def _clear_session_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/", httponly=True,
                           secure=_cookie_secure(request), samesite="strict")


def _session_token(request: Request, payload: RefreshRequest | None) -> str | None:
    if payload is not None and payload.refresh_token:
        return payload.refresh_token          # older clients / scripts
    return request.cookies.get(REFRESH_COOKIE_NAME)


# ------------------------------------------------------------------
# Account lockout
# ------------------------------------------------------------------

_BAD_LOGIN = "Invalid username or password. After repeated failed attempts the account is locked for a while."


def _is_locked(user: User) -> bool:
    return user.locked_until is not None and user.locked_until > datetime.utcnow()


def _register_failure(db: Session, user: User, request: Request, reason: str) -> None:
    user.failed_login_count = (user.failed_login_count or 0) + 1
    locked_now = user.failed_login_count >= LOGIN_LOCK_THRESHOLD
    if locked_now:
        user.locked_until = datetime.utcnow() + timedelta(minutes=LOGIN_LOCK_MINUTES)
        user.failed_login_count = 0
    db.commit()
    audit_service.record("auth.login" if reason != "bad_mfa_code" else "auth.mfa", actor=user, outcome="failure",
                         details={"reason": reason}, request=request)
    if locked_now:
        audit_service.record("auth.account_locked", actor=user, outcome="failure",
                             details={"minutes": LOGIN_LOCK_MINUTES}, request=request)


def _finish_login(db: Session, user: User, request: Request, response: Response) -> dict:
    """Password (and MFA, if enabled) accepted: start a session."""
    user.last_login_at = datetime.utcnow()
    user.failed_login_count = 0
    user.locked_until = None
    db.commit()
    audit_service.record("auth.login", actor=user, request=request,
                         details={"source": user.auth_source, "mfa": user.mfa_enabled})
    user_agent, ip = _client(request)
    tokens = session_service.issue_tokens(db, user, user_agent, ip)
    return {**_with_session_cookie(response, request, tokens), "must_change_password": user.must_change_password}


def _directory_login(db: Session, username: str, password: str, request: Request) -> User | None:
    """Check the password against Active Directory; create or update the local account."""
    try:
        directory_user = ldap_service.authenticate(username, password)
    except ldap_service.LdapUnavailable:
        raise HTTPException(status_code=503, detail="The company directory (Active Directory) is not reachable.")
    if directory_user is None:
        return None

    role = db.scalar(select(Role).where(Role.name == directory_user.role))
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        tenant = db.scalar(select(Tenant).where(Tenant.name == DEFAULT_TENANT))
        if db.scalar(select(User).where(func.lower(User.email) == directory_user.email.lower())):
            raise HTTPException(status_code=409, detail="A local account already uses this email address.")
        _enforce_user_limit(db, tenant.id)
        user = User(
            username=username,
            email=directory_user.email,
            # Unusable local password: directory users always sign in through AD.
            password_hash=hash_password(secrets.token_urlsafe(32)[:60]),
            tenant_id=tenant.id,
            role_id=role.id,
            auth_source="ldap",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        audit_service.record("user.provisioned", actor=user, target_type="user", target_id=user.id,
                             target_label=user.username, details={"source": "ldap", "role": role.name},
                             request=request)
    elif user.role_id != role.id:
        old = user.role.name
        user.role_id = role.id
        db.commit()
        db.refresh(user)
        audit_service.record("user.role_changed", actor=user, target_type="user", target_id=user.id,
                             target_label=user.username, details={"from": old, "to": role.name, "source": "ldap"},
                             request=request)
    return user


@router.post("/login")
@limiter.limit(LOGIN_RATE_LIMIT)
def login(request: Request, response: Response, login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == login_data.username))

    if user is not None and user.auth_source != "ldap" and _is_locked(user):
        burn_password_check(login_data.password)
        audit_service.record("auth.login", actor=user, outcome="failure", details={"reason": "locked"}, request=request)
        raise HTTPException(status_code=401, detail=_BAD_LOGIN)

    if user is not None and user.auth_source == "ldap" or (user is None and ldap_service.enabled()):
        user = _directory_login(db, login_data.username, login_data.password, request)
        if user is None:
            audit_service.record("auth.login", outcome="failure", actor_username=login_data.username[:100],
                                 details={"reason": "directory_rejected"}, request=request)
            raise HTTPException(status_code=401, detail=_BAD_LOGIN)
    elif user is None:
        burn_password_check(login_data.password)  # same timing as a real check
        audit_service.record("auth.login", outcome="failure", actor_username=login_data.username[:100],
                             details={"reason": "unknown_user"}, request=request)
        raise HTTPException(status_code=401, detail=_BAD_LOGIN)
    elif not verify_password(login_data.password, user.password_hash):
        _register_failure(db, user, request, "bad_password")
        raise HTTPException(status_code=401, detail=_BAD_LOGIN)

    if not user.is_active:
        audit_service.record("auth.login", actor=user, outcome="failure",
                             details={"reason": "deactivated"}, request=request)
        raise HTTPException(status_code=403, detail="This account has been deactivated.")

    if user.mfa_enabled:
        return {"mfa_required": True, "mfa_token": create_mfa_token(str(user.id), user.token_version)}

    return _finish_login(db, user, request, response)


@router.post("/mfa/verify")
@limiter.limit(MFA_RATE_LIMIT)
def mfa_verify(request: Request, response: Response, payload: MfaVerifyRequest, db: Session = Depends(get_db)):
    """Second step of login: the 6-digit code from the authenticator app."""
    try:
        claims = decode_mfa_token(payload.mfa_token)
    except TokenError:
        raise HTTPException(status_code=401, detail="The sign-in step expired. Sign in again.")

    user = db.scalar(select(User).where(User.id == claims["sub"]))
    if user is None or not user.is_active or int(claims.get("ver", 0)) != user.token_version:
        raise HTTPException(status_code=401, detail="The sign-in step expired. Sign in again.")

    if _is_locked(user):
        raise HTTPException(status_code=401, detail="Too many failed attempts. Try again later.")
    if not mfa_service.verify_login(user, payload.code):
        _register_failure(db, user, request, "bad_mfa_code")
        raise HTTPException(status_code=401, detail="The code is not correct (each code works only once). "
                                                    "Check the time on your phone.")

    return _finish_login(db, user, request, response)


@router.post("/refresh")
def refresh(request: Request, response: Response, payload: RefreshRequest | None = None,
            db: Session = Depends(get_db)):
    """New access token from the session cookie (the cookie is renewed too)."""
    token = _session_token(request, payload)
    if not token:
        raise HTTPException(status_code=401, detail="Your session has ended. Sign in again.")
    user_agent, ip = _client(request)
    try:
        user, tokens = session_service.rotate(db, token, user_agent, ip)
    except session_service.SessionError as exc:
        audit_service.record("auth.refresh", outcome="failure", details={"reason": str(exc)}, request=request)
        _clear_session_cookie(response, request)
        raise HTTPException(status_code=401, detail="Your session has ended. Sign in again.",
                            headers={"set-cookie": response.headers.get("set-cookie", "")})
    return {**_with_session_cookie(response, request, tokens), "must_change_password": user.must_change_password}


@router.post("/logout")
def logout(request: Request, response: Response, payload: RefreshRequest | None = None,
           db: Session = Depends(get_db)):
    token = _session_token(request, payload)
    if token:
        session_service.revoke(db, token)
    _clear_session_cookie(response, request)
    return {"message": "Signed out"}


@router.get("/me")
def get_my_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role.name,
        "tenant_id": str(current_user.tenant_id),
        "tenant_name": current_user.tenant.name,
        "auth_source": current_user.auth_source,
        "mfa_enabled": current_user.mfa_enabled,
        "must_change_password": current_user.must_change_password,
    }


@router.patch("/change-password")
def change_password(
    request: Request,
    response: Response,
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.auth_source == "ldap":
        raise HTTPException(status_code=400, detail="Your password is managed by the company directory (Active Directory).")

    if not verify_password(password_data.current_password, current_user.password_hash):
        audit_service.record("auth.password_change", actor=current_user, outcome="failure", request=request)
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if password_data.current_password == password_data.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    current_user.password_hash = hash_password(password_data.new_password)
    current_user.must_change_password = False
    # Log out every other session that used the old password.
    current_user.token_version = (current_user.token_version or 0) + 1
    session_service.revoke_all_for_user(db, current_user.id)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to change password")

    audit_service.record("auth.password_change", actor=current_user, request=request)

    user_agent, ip = _client(request)
    tokens = session_service.issue_tokens(db, current_user, user_agent, ip)
    return {"message": "Password changed successfully", **_with_session_cookie(response, request, tokens)}


# ------------------------------------------------------------------
# Two-step login (MFA) management for the signed-in user
# ------------------------------------------------------------------

@router.post("/mfa/setup")
def mfa_setup(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.mfa_enabled:
        raise HTTPException(status_code=409, detail="Two-step login is already on.")
    data = mfa_service.start_setup(current_user)
    db.commit()
    return data


@router.post("/mfa/enable")
@limiter.limit(MFA_RATE_LIMIT)
def mfa_enable(request: Request, payload: MfaCodeRequest, current_user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    if not mfa_service.confirm_setup(current_user, payload.code):
        raise HTTPException(status_code=400, detail="The code is not correct. Scan the QR code again and retry.")
    db.commit()
    audit_service.record("auth.mfa_enabled", actor=current_user, request=request)
    return {"mfa_enabled": True}


@router.post("/mfa/disable")
@limiter.limit(MFA_RATE_LIMIT)
def mfa_disable(request: Request, payload: MfaDisableRequest, current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    password_ok = current_user.auth_source == "ldap" or verify_password(payload.password, current_user.password_hash)
    if not password_ok or not mfa_service.verify_login(current_user, payload.code):
        raise HTTPException(status_code=400, detail="Password or code is not correct.")
    mfa_service.disable(current_user)
    db.commit()
    audit_service.record("auth.mfa_disabled", actor=current_user, request=request)
    return {"mfa_enabled": False}
