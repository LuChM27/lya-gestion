"""Ventas: cuentas, categorías, transacciones, clientes, pedidos, ítems y pagos

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-29
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    cuenta = op.create_table(
        "cuenta",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(60), nullable=False, unique=True),
        sa.Column("saldo_inicial", sa.Integer(), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False),
    )
    categoria = op.create_table(
        "categoria",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(60), nullable=False, unique=True),
        sa.Column("tipo", sa.String(10), nullable=False),
    )
    cliente = op.create_table(
        "cliente",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("whatsapp", sa.String(30)),
        sa.Column("direccion", sa.String(200)),
        sa.Column("ciudad", sa.String(80)),
        sa.Column("instagram", sa.String(80)),
        sa.Column("correo", sa.String(120)),
        sa.Column("cedula", sa.String(20)),
        sa.Column("notas", sa.String(500)),
        sa.Column("es_mostrador", sa.Boolean(), nullable=False),
        sa.Column("creado", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "pedido",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("fecha", sa.DateTime(), nullable=False, index=True),
        sa.Column("canal", sa.String(20), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("cliente.id"), nullable=False),
        sa.Column("descuento", sa.Integer(), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("nota", sa.String(200)),
        sa.Column("actualizado", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "pedido_item",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "pedido_id",
            sa.Integer(),
            sa.ForeignKey("pedido.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("variante_id", sa.Integer(), sa.ForeignKey("variante.id"), nullable=False),
        sa.Column("cantidad", sa.Integer(), nullable=False),
        sa.Column("precio_unitario", sa.Integer(), nullable=False),
        sa.Column("costo_unitario", sa.Integer()),
    )
    op.create_table(
        "pago",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "pedido_id", sa.Integer(), sa.ForeignKey("pedido.id"), nullable=False, index=True
        ),
        sa.Column("cuenta_id", sa.Integer(), sa.ForeignKey("cuenta.id"), nullable=False),
        sa.Column("fecha", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("monto", sa.Integer(), nullable=False),
    )
    op.create_table(
        "transaccion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("fecha", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("tipo", sa.String(15), nullable=False),
        sa.Column("monto", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(200), nullable=False),
        sa.Column("cuenta_id", sa.Integer(), sa.ForeignKey("cuenta.id"), nullable=False),
        sa.Column("categoria_id", sa.Integer(), sa.ForeignKey("categoria.id")),
        sa.Column("pago_id", sa.Integer(), sa.ForeignKey("pago.id"), index=True),
    )
    with op.batch_alter_table("movimiento_inventario") as tabla:
        tabla.add_column(sa.Column("pedido_id", sa.Integer()))
        tabla.create_foreign_key("fk_movimiento_pedido", "pedido", ["pedido_id"], ["id"])
        tabla.create_index("ix_movimiento_inventario_pedido_id", ["pedido_id"])

    op.bulk_insert(
        cuenta,
        [
            {"nombre": n, "saldo_inicial": 0, "activa": True}
            for n in ("Efectivo", "Nequi", "Daviplata")
        ],
    )
    op.bulk_insert(categoria, [{"nombre": "Ventas", "tipo": "ingreso"}])
    op.bulk_insert(cliente, [{"nombre": "Cliente de mostrador", "es_mostrador": True}])


def downgrade() -> None:
    with op.batch_alter_table("movimiento_inventario") as tabla:
        tabla.drop_index("ix_movimiento_inventario_pedido_id")
        tabla.drop_constraint("fk_movimiento_pedido", type_="foreignkey")
        tabla.drop_column("pedido_id")
    op.drop_table("transaccion")
    op.drop_table("pago")
    op.drop_table("pedido_item")
    op.drop_table("pedido")
    op.drop_table("cliente")
    op.drop_table("categoria")
    op.drop_table("cuenta")
