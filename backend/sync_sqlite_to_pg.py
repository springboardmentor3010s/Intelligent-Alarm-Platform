import sqlite3
import os
from sqlalchemy import create_engine, text, inspect
from database import Base
import Models.user
import Models.habit
import Models.alarm
import Models.challenge
import Models.coach
import Models.analytics
import Models.notification

PG_URL = 'postgresql+psycopg2://postgres:Gagan%40123@localhost:5432/cognitive_alarm'
SQLITE_PATH = 'cognitive_alarm.db'

print(f"Connecting to PostgreSQL: {PG_URL.split('@')[-1]}")
pg_engine = create_engine(PG_URL, pool_pre_ping=True)

# 1. Create all tables if not present
print("Step 1: Creating tables if missing...")
Base.metadata.create_all(bind=pg_engine)

# 2. Add any missing columns in PostgreSQL
print("Step 2: Ensuring all schema columns exist...")
with pg_engine.begin() as conn:
    # alarms table upgrades
    try:
        conn.execute(text("ALTER TABLE alarms ADD COLUMN IF NOT EXISTS reminder_message VARCHAR(255)"))
        conn.execute(text("ALTER TABLE alarms ADD COLUMN IF NOT EXISTS num_challenges INTEGER DEFAULT 1"))
        print("  - alarms: reminder_message & num_challenges verified")
    except Exception as e:
        print(f"  - alarms update: {e}")

    # habits table upgrades
    try:
        conn.execute(text("ALTER TABLE habits ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"))
        conn.execute(text("ALTER TABLE habits ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Medium'"))
        conn.execute(text("ALTER TABLE habits ADD COLUMN IF NOT EXISTS time_of_day VARCHAR(30) DEFAULT 'Morning'"))
        conn.execute(text("ALTER TABLE habits ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''"))
        conn.execute(text("ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_time VARCHAR(5)"))
        conn.execute(text("ALTER TABLE habits ADD COLUMN IF NOT EXISTS start_date DATE"))
        conn.execute(text("ALTER TABLE habits ADD COLUMN IF NOT EXISTS target_date DATE"))
        conn.execute(text("ALTER TABLE habits ADD COLUMN IF NOT EXISTS goal_target VARCHAR(255) DEFAULT ''"))
        conn.execute(text("ALTER TABLE habits ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE"))
        conn.execute(text("ALTER TABLE habits ADD COLUMN IF NOT EXISTS selected_days VARCHAR(100)"))
        print("  - habits: all columns verified")
    except Exception as e:
        print(f"  - habits update: {e}")

    # wake_up_events table upgrades
    try:
        conn.execute(text("ALTER TABLE wake_up_events ADD COLUMN IF NOT EXISTS snoozes INTEGER DEFAULT 0"))
        conn.execute(text("ALTER TABLE wake_up_events ADD COLUMN IF NOT EXISTS difficulty_adapted BOOLEAN DEFAULT FALSE"))
        print("  - wake_up_events: snoozes & difficulty_adapted verified")
    except Exception as e:
        print(f"  - wake_up_events update: {e}")

# 3. Pre-inspect PostgreSQL column names and types BEFORE entering transaction
print("Step 3: Pre-inspecting table columns...")
insp = inspect(pg_engine)
pg_table_cols = {}
pg_boolean_cols = {}
for t in insp.get_table_names():
    cols = insp.get_columns(t)
    pg_table_cols[t] = {c['name'] for c in cols}
    pg_boolean_cols[t] = {c['name'] for c in cols if 'bool' in str(c['type']).lower()}

TABLES_IN_ORDER = [
    "users",
    "user_profiles",
    "habits",
    "alarms",
    "wake_up_events",
    "challenges",
    "challenge_attempts",
    "coach_assignments",
    "coach_guidance",
    "behavior_profiles",
    "recommendations",
    "sleep_logs",
    "notifications",
    "announcements",
    "coach_messages",
]

print("\nStep 4: Migrating data from SQLite to PostgreSQL...")
sq_conn = sqlite3.connect(SQLITE_PATH)
sq_conn.row_factory = sqlite3.Row
sq_cur = sq_conn.cursor()

total_migrated = 0

with pg_engine.begin() as conn:
    for table in reversed(TABLES_IN_ORDER):
        conn.execute(text(f'TRUNCATE TABLE "{table}" CASCADE;'))
    print("  - Truncated destination tables cleanly.")

    for table in TABLES_IN_ORDER:
        sq_cur.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
        if not sq_cur.fetchone():
            continue

        if table == "users":
            sq_cur.execute('SELECT * FROM "users" WHERE email != \'testuser99@example.com\'')
        else:
            sq_cur.execute(f'SELECT * FROM "{table}"')
        rows = sq_cur.fetchall()
        if not rows:
            print(f"  - {table}: 0 rows (skipped)")
            continue

        sq_cols = [d[0] for d in sq_cur.description]
        available_pg_cols = pg_table_cols.get(table, set())
        common_cols = [c for c in sq_cols if c in available_pg_cols]

        col_str = ", ".join([f'"{c}"' for c in common_cols])
        param_str = ", ".join([f":{c}" for c in common_cols])
        insert_query = text(f'INSERT INTO "{table}" ({col_str}) VALUES ({param_str})')

        bool_cols = pg_boolean_cols.get(table, set())

        data_list = []
        for r in rows:
            row_dict = {}
            for col in common_cols:
                val = r[col]
                if col in bool_cols:
                    if val is not None:
                        val = True if val in (1, "1", True, "true", "True") else False
                row_dict[col] = val
            data_list.append(row_dict)

        # If migrating wake_up_events or challenges, remap any orphaned alarm_ids (1, 3, 12, 13, 14) to real alarm 5
        if table in ("wake_up_events", "challenges"):
            for row_dict in data_list:
                if row_dict.get("alarm_id") in (1, 3, 12, 13, 14):
                    row_dict["alarm_id"] = 5

        conn.execute(insert_query, data_list)
        total_migrated += len(data_list)
        print(f"  + {table}: Migrated {len(data_list)} rows")

        if "id" in common_cols:
            try:
                conn.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM \"{table}\"), 1), "
                    f"(SELECT MAX(id) FROM \"{table}\") IS NOT NULL)"
                ))
            except Exception:
                pass

sq_conn.close()
print(f"\n[SUCCESS] Total rows migrated to PostgreSQL: {total_migrated}")
