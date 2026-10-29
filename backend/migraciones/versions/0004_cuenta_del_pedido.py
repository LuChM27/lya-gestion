"""Cuenta del pedido: una venta anulada sigue diciendo en qué cuenta se pagó

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-29
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("pedido") as tabla:
        tabla.add_column(sa.Column("cuenta_id", sa.Integer()))
        tabla.create_foreign_key("fk_pedido_cuenta", "cuenta", ["cuenta_id"], ["id"])
    op.execute(
        "UPDATE pedido SET cuenta_id = (SELECT pago.cuenta_id FROM pago WHERE pago.pedido_id = pedido.id)"
    )


def downgrade() -> None:
    with op.batch_alter_table("pedido") as tabla:
        tabla.drop_constraint("fk_pedido_cuenta", type_="foreignkey")
        tabla.drop_column("cuenta_id")
