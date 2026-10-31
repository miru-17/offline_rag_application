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

    # Hybrid (keyword + meaning) search.
    hybrid_search: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    # "auto" = answer in the language of the question, or a fixed language code.
    answer_language: Mapped[str] = mapped_column(String(10), nullable=False, default="auto", server_default="auto")

    # Local model for this organisation (must be in OLLAMA_ALLOWED_MODELS); empty = server default.
    llm_model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Data retention in days; empty = keep forever. Legal hold always wins.
    conversation_retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audit_retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    document_retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Usage report: "weekly" (default) or "off".
    report_schedule: Mapped[str] = mapped_column(String(10), nullable=False, default="weekly", server_default="weekly")

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