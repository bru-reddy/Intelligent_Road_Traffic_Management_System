from __future__ import annotations

import logging
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


logger = logging.getLogger("irtms.database")


DATABASE_URL = settings.DATABASE_URL.strip()

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]


if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


Base = declarative_base()


def _ensure_scope_columns() -> None:
    """
    Add location-scope columns to existing deployments.

    SQLAlchemy create_all() does not alter an already-created table,
    so this small compatibility migration keeps existing PostgreSQL
    and SQLite databases usable without requiring Alembic.
    """
    table_columns = {
        "traffic_records": {
            "state": "VARCHAR(100)",
            "area": "VARCHAR(255)",
        },
        "alerts": {
            "state": "VARCHAR(100)",
        },
    }

    with engine.begin() as connection:
        inspector = __import__(
            "sqlalchemy"
        ).inspect(connection)

        for table_name, columns in table_columns.items():
            if not inspector.has_table(table_name):
                continue

            existing = {
                column["name"]
                for column in inspector.get_columns(table_name)
            }

            for column_name, column_type in columns.items():
                if column_name in existing:
                    continue

                connection.execute(
                    text(
                        f'ALTER TABLE "{table_name}" '
                        f'ADD COLUMN "{column_name}" '
                        f"{column_type}"
                    )
                )

        # Existing demo data represents Hyderabad traffic.
        # Tag it so state-wise analytics can immediately use it.
        if inspector.has_table("traffic_records"):
            connection.execute(
                text(
                    'UPDATE "traffic_records" '
                    'SET state = :state '
                    'WHERE state IS NULL '
                    'AND data_source IN '
                    "('demo-live', "
                    "'TomTom Traffic Index - Hyderabad 2025; aggregate; vehicle_count_proxy')"
                ),
                {"state": "Telangana"},
            )

        if inspector.has_table("alerts"):
            connection.execute(
                text(
                    'UPDATE "alerts" '
                    'SET state = :state '
                    'WHERE state IS NULL'
                ),
                {"state": "Telangana"},
            )


def initialize_database() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        _ensure_scope_columns()
        logger.info("IRTMS database initialized successfully.")
    except Exception:
        logger.exception("Failed to initialize database.")
        raise


def get_db() -> Generator:
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return True

    except Exception:
        logger.exception("Database connection failed.")
        return False