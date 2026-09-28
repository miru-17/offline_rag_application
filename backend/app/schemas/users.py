from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


UserRole = Literal[
    "ADMIN",
    "USER",
    "VIEWER",
]


class CreateUserRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=100,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    role: UserRole


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


class ManagedUserResponse(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    tenant_id: UUID
    role: UserRole

    class Config:
        from_attributes = True