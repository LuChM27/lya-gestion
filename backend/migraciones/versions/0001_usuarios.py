"""Usuarios y sesiones

Revision ID: 0001
Revises:
Create Date: 2026-10-28
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("usuario", sa.String(80), nullable=False, unique=True),
        sa.Column("hash_contrasena", sa.String(200), nullable=False),
        sa.Column("hash_codigo_recuperacion", sa.String(200), nullable=False),
        sa.Column("rol", sa.String(20), nullable=False),
        sa.Column("creado", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "sesion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "usuario_id",
            sa.Integer(),
            sa.ForeignKey("usuario.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expira", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("sesion")
    op.drop_table("usuario")
