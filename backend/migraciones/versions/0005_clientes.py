"""Clientes: archivar

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-25
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("cliente") as tabla:
        tabla.add_column(
            sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true())
        )


def downgrade() -> None:
    with op.batch_alter_table("cliente") as tabla:
        tabla.drop_column("activo")
