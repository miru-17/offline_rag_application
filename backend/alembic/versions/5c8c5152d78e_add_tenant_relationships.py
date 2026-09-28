
"""add tenant relationships

Revision ID: 5c8c5152d78e
Revises: 941aa17dc7f2
Create Date: 2026-08-31 21:50:41.080797

"""

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5c8c5152d78e"
down_revision: Union[str, Sequence[str], None] = "941aa17dc7f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # 1. Create tenants table
    op.create_table(
        "tenants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2. Create unique index for tenant name
    op.create_index(
        op.f("ix_tenants_name"),
        "tenants",
        ["name"],
        unique=True,
    )

    # 3. Create a default tenant for existing data
    default_tenant_id = uuid.uuid4()

    op.execute(
        sa.text(
            """
            INSERT INTO tenants (id, name)
            VALUES (:tenant_id, :tenant_name)
            """
        ).bindparams(
            tenant_id=default_tenant_id,
            tenant_name="Default Tenant",
        )
    )

    # 4. Add tenant_id columns as nullable temporarily
    #    because users/documents already contain data.
    op.add_column(
        "users",
        sa.Column(
            "tenant_id",
            sa.Uuid(),
            nullable=True,
        ),
    )

    op.add_column(
        "documents",
        sa.Column(
            "tenant_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    # 5. Assign all existing users to the default tenant
    op.execute(
        sa.text(
            """
            UPDATE users
            SET tenant_id = :tenant_id
            WHERE tenant_id IS NULL
            """
        ).bindparams(
            tenant_id=default_tenant_id,
        )
    )

    # 6. Assign all existing documents to the default tenant
    op.execute(
        sa.text(
            """
            UPDATE documents
            SET tenant_id = :tenant_id
            WHERE tenant_id IS NULL
            """
        ).bindparams(
            tenant_id=default_tenant_id,
        )
    )

    # 7. Make tenant_id NOT NULL after existing rows are populated
    op.alter_column(
        "users",
        "tenant_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )

    op.alter_column(
        "documents",
        "tenant_id",
        existing_type=sa.UUID(),
        nullable=False,
    )

    # 8. Create indexes
    op.create_index(
        op.f("ix_users_tenant_id"),
        "users",
        ["tenant_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_documents_tenant_id"),
        "documents",
        ["tenant_id"],
        unique=False,
    )

    # 9. Create foreign keys
    op.create_foreign_key(
        "fk_users_tenant_id_tenants",
        "users",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "fk_documents_tenant_id_tenants",
        "documents",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Downgrade schema."""

    # Remove foreign keys
    op.drop_constraint(
        "fk_documents_tenant_id_tenants",
        "documents",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_users_tenant_id_tenants",
        "users",
        type_="foreignkey",
    )

    # Remove indexes
    op.drop_index(
        op.f("ix_documents_tenant_id"),
        table_name="documents",
    )

    op.drop_index(
        op.f("ix_users_tenant_id"),
        table_name="users",
    )

    # Remove tenant_id columns
    op.drop_column("documents", "tenant_id")
    op.drop_column("users", "tenant_id")

    # Remove tenant table
    op.drop_index(
        op.f("ix_tenants_name"),
        table_name="tenants",
    )

    op.drop_table("tenants")
