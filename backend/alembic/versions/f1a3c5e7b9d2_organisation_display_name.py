"""Organisation display name

Revision ID: f1a3c5e7b9d2
Revises: e6b8c0d2f4a7
Create Date: 2026-11-12 18:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1a3c5e7b9d2"
down_revision: Union[str, Sequence[str], None] = "e6b8c0d2f4a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("display_name", sa.String(length=150), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "display_name")
