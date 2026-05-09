from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings


# ── MySQL unicharm (read-only telemetry) ──────────────────────────────────────
MYSQL_URL = (
    f"mysql+aiomysql://{settings.DB_USER}:{settings.DB_PASSWORD}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
)

mysql_engine = create_async_engine(MYSQL_URL, echo=settings.LOG_SQL_ECHO, pool_pre_ping=True)

MySQLSession = sessionmaker(
    bind=mysql_engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    async with MySQLSession() as session:
        yield session


# ── Postgres thermynx_app (app data) ─────────────────────────────────────────
pg_engine = create_async_engine(
    settings.POSTGRES_URL, echo=settings.LOG_SQL_ECHO, pool_pre_ping=True
)

PGSession = sessionmaker(
    bind=pg_engine, class_=AsyncSession, expire_on_commit=False
)


async def get_pg():
    async with PGSession() as session:
        yield session


# ── ORM base (all models inherit from this) ───────────────────────────────────
class Base(DeclarativeBase):
    pass
