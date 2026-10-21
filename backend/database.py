import os
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base


# Environment-driven database configuration:
# 1. DATABASE_URL environment variable (from .env, Docker Compose, or system env)
# 2. Defaults to local SQLite database file if not configured
DEFAULT_SQLITE_URL = "sqlite:///./cognitive_alarm.db"
_env_db_url = os.getenv("DATABASE_URL")
DATABASE_URL = _env_db_url.strip() if _env_db_url and _env_db_url.strip() else DEFAULT_SQLITE_URL


def get_engine_args(url: str):
    """
    Returns engine arguments tailored to the database dialect.
    SQLite requires check_same_thread=False for multi-threaded FastAPI.
    PostgreSQL/MySQL must not receive check_same_thread.
    """
    if url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    return {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }


try:
    engine = create_engine(DATABASE_URL, **get_engine_args(DATABASE_URL))

    with engine.connect() as conn:
        pass

    dialect_name = engine.dialect.name.upper()
    if dialect_name == "SQLITE":
        print(f"Connected to SQLite database ({DATABASE_URL}).")
    else:
        print(f"Connected to {dialect_name} database successfully.")

except Exception as e:
    dialect_name = "PostgreSQL" if "postgres" in DATABASE_URL.lower() else "Configured"
    error_msg = (
        f"Database connection error: Unable to connect to {dialect_name} database at '{DATABASE_URL}'. "
        f"When DATABASE_URL is specified, silent fallback to SQLite is disabled to prevent data divergence. "
        f"Ensure the database server is running, the host and port are reachable, credentials are valid, "
        f"and the required driver (e.g. psycopg2-binary) is installed. Error details: {e}"
    )
    print(f"CRITICAL: {error_msg}")
    raise RuntimeError(error_msg) from e


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    upgrade_habit_schema()
    upgrade_alarm_schema()
    upgrade_wake_up_event_schema()
    print("Database tables initialized.")

    # Auto-migrate SQLite data into PostgreSQL if target DB is empty
    if engine.dialect.name.upper() != "SQLITE":
        auto_migrate = os.getenv("AUTO_MIGRATE_SQLITE", "true").lower() in ("true", "1", "yes")
        sqlite_file = os.getenv("SQLITE_SOURCE_PATH", "cognitive_alarm.db")
        if auto_migrate and os.path.exists(sqlite_file):
            try:
                with engine.connect() as check_conn:
                    user_count = check_conn.execute(text("SELECT count(*) FROM users")).scalar()
                if user_count == 0:
                    print("PostgreSQL database is currently empty. Auto-migrating data from SQLite...")
                    from migrate_sqlite_to_pg import migrate
                    migrate(sqlite_path=sqlite_file, pg_url=DATABASE_URL)
            except Exception as mig_err:
                print(f"Auto-migration notice: {mig_err}")



def upgrade_habit_schema(target_engine=None):
    """
    Add missing columns expected by the existing Habit model.
    """
    eng = target_engine or engine
    inspector = inspect(eng)

    if "habits" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("habits")
    }

    additions = {
        "description": "TEXT DEFAULT ''",
        "priority": "VARCHAR(20) DEFAULT 'Medium'",
        "time_of_day": "VARCHAR(30) DEFAULT 'Morning'",
        "notes": "TEXT DEFAULT ''",
        "reminder_time": "VARCHAR(5)",
        "start_date": "DATE",
        "target_date": "DATE",
        "goal_target": "VARCHAR(255) DEFAULT ''",
        "is_enabled": "BOOLEAN DEFAULT TRUE",
    }

    with eng.begin() as connection:
        for column, definition in additions.items():
            if column not in existing_columns:
                connection.execute(
                    text(
                        f"ALTER TABLE habits ADD COLUMN "
                        f"{column} {definition}"
                    )
                )

                print(f"Added missing habit column: {column}")


def upgrade_alarm_schema(target_engine=None):
    """
    Add missing columns expected by the existing Alarm model (reminder_message, num_challenges).
    """
    eng = target_engine or engine
    inspector = inspect(eng)
    if "alarms" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("alarms")}
    additions = {
        "reminder_message": "VARCHAR(255)",
        "num_challenges": "INTEGER DEFAULT 1",
    }

    with eng.begin() as connection:
        for column, definition in additions.items():
            if column not in existing_columns:
                connection.execute(text(f"ALTER TABLE alarms ADD COLUMN {column} {definition}"))
                print(f"Added missing alarm column: {column}")


def upgrade_wake_up_event_schema(target_engine=None):
    """
    Add difficulty_adapted and snoozes columns to wake_up_events table if missing.
    """
    eng = target_engine or engine
    inspector = inspect(eng)
    if "wake_up_events" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("wake_up_events")
    }

    with eng.begin() as connection:
        if "difficulty_adapted" not in existing_columns:
            connection.execute(
                text("ALTER TABLE wake_up_events ADD COLUMN difficulty_adapted BOOLEAN DEFAULT FALSE")
            )
            print("Added missing wake_up_events column: difficulty_adapted")

        if "snoozes" not in existing_columns:
            connection.execute(
                text("ALTER TABLE wake_up_events ADD COLUMN snoozes INTEGER DEFAULT 0")
            )
            print("Added missing wake_up_events column: snoozes")