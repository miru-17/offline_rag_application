import re

from pydantic import BaseModel, EmailStr, Field, field_validator


def check_password_strength(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password must not exceed 72 bytes.")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain at least one letter and one number.")
    return value


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100, pattern=r"^[A-Za-z0-9_.@-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    _strength = field_validator("password")(check_password_strength)


class LoginRequest(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(min_length=8, max_length=72)

    _strength = field_validator("new_password")(check_password_strength)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    # Normally empty: the refresh token travels in the HttpOnly session cookie.
    refresh_token: str | None = Field(None, min_length=20, max_length=200)


class MfaVerifyRequest(BaseModel):
    mfa_token: str = Field(max_length=2000)
    code: str = Field(min_length=6, max_length=10)


class MfaCodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=10)


class MfaDisableRequest(BaseModel):
    password: str = Field(max_length=200)
    code: str = Field(min_length=6, max_length=10)
