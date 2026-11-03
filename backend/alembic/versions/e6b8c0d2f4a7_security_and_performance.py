"""Account lockout, single-use two-step codes, session rotation time, indexes

Revision ID: e6b8c0d2f4a7
Revises: d4a7b9c1e2f5
Create Date: 2026-11-03 18:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e6b8c0d2f4a7"
down_revision: Union[str, Sequence[str], None] = "d4a7b9c1e2f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("mfa_last_step", sa.BigInteger(), nullable=True))
    op.add_column("users", sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(), nullable=True))
    op.add_column("refresh_tokens", sa.Column("rotated_at", sa.DateTime(), nullable=True))
    op.create_index("ix_documents_tenant_status", "documents", ["tenant_id", "status"])
    op.create_index("ix_messages_conversation_created", "messages", ["conversation_id", "created_at"])
    op.create_index("ix_messages_created_at", "messages", ["created_at"])
    op.create_index("ix_conversations_user_updated", "conversations", ["user_id", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_conversations_user_updated", table_name="conversations")
    op.drop_index("ix_messages_created_at", table_name="messages")
    op.drop_index("ix_messages_conversation_created", table_name="messages")
    op.drop_index("ix_documents_tenant_status", table_name="documents")
    op.drop_column("refresh_tokens", "rotated_at")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_count")
    op.drop_column("users", "mfa_last_step")
