"""Mis cuentas y compras: categorías sembradas, gastos fijos, compras y movimientos de dinero

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-25
"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

CATEGORIAS = [
    *[
        (n, "gasto")
        for n in (
            "Insumos",
            "Envíos",
            "Publicidad",
            "Stand de feria",
            "Empaques",
            "Transporte",
            "Servicios",
            "Otros gastos",
        )
    ],
    ("Retiro personal", "retiro"),
    ("Otros ingresos", "ingreso"),
]


def upgrade() -> None:
    with op.batch_alter_table("categoria") as tabla:
        tabla.add_column(
            sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.true())
        )
    conexion = op.get_bind()
    existentes = {fila[0] for fila in conexion.execute(sa.text("SELECT nombre FROM categoria"))}
    categoria = sa.table("categoria", sa.column("nombre"), sa.column("tipo"), sa.column("activa"))
    op.bulk_insert(
        categoria,
        [{"nombre": n, "tipo": t, "activa": True} for n, t in CATEGORIAS if n not in existentes],
    )

    op.create_table(
        "gasto_fijo",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("monto", sa.Integer(), nullable=False),
        sa.Column("categoria_id", sa.Integer(), sa.ForeignKey("categoria.id"), nullable=False),
        sa.Column("cuenta_id", sa.Integer(), sa.ForeignKey("cuenta.id")),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "compra",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("fecha", sa.DateTime(), nullable=False, index=True),
        sa.Column("proveedor", sa.String(120)),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("cuenta_id", sa.Integer(), sa.ForeignKey("cuenta.id")),
        sa.Column("estado", sa.String(10), nullable=False, server_default="activa"),
        sa.Column("nota", sa.String(200)),
        sa.Column("actualizado", sa.DateTime(), nullable=False),
    )
    with op.batch_alter_table("transaccion") as tabla:
        tabla.add_column(sa.Column("cuenta_destino_id", sa.Integer()))
        tabla.add_column(sa.Column("compra_id", sa.Integer()))
        tabla.add_column(sa.Column("gasto_fijo_id", sa.Integer()))
        tabla.add_column(sa.Column("nota", sa.String(200)))
        tabla.create_foreign_key("fk_transaccion_destino", "cuenta", ["cuenta_destino_id"], ["id"])
        tabla.create_foreign_key("fk_transaccion_compra", "compra", ["compra_id"], ["id"])
        tabla.create_foreign_key(
            "fk_transaccion_gasto_fijo", "gasto_fijo", ["gasto_fijo_id"], ["id"]
        )
        tabla.create_index("ix_transaccion_compra_id", ["compra_id"])
        tabla.create_index("ix_transaccion_fecha", ["fecha"])
    for nombre in ("movimiento_inventario", "precio_insumo"):
        with op.batch_alter_table(nombre) as tabla:
            tabla.add_column(sa.Column("compra_id", sa.Integer()))
            tabla.create_foreign_key(f"fk_{nombre}_compra", "compra", ["compra_id"], ["id"])
            tabla.create_index(f"ix_{nombre}_compra_id", ["compra_id"])


def downgrade() -> None:
    for nombre in ("movimiento_inventario", "precio_insumo"):
        with op.batch_alter_table(nombre) as tabla:
            tabla.drop_index(f"ix_{nombre}_compra_id")
            tabla.drop_constraint(f"fk_{nombre}_compra", type_="foreignkey")
            tabla.drop_column("compra_id")
    with op.batch_alter_table("transaccion") as tabla:
        tabla.drop_index("ix_transaccion_fecha")
        tabla.drop_index("ix_transaccion_compra_id")
        tabla.drop_constraint("fk_transaccion_gasto_fijo", type_="foreignkey")
        tabla.drop_constraint("fk_transaccion_compra", type_="foreignkey")
        tabla.drop_constraint("fk_transaccion_destino", type_="foreignkey")
        for columna in ("nota", "gasto_fijo_id", "compra_id", "cuenta_destino_id"):
            tabla.drop_column(columna)
    op.drop_table("compra")
    op.drop_table("gasto_fijo")
    op.execute(
        "DELETE FROM categoria WHERE nombre IN ("
        + ", ".join(f"'{n}'" for n, _ in CATEGORIAS if n != "Insumos")
        + ", 'Insumos') AND id NOT IN (SELECT categoria_id FROM transaccion WHERE categoria_id IS NOT NULL)"
    )
    with op.batch_alter_table("categoria") as tabla:
        tabla.drop_column("activa")
