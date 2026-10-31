import uuid
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    file_type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )

    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    # PRIVATE  -> Only the uploader can access
    # TENANT   -> Authorized users/viewers in the same tenant can access
    # GROUP    -> Members of one team space (group_id) can access
    visibility: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PRIVATE",
        index=True,
    )

    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    processed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # queued -> processing -> ready | failed
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="queued",
        server_default="ready",
        index=True,
    )

    # Safe, user-facing reason when processing failed (no stack traces).
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    chunk_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    page_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    file_size: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    # SHA-256 of the uploaded bytes, used to detect duplicate uploads.
    content_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )

    # {"AADHAAR": 2, "PAN": 1, ...} and the mode applied ("flag"/"redact").
    pii_summary: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Pages that were read with OCR (scanned pages / images).
    ocr_pages: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    # --- Versions -----------------------------------------------------
    # All versions of one document share version_group_id. When a new
    # version becomes ready, the previous one is marked "superseded" and its
    # passages are removed from search, so old text no longer answers.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    version_group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    replaces_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relative path inside the watched folder, for auto-ingested files.
    source_path: Mapped[str | None] = mapped_column(String(500), nullable=True, index=True)

    # Legal hold: never removed by retention policies.
    legal_hold: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="documents",
    )

    tenant = relationship(
        "Tenant",
        back_populates="documents",
    )

    group = relationship("Group")