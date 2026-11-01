"""Installation ID for licences bound to one installation

Revision ID: d4a7b9c1e2f5
Revises: c8d2e4f6a1b3
Create Date: 2026-11-01 17:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4a7b9c1e2f5"
down_revision: Union[str, Sequence[str], None] = "c8d2e4f6a1b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "installation",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("installation_id", sa.String(length=40), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("installation")
