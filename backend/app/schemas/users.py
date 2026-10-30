from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.auth import check_password_strength


UserRole = Literal[
    "ADMIN",
    "USER",
    "VIEWER",
]


class CreateUserRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=100,
        pattern=r"^[A-Za-z0-9_.@-]+$",
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=72,
    )

    role: UserRole

    _strength = field_validator("password")(check_password_strength)


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


class ManagedUserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    tenant_id: UUID
    role: UserRole
    is_active: bool = True
    groups: list[str] = []
    last_login_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UpdateUserStatusRequest(BaseModel):
    is_active: bool