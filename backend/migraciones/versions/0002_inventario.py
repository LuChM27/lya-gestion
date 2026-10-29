"""Inventario: modelos, variantes, insumos, precios y movimientos

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-29
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

CANTIDAD = sa.Numeric(12, 3)
PRECIO = sa.Numeric(12, 2)


def upgrade() -> None:
    op.create_table(
        "modelo",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("categoria", sa.String(20), nullable=False),
        sa.Column("precio_venta", sa.Integer(), nullable=False),
        sa.Column("horas_tejido", sa.Numeric(6, 2), nullable=False),
        sa.Column("foto", sa.String(80)),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("creado", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "variante",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "modelo_id",
            sa.Integer(),
            sa.ForeignKey("modelo.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("color", sa.String(120), nullable=False),
        sa.Column("sku", sa.String(30), nullable=False, unique=True),
        sa.Column("stock_minimo", CANTIDAD, nullable=False),
        sa.Column("foto", sa.String(80)),
        sa.Column("pieza_unica", sa.Boolean(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("modelo_id", "color"),
    )
    op.create_table(
        "insumo",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(120), nullable=False, unique=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("unidad", sa.String(20), nullable=False),
        sa.Column("unidad_compra", sa.String(20)),
        sa.Column("factor_compra", CANTIDAD),
        sa.Column("stock_minimo", CANTIDAD, nullable=False),
        sa.Column("proveedor", sa.String(120)),
        sa.Column("activo", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "precio_insumo",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "insumo_id",
            sa.Integer(),
            sa.ForeignKey("insumo.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("precio_unitario", PRECIO, nullable=False),
        sa.Column("desde", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("origen", sa.String(20), nullable=False),
    )
    op.create_table(
        "movimiento_inventario",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("fecha", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("cantidad", CANTIDAD, nullable=False),
        sa.Column("costo_unitario", PRECIO),
        sa.Column("nota", sa.String(200)),
        sa.Column("variante_id", sa.Integer(), sa.ForeignKey("variante.id"), index=True),
        sa.Column("insumo_id", sa.Integer(), sa.ForeignKey("insumo.id"), index=True),
        sa.CheckConstraint(
            "(variante_id IS NULL) != (insumo_id IS NULL)", name="ck_movimiento_un_destino"
        ),
    )


def downgrade() -> None:
    op.drop_table("movimiento_inventario")
    op.drop_table("precio_insumo")
    op.drop_table("insumo")
    op.drop_table("variante")
    op.drop_table("modelo")
