from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

from app.config import DATABASE_URL, DEBUG, SQLALCHEMY_ECHO

database_url = DATABASE_URL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://") and "+psycopg" not in database_url:
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Use SQLAlchemy engine for PostgreSQL on Render or SQLite fallback locally.
#
# pool_recycle=280 matters specifically for Supabase's session pooler
# (aws-*.pooler.supabase.com:5432) — it silently drops connections idle
# for a few minutes. pool_pre_ping alone doesn't reliably catch this for
# every psycopg3 disconnect error message, so connections can go stale
# and fail mid-query instead of being caught at checkout. Recycling
# every 280s (just under Supabase's ~5min idle window) keeps the pool
# from ever holding a connection old enough to have been dropped.
engine = create_engine(
    database_url,
    echo=SQLALCHEMY_ECHO,
    future=True,
    pool_pre_ping=True,
    pool_recycle=280,
)

SessionLocal = scoped_session(
    sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        future=True,
    )
)


def get_session():
    return SessionLocal()
