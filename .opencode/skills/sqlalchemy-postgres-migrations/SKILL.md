# sqlalchemy-postgres-migrations

## Purpose & Use Case
PostgreSQL schema definitions, connection pooling, and Alembic migrations for the Intelligent Cognitive Alarm Platform. Ensures database version control, reproducible deployments, and idempotent schema evolution.

## Rules & Standard Workflows
1. **SQLAlchemy 2.0 Style**: All model classes must inherit from `Base = declarative_base()` (or use new-style `ilmap`). Relationships must use `lazy="selectin"` by default. No `lazy="dynamic"` without explicit justification.
2. **Connection Pooling**: Use `asyncpg` as the async driver with `AsyncEngine` and `SessionLocal` scoped per-request. Pool size must be configurable via environment variables (`DB_POOL_SIZE`, `MAX_OVERFLOW`).
3. **Alembic Migrations**: All schema changes must be captured in Alembic revision files. Never modify `alembic_head` directly. Migration scripts must be idempotent where possible and include both `upgrade()` and `downgrade()` functions.
4. **Model Registration**: All SQLAlchemy models must be imported in `app.db.models.__init__` so that `Base.metadata.create_all()` discovers them. Use automatic discovery via `glob` pattern in production.
5. **Session Management**: Get a new DB session per request via `Depends(get_db)`. The generator must yield the session and ensure `.close()` is called in `finally` block. Never share sessions across requests.

## Best Practices & Guardrails
- Use SQLAlchemy type annotations strictly: `Mapped[int]`, `Mapped[str]`, etc. (Python 3.10+).
- Store sensitive columns (passwords, JWT secrets) using `sa.String(256)` never plain `str` in models.
- Add index on foreign key columns and frequently queried columns (e.g., `user.email`, `alarm.created_at`).
- Run `alembic check` and `alembic upgrade head` in CI/CD before deployment.
- Never commit `.env` files; always use `.env.example` with placeholder values.

## Skill Invocation
- Trigger when: a user says "create database model", "run migration", or "fix schema issue".
- Response must include: SQLAlchemy model structure, Alembic migration skeleton, and connection pool configuration reference.