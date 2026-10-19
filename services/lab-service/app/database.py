import asyncio
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

logger = logging.getLogger("lab-service.db")

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args={"connect_timeout": 3},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

db_ready = False

SERVICE_ROOT = Path(__file__).resolve().parent.parent


def is_database_down(exc: BaseException) -> bool:
    """True for connection-level failures (database stopped or unreachable), not for bad queries."""
    if isinstance(exc, OperationalError):
        return True
    if isinstance(exc, DBAPIError):
        return bool(exc.connection_invalidated)
    return False


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations() -> None:
    """Applies the versioned migrations in alembic/versions (idempotent)."""
    config = Config(str(SERVICE_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(SERVICE_ROOT / "alembic"))
    command.upgrade(config, "head")


def initialise_database() -> None:
    """One attempt: connect, migrate, seed. Raises when the database is not usable yet."""
    global db_ready
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    run_migrations()

    from app import seed  # imported late so models are only loaded when the database is there

    with SessionLocal() as session:
        seed.seed_lab_data(session)

    db_ready = True


async def connect_and_init_db() -> None:
    """X-8: retry in the background with backoff; /api answers 503 until this succeeds."""
    delays = [1, 2, 4, 8, 16, 30]
    attempt = 0
    while not db_ready:
        try:
            logger.info("Connecting to PostgreSQL, migrating and seeding sgh_lab...")
            # Blocking SQL runs in a worker thread so the event loop keeps serving /health.
            await asyncio.to_thread(initialise_database)
            logger.info("Database migrated and seeded. Lab service ready.")
            return
        except Exception as exc:
            delay = delays[min(attempt, len(delays) - 1)]
            logger.warning("Database not ready (attempt %d): %s. Retrying in %ds...", attempt + 1, exc.__class__.__name__, delay)
            attempt += 1
            await asyncio.sleep(delay)
