import uuid

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    # --------------------------------------------------
    # RAG Settings
    # --------------------------------------------------

    retrieval_depth: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
        server_default="5",
    )

    source_attribution: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    # off | flag | redact  -- personal data handling during ingestion.
    pii_mode: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="flag",
        server_default="flag",
    )

    users = relationship(
        "User",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )

    documents = relationship(
        "Document",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )

    license = relationship(
        "License",
        back_populates="tenant",
        uselist=False,
        cascade="all, delete-orphan",
    )