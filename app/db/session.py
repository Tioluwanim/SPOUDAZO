from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

from app.config import DATABASE_URL, DEBUG, SQLALCHEMY_ECHO


database_url = DATABASE_URL

if database_url.startswith("postgres://"):
    database_url = database_url.replace(
        "postgres://",
        "postgresql+psycopg://",
        1,
    )
elif database_url.startswith("postgresql://") and "+psycopg" not in database_url:
    database_url = database_url.replace(
        "postgresql://",
        "postgresql+psycopg://",
        1,
    )


# ============================================================
# DATABASE ENGINE
# ============================================================
#
# PostgreSQL on Render / Supabase
#
# pool_recycle=280:
# Supabase session poolers can silently drop old connections.
# Recycling connections before the timeout helps prevent stale
# connections from being reused.
#
# pool_pre_ping=True:
# Checks connections before using them and replaces dead ones.
#
# prepare_threshold=None:
# Disables psycopg3 server-side prepared statements.
#
# This is important when using PostgreSQL connection poolers
# because a prepared statement can exist on one backend
# connection but not another. This can cause:
#
#   psycopg.errors.InvalidSqlStatementName:
#   prepared statement "_pg3_2" does not exist
#
# ============================================================

engine = create_engine(
    database_url,
    echo=SQLALCHEMY_ECHO,
    future=True,
    pool_pre_ping=True,
    pool_recycle=280,
    connect_args={
        "prepare_threshold": None,
    },
)


# ============================================================
# SESSION
# ============================================================

SessionLocal = scoped_session(
    sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        future=True,
    )
)


# ============================================================
# SESSION DEPENDENCY
# ============================================================

def get_session():
    return SessionLocal()
