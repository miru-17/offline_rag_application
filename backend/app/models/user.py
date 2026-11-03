import uuid

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    username: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "tenants.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roles.id"),
        nullable=False,
    )

    # Deactivated users cannot log in; their existing tokens stop working.
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    # Incremented on password change / deactivation to revoke old JWTs.
    token_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # Set after an admin password reset: the user must choose a new password.
    must_change_password: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    # "local" (password stored here) or "ldap" (checked against Active Directory).
    auth_source: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="local",
        server_default="local",
    )

    # Two-step login (TOTP authenticator app). Secrets are stored encrypted.
    mfa_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    mfa_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mfa_pending_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Last accepted 30-second step: a code cannot be used twice.
    mfa_last_step: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # Account lockout after repeated wrong passwords / codes.
    failed_login_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    group_memberships = relationship(
        "GroupMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # --------------------------------------------------
    # Tenant Relationship
    # --------------------------------------------------

    tenant = relationship(
        "Tenant",
        back_populates="users",
    )

    # --------------------------------------------------
    # Role Relationship
    # --------------------------------------------------

    role = relationship(
        "Role",
        back_populates="users",
    )

    # --------------------------------------------------
    # Documents
    # --------------------------------------------------

    documents = relationship(
        "Document",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # --------------------------------------------------
    # Conversations
    # --------------------------------------------------

    conversations = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan",
    )