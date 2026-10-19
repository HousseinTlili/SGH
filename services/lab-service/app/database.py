import asyncio
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

logger = logging.getLogger("lab-service.db")

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

db_ready = False

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def connect_and_init_db():
    global db_ready
    delays = [1, 2, 4, 8, 16, 30]
    attempt = 0

    while not db_ready:
        try:
            logger.info("Attempting database connection and schema setup for sgh_lab...")
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            # Import models to ensure all metadata is registered
            from app import models, seed
            Base.metadata.create_all(bind=engine)

            # Seed initial catalogue and fixtures
            with SessionLocal() as session:
                seed.seed_lab_data(session)

            db_ready = True
            logger.info("Database initialized and ready. Lab service ready.")
            return
        except Exception as e:
            delay = delays[min(attempt, len(delays) - 1)]
            logger.warning(f"Database not ready (attempt {attempt + 1}): {e}. Retrying in {delay}s...")
            attempt += 1
            await asyncio.sleep(delay)
