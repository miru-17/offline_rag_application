"""commercial features: security, ingestion status, audit, signed licence,
datasets, extraction, team spaces, feedback

Only adds tables and columns. Existing rows are kept and given safe values.

Revision ID: b7c1e2d3f4a5
Revises: a6cf367c83ef
Create Date: 2026-10-30 21:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b7c1e2d3f4a5"
down_revision: Union[str, Sequence[str], None] = "a6cf367c83ef"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    # ---------------- users ----------------
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))

    # ---------------- tenants ----------------
    op.add_column("tenants", sa.Column("pii_mode", sa.String(10), nullable=False, server_default="flag"))

    # ---------------- groups ----------------
    op.create_table(
        "groups",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "name", name="uq_group_tenant_name"),
    )
    op.create_index("ix_groups_tenant_id", "groups", ["tenant_id"])
    op.create_table(
        "group_members",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("group_id", UUID, sa.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("group_id", "user_id", name="uq_group_member"),
    )
    op.create_index("ix_group_members_group_id", "group_members", ["group_id"])
    op.create_index("ix_group_members_user_id", "group_members", ["user_id"])

    # ---------------- documents ----------------
    op.add_column("documents", sa.Column("group_id", UUID, sa.ForeignKey("groups.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_documents_group_id", "documents", ["group_id"])
    op.add_column("documents", sa.Column("status", sa.String(20), nullable=False, server_default="ready"))
    op.create_index("ix_documents_status", "documents", ["status"])
    op.add_column("documents", sa.Column("error_message", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("documents", sa.Column("page_count", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("file_size", sa.BigInteger(), nullable=True))
    op.add_column("documents", sa.Column("content_hash", sa.String(64), nullable=True))
    op.create_index("ix_documents_content_hash", "documents", ["content_hash"])
    op.add_column("documents", sa.Column("pii_summary", sa.JSON(), nullable=True))
    op.add_column("documents", sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True))
    # Old uploads that never finished processing are marked failed.
    op.execute(
        "UPDATE documents SET status='failed', "
        "error_message='Processing did not complete. Delete and upload again.' "
        "WHERE processed = false"
    )

    # ---------------- messages ----------------
    op.add_column("messages", sa.Column("sources", sa.JSON(), nullable=True))
    op.add_column("messages", sa.Column("answer_status", sa.String(20), nullable=True))
    op.create_index("ix_messages_answer_status", "messages", ["answer_status"])
    op.add_column("messages", sa.Column("feedback_rating", sa.String(10), nullable=True))
    op.add_column("messages", sa.Column("feedback_reason", sa.String(500), nullable=True))

    # ---------------- licenses ----------------
    op.add_column("licenses", sa.Column("signed_license", sa.Text(), nullable=True))
    op.add_column("licenses", sa.Column("customer", sa.String(255), nullable=True))
    op.add_column("licenses", sa.Column("max_users", sa.Integer(), nullable=True))
    op.add_column("licenses", sa.Column("features", sa.JSON(), nullable=True))
    op.add_column("licenses", sa.Column("last_seen_at", sa.DateTime(), nullable=True))

    # ---------------- audit ----------------
    op.create_table(
        "audit_events",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("actor_id", UUID, nullable=True),
        sa.Column("actor_username", sa.String(100), nullable=True),
        sa.Column("action", sa.String(60), nullable=False),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("target_type", sa.String(40), nullable=True),
        sa.Column("target_id", sa.String(64), nullable=True),
        sa.Column("target_label", sa.String(255), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for col in ("tenant_id", "actor_id", "action", "created_at"):
        op.create_index(f"ix_audit_events_{col}", "audit_events", [col])

    # ---------------- datasets ----------------
    op.create_table(
        "datasets",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_type", sa.String(10), nullable=False),
        sa.Column("sheet_name", sa.String(100), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("content_hash", sa.String(64), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("columns", sa.JSON(), nullable=False),
        sa.Column("visibility", sa.String(20), nullable=False),
        sa.Column("origin", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for col in ("tenant_id", "user_id", "content_hash"):
        op.create_index(f"ix_datasets_{col}", "datasets", [col])

    # ---------------- extraction ----------------
    op.create_table(
        "extraction_jobs",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("fields", sa.JSON(), nullable=False),
        sa.Column("document_ids", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("processed_count", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("results", sa.JSON(), nullable=True),
        sa.Column("dataset_id", UUID, sa.ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    for col in ("tenant_id", "user_id", "status"):
        op.create_index(f"ix_extraction_jobs_{col}", "extraction_jobs", [col])


def downgrade() -> None:
    op.drop_table("extraction_jobs")
    op.drop_table("datasets")
    op.drop_table("audit_events")
    for col in ("last_seen_at", "features", "max_users", "customer", "signed_license"):
        op.drop_column("licenses", col)
    for col in ("feedback_reason", "feedback_rating", "answer_status", "sources"):
        if col == "answer_status":
            op.drop_index("ix_messages_answer_status", "messages")
        op.drop_column("messages", col)
    op.drop_index("ix_documents_content_hash", "documents")
    op.drop_index("ix_documents_status", "documents")
    op.drop_index("ix_documents_group_id", "documents")
    for col in ("processed_at", "pii_summary", "content_hash", "file_size", "page_count",
                "chunk_count", "error_message", "status", "group_id"):
        op.drop_column("documents", col)
    op.drop_table("group_members")
    op.drop_table("groups")
    op.drop_column("tenants", "pii_mode")
    for col in ("last_login_at", "token_version", "is_active"):
        op.drop_column("users", col)
