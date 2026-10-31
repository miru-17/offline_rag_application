"""RAGENTIS 3: sessions, MFA, LDAP, OCR, versions, legal hold, watched folder,
hybrid search / language / model per organisation, retention, API keys, reports

Only adds tables and columns. Existing rows are kept and given safe values.

Revision ID: c8d2e4f6a1b3
Revises: b7c1e2d3f4a5
Create Date: 2026-10-31 18:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c8d2e4f6a1b3"
down_revision: Union[str, Sequence[str], None] = "b7c1e2d3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    # ---------------- users ----------------
    op.add_column("users", sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("auth_source", sa.String(length=10), nullable=False, server_default="local"))
    op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("mfa_secret", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("mfa_pending_secret", sa.String(length=255), nullable=True))

    # ---------------- refresh tokens ----------------
    op.create_table(
        "refresh_tokens",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("family_id", UUID, nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])

    # ---------------- documents ----------------
    op.add_column("documents", sa.Column("ocr_pages", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("documents", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("documents", sa.Column("version_group_id", UUID, nullable=True))
    op.add_column("documents", sa.Column("replaces_document_id", UUID, nullable=True))
    op.add_column("documents", sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("documents", sa.Column("source_path", sa.String(length=500), nullable=True))
    op.add_column("documents", sa.Column("legal_hold", sa.Boolean(), nullable=False, server_default="false"))
    op.create_index("ix_documents_version_group_id", "documents", ["version_group_id"])
    op.create_index("ix_documents_source_path", "documents", ["source_path"])

    # ---------------- tenants ----------------
    op.add_column("tenants", sa.Column("hybrid_search", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("tenants", sa.Column("answer_language", sa.String(length=10), nullable=False, server_default="auto"))
    op.add_column("tenants", sa.Column("llm_model", sa.String(length=100), nullable=True))
    op.add_column("tenants", sa.Column("conversation_retention_days", sa.Integer(), nullable=True))
    op.add_column("tenants", sa.Column("audit_retention_days", sa.Integer(), nullable=True))
    op.add_column("tenants", sa.Column("document_retention_days", sa.Integer(), nullable=True))
    op.add_column("tenants", sa.Column("report_schedule", sa.String(length=10), nullable=False, server_default="weekly"))

    # ---------------- API keys ----------------
    op.create_table(
        "api_keys",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("prefix", sa.String(length=16), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_api_keys_tenant_id", "api_keys", ["tenant_id"])
    op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])
    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"], unique=True)

    # ---------------- reports ----------------
    op.create_table(
        "reports",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.Column("period_end", sa.DateTime(), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_reports_tenant_id", "reports", ["tenant_id"])
    op.create_index("ix_reports_created_at", "reports", ["created_at"])


def downgrade() -> None:
    op.drop_table("reports")
    op.drop_table("api_keys")
    for column in ("report_schedule", "document_retention_days", "audit_retention_days",
                   "conversation_retention_days", "llm_model", "answer_language", "hybrid_search"):
        op.drop_column("tenants", column)
    op.drop_index("ix_documents_source_path", table_name="documents")
    op.drop_index("ix_documents_version_group_id", table_name="documents")
    for column in ("legal_hold", "source_path", "superseded_at", "replaces_document_id",
                   "version_group_id", "version", "ocr_pages"):
        op.drop_column("documents", column)
    op.drop_table("refresh_tokens")
    for column in ("mfa_pending_secret", "mfa_secret", "mfa_enabled", "auth_source", "must_change_password"):
        op.drop_column("users", column)
