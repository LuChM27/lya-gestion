"""Clientes: un WhatsApp por clienta, también si dos equipos guardan a la vez

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-25
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # El mostrador no tiene WhatsApp: SQLite deja varios NULL en un índice único.
    op.create_index("uq_cliente_whatsapp", "cliente", ["whatsapp"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_cliente_whatsapp", table_name="cliente")
