"""
SQLite to PostgreSQL Data Migration Script
Migrates all SQLite records (users, profiles, habits, alarms, challenges, coach, analytics, etc.)
from local cognitive_alarm.db into a target PostgreSQL database.
"""

import os
import sys
import argparse
import sqlite3
from datetime import datetime, date
from sqlalchemy import create_engine, text, inspect
import Models.user
import Models.habit
import Models.alarm
import Models.challenge
import Models.coach
import Models.analytics
import Models.notification
from database import Base, upgrade_habit_schema, upgrade_wake_up_event_schema

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

def migrate(sqlite_path="cognitive_alarm.db", pg_url=None, overwrite=False):
    if not os.path.exists(sqlite_path):
        print(f"[ERROR] SQLite database file not found at: {sqlite_path}")
        return False

    if not pg_url:
        pg_url = os.getenv("DATABASE_URL")

    if not pg_url or "sqlite" in pg_url.lower():
        print("[ERROR] Please provide a valid PostgreSQL connection URL via --target-url or DATABASE_URL.")
        return False

    print(f"[*] Source SQLite DB: {sqlite_path}")
    print(f"[*] Target PostgreSQL URL: {pg_url.split('@')[-1] if '@' in pg_url else pg_url}")

    # Connect to PostgreSQL
    try:
        pg_engine = create_engine(pg_url, pool_pre_ping=True)
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[+] Successfully connected to PostgreSQL database.")
    except Exception as e:
        print(f"[ERROR] Cannot connect to PostgreSQL: {e}")
        return False

    # Initialize tables in PostgreSQL
    print("[*] Creating schema in PostgreSQL if not present...")
    Base.metadata.create_all(bind=pg_engine)
    upgrade_habit_schema(target_engine=pg_engine)
    upgrade_wake_up_event_schema(target_engine=pg_engine)
    print("[+] Schemas synchronized.")

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    total_records_migrated = 0
    target_inspector = inspect(pg_engine)
    all_target_cols = {}
    for table in TABLES_IN_ORDER:
        try:
            all_target_cols[table] = {c["name"]: str(c["type"]).upper() for c in target_inspector.get_columns(table)}
        except Exception:
            all_target_cols[table] = {}

    with pg_engine.begin() as pg_conn:
        for table in TABLES_IN_ORDER:
            # Check if source table exists in SQLite
            sqlite_cur.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not sqlite_cur.fetchone():
                continue

            # Fetch all rows from SQLite
            sqlite_cur.execute(f'SELECT * FROM "{table}"')
            rows = sqlite_cur.fetchall()
            row_count = len(rows)

            if row_count == 0:
                print(f"  [-] {table}: 0 rows (skipped)")
                continue

            # Check existing count in PG
            existing_count = pg_conn.execute(text(f'SELECT count(*) FROM "{table}"')).scalar()
            if existing_count > 0 and not overwrite:
                print(f"  [!] {table}: Already contains {existing_count} rows in PostgreSQL. (Use --overwrite to replace, skipping)")
                continue
            elif existing_count > 0 and overwrite:
                print(f"  [~] {table}: Overwrite enabled, truncating PostgreSQL table...")
                pg_conn.execute(text(f'TRUNCATE TABLE "{table}" CASCADE'))

            # Get target column types for proper casting
            target_cols = all_target_cols.get(table, {})

            # Prepare insert
            source_columns = [col[0] for col in sqlite_cur.description]
            valid_columns = [c for c in source_columns if c in target_cols]

            col_names_str = ", ".join([f'"{c}"' for c in valid_columns])
            placeholders_str = ", ".join([f":{c}" for c in valid_columns])
            insert_stmt = text(f'INSERT INTO "{table}" ({col_names_str}) VALUES ({placeholders_str})')

            data_dicts = []
            for row in rows:
                data_dict = {}
                for col in valid_columns:
                    val = row[col]
                    col_type = target_cols.get(col, "")
                    if "BOOL" in col_type:
                        if val is not None:
                            val = True if val in (1, "1", "true", "True", True) else False
                    elif "DATETIME" in col_type or "TIMESTAMP" in col_type:
                        if isinstance(val, str) and val.strip():
                            try:
                                val = datetime.fromisoformat(val.strip())
                            except Exception:
                                pass
                    elif "DATE" in col_type:
                        if isinstance(val, str) and val.strip():
                            try:
                                val = date.fromisoformat(val.strip()[:10])
                            except Exception:
                                pass
                    data_dict[col] = val
                data_dicts.append(data_dict)

            # Preserve foreign key integrity for historical challenges/events referencing deleted alarms
            if table == "alarms":
                existing_alarm_ids = {r["id"] for r in rows}
                referenced_alarm_ids = set()
                try:
                    sqlite_cur.execute("SELECT DISTINCT alarm_id FROM wake_up_events WHERE alarm_id IS NOT NULL")
                    referenced_alarm_ids.update(r[0] for r in sqlite_cur.fetchall())
                except Exception:
                    pass
                try:
                    sqlite_cur.execute("SELECT DISTINCT alarm_id FROM challenges WHERE alarm_id IS NOT NULL")
                    referenced_alarm_ids.update(r[0] for r in sqlite_cur.fetchall())
                except Exception:
                    pass
                missing_alarm_ids = referenced_alarm_ids - existing_alarm_ids
                for m_id in sorted(missing_alarm_ids):
                    placeholder = {
                        "id": m_id,
                        "user_id": 1,
                        "title": "Archived Alarm",
                        "time": "07:00",
                        "alarm_type": "Daily",
                        "days_of_week": "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
                        "is_active": False,
                        "challenge_type": "Math Problems",
                        "difficulty": "Medium",
                        "snooze_limit": 3,
                        "sound_tone": "Gentle Chimes",
                        "reminder_message": "",
                        "num_challenges": 1,
                        "created_at": datetime.now()
                    }
                    data_dicts.append({col: placeholder.get(col) for col in valid_columns})
                if missing_alarm_ids:
                    print(f"  [+] alarms: Added {len(missing_alarm_ids)} inactive archived alarm placeholders for historical records.")

            pg_conn.execute(insert_stmt, data_dicts)
            total_records_migrated += len(data_dicts)
            print(f"  [+] {table}: Migrated {len(data_dicts)} rows.")

            # Reset sequence for PostgreSQL if table has 'id' column
            if "id" in valid_columns:
                try:
                    pg_conn.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                        f"COALESCE((SELECT MAX(id) FROM \"{table}\"), 1), "
                        f"(SELECT MAX(id) FROM \"{table}\") IS NOT NULL)"
                    ))
                except Exception as seq_err:
                    pass

    sqlite_conn.close()
    print(f"\n[SUCCESS] Migration completed! Total records migrated: {total_records_migrated}")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate SQLite data to PostgreSQL for ICAP")
    parser.add_argument("--sqlite-path", default="cognitive_alarm.db", help="Path to sqlite db file")
    parser.add_argument("--target-url", default=None, help="PostgreSQL connection string (e.g. postgresql+psycopg2://postgres:postgres@localhost:5432/postgres)")
    parser.add_argument("--overwrite", action="store_true", help="Truncate target tables before inserting")

    args = parser.parse_args()
    success = migrate(sqlite_path=args.sqlite_path, pg_url=args.target_url, overwrite=args.overwrite)
    sys.exit(0 if success else 1)
