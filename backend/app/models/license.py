import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class License(Base):
    __tablename__ = "licenses"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    license_key: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    issued_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    # The complete signed licence file. Validity is always decided from
    # this signed content, never from the editable columns above.
    signed_license: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    customer: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    max_users: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    features: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Highest clock time seen, used to detect the system clock being
    # turned back to extend an expired licence.
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    tenant = relationship(
        "Tenant",
        back_populates="license",
    )