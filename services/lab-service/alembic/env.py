from alembic import context
from sqlalchemy import create_engine, pool

from app.config import settings

# Migrations are written by hand (the SQL is the reviewed artefact), so there is no autogenerate target.
target_metadata = None


def run_migrations_offline() -> None:
    context.configure(url=settings.DATABASE_URL, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(settings.DATABASE_URL, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
