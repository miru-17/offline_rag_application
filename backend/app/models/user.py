import uuid

from sqlalchemy import ForeignKey, String
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