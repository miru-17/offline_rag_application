import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import require_roles
from app.models.role import Role
from app.models.user import User
from app.schemas.users import (
    CreateUserRequest,
    ManagedUserResponse,
    UpdateUserRoleRequest,
)
from app.core.security import hash_password


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


# =========================================================
# GET ALL USERS
# =========================================================

@router.get(
    "/",
    response_model=list[ManagedUserResponse],
)
def get_users(
    current_user: User = Depends(
        require_roles("ADMIN")
    ),
    db: Session = Depends(get_db),
):
    """
    Return all users belonging to the current tenant.
    ADMIN only.
    """

    users = (
        db.query(User)
        .filter(
            User.tenant_id == current_user.tenant_id
        )
        .order_by(User.username.asc())
        .all()
    )

    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "tenant_id": user.tenant_id,
            "role": user.role.name,
        }
        for user in users
    ]


# =========================================================
# CREATE USER
# =========================================================

@router.post(
    "/",
    response_model=ManagedUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: CreateUserRequest,
    current_user: User = Depends(
        require_roles("ADMIN")
    ),
    db: Session = Depends(get_db),
):
    """
    Create a new user inside the current tenant.
    ADMIN only.
    """

    # -----------------------------------------------------
    # Validate username
    # -----------------------------------------------------

    existing_username = (
        db.query(User)
        .filter(
            User.username == payload.username
        )
        .first()
    )

    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists.",
        )

    # -----------------------------------------------------
    # Validate email
    # -----------------------------------------------------

    existing_email = (
        db.query(User)
        .filter(
            User.email == payload.email
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists.",
        )

    # -----------------------------------------------------
    # Validate role
    # -----------------------------------------------------

    role_name = payload.role.upper()

    role = (
        db.query(Role)
        .filter(
            Role.name == role_name
        )
        .first()
    )

    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role.",
        )

    # -----------------------------------------------------
    # Create user
    # -----------------------------------------------------

    new_user = User(
        id=uuid.uuid4(),
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(
            payload.password
        ),
        tenant_id=current_user.tenant_id,
        role_id=role.id,
    )

    db.add(new_user)

    try:
        db.commit()
        db.refresh(new_user)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists.",
        )

    return {
        "id": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "tenant_id": new_user.tenant_id,
        "role": new_user.role.name,
    }


# =========================================================
# UPDATE USER ROLE
# =========================================================

@router.patch(
    "/{user_id}/role",
    response_model=ManagedUserResponse,
)
def update_user_role(
    user_id: uuid.UUID,
    payload: UpdateUserRoleRequest,
    current_user: User = Depends(
        require_roles("ADMIN")
    ),
    db: Session = Depends(get_db),
):
    """
    Change a user's role.
    ADMIN only.
    """

    # -----------------------------------------------------
    # Prevent self role change
    # -----------------------------------------------------

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role.",
        )

    # -----------------------------------------------------
    # Find user within current tenant
    # -----------------------------------------------------

    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id,
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # -----------------------------------------------------
    # Find requested role
    # -----------------------------------------------------

    role_name = payload.role.upper()

    role = (
        db.query(Role)
        .filter(
            Role.name == role_name
        )
        .first()
    )

    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role.",
        )

    # -----------------------------------------------------
    # Update role
    # -----------------------------------------------------

    user.role_id = role.id

    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "tenant_id": user.tenant_id,
        "role": user.role.name,
    }


# =========================================================
# DELETE USER
# =========================================================

@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(
        require_roles("ADMIN")
    ),
    db: Session = Depends(get_db),
):
    """
    Delete a user from the current tenant.
    ADMIN only.
    """

    # -----------------------------------------------------
    # Prevent self deletion
    # -----------------------------------------------------

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete yourself.",
        )

    # -----------------------------------------------------
    # Find user within current tenant
    # -----------------------------------------------------

    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id,
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # -----------------------------------------------------
    # Delete
    # -----------------------------------------------------

    db.delete(user)
    db.commit()

    return None