"""Create missing tables and add missing columns.

The project did not ship migrations, so this keeps an existing database
working after new features add columns. Existing data is never dropped.
"""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

import app.models  # noqa: F401  (registers every model on Base.metadata)
from app.db.base import Base

logger = logging.getLogger(__name__)


def _default_clause(column) -> str:
    default = column.server_default
    if default is None:
        return ""
    arg = getattr(default, "arg", None)
    if arg is None:
        return ""
    raw = getattr(arg, "text", arg)
    value = str(raw).replace("'", "''")
    return f" DEFAULT '{value}'"


def add_missing_columns(engine: Engine) -> list[str]:
    added: list[str] = []
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                sql_type = column.type.compile(dialect=engine.dialect)
                default = _default_clause(column)
                not_null = (
                    " NOT NULL"
                    if (not column.nullable and default)
                    else ""
                )
                statement = (
                    f'ALTER TABLE "{table.name}" '
                    f'ADD COLUMN IF NOT EXISTS "{column.name}" '
                    f"{sql_type}{default}{not_null}"
                )
                connection.execute(text(statement))
                added.append(f"{table.name}.{column.name}")
    return added


def init_db(engine: Engine) -> None:
    Base.metadata.create_all(bind=engine)
    added = add_missing_columns(engine)
    if added:
        logger.info("Added missing columns: %s", ", ".join(added))
