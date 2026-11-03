import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class Message(Base):
    __tablename__ = "messages"
    # Chat history (latest messages of a conversation) and insights by date.
    __table_args__ = (
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
        Index("ix_messages_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "conversations.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Evidence shown with an assistant answer: file, page, excerpt.
    sources: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # answered | not_found | stopped | error  (assistant messages only)
    answer_status: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        index=True,
    )

    # up | down, set by the user who owns the conversation.
    feedback_rating: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )

    feedback_reason: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    conversation = relationship(
        "Conversation",
        back_populates="messages",
    )