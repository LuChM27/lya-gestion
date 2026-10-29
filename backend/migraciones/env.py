from alembic import context
from sqlalchemy import create_engine

from app.inventario import modelos as _inventario  # noqa: F401  (registra las tablas)
from app.modelos import Base

url = context.config.attributes.get("url") or context.config.get_main_option("sqlalchemy.url")

motor = create_engine(url)
with motor.connect() as conexion:
    # render_as_batch permite ALTER TABLE en SQLite en migraciones futuras.
    context.configure(connection=conexion, target_metadata=Base.metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()
motor.dispose()
