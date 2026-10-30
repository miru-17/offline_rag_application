import uuid
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.connection import Base


class Dataset(Base):
    """A CSV / Excel table used by the data dashboard."""

    __tablename__ = "datasets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    sheet_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # [{"name": "Amount", "kind": "number", "unique": 120, "missing": 0, "sample": [...]}, ...]
    columns: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # PRIVATE (owner only) or TENANT (everyone in the tenant)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="PRIVATE")

    # "upload" or "extraction" (created from structured extraction)
    origin: Mapped[str] = mapped_column(String(20), nullable=False, default="upload")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
