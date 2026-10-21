"""
ICAP PostgreSQL Data Viewer
Run this script anytime to inspect all data stored in PostgreSQL per user account.
Usage:
    python view_pg_data.py
    python view_pg_data.py Gagan2@gmail.com
"""

import sys
import os
from sqlalchemy import create_engine, text

# Load environment
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:Gagan%40123@localhost:5432/cognitive_alarm")

engine = create_engine(DATABASE_URL)

def view_data(filter_email=None):
    with engine.connect() as conn:
        print("=" * 70)
        print("          ICAP POSTGRESQL DATABASE INSPECTOR")
        print(f" Database: {DATABASE_URL.split('@')[-1]}")
        print("=" * 70)

        # 1. Accounts list
        users_query = "SELECT id, name, email, role, created_at FROM users"
        if filter_email:
            users_query += f" WHERE email = '{filter_email}'"
        users_query += " ORDER BY id"

        users = conn.execute(text(users_query)).fetchall()
        print(f"\n[1] USER ACCOUNTS FOUND: {len(users)}")
        print("-" * 70)
        print(f"{'ID':<5} {'Name':<20} {'Email':<30} {'Role':<15}")
        print("-" * 70)
        for u in users:
            print(f"{u[0]:<5} {u[1]:<20} {u[2]:<30} {u[3]:<15}")

        # 2. For each user, show summary of stored records
        print("\n" + "=" * 70)
        print(" [2] DATA STORED PER ACCOUNT (Linked by user_id)")
        print("=" * 70)

        for u in users:
            uid, name, email = u[0], u[1], u[2]
            print(f"\n>>> ACCOUNT #{uid}: {name} ({email})")
            
            # Count records across tables
            tables = [
                ("alarms", "Alarms Configured"),
                ("habits", "Habits Created"),
                ("wake_up_events", "Wake-up Events"),
                ("challenges", "Cognitive Challenges"),
                ("challenge_attempts", "Challenge Attempts"),
                ("behavior_profiles", "Daily Habit Scores"),
                ("sleep_logs", "Sleep Logs"),
                ("recommendations", "AI Recommendations"),
                ("notifications", "Notifications"),
            ]

            for tbl, label in tables:
                cnt = conn.execute(text(f'SELECT count(*) FROM "{tbl}" WHERE user_id = :uid'), {"uid": uid}).scalar()
                print(f"    - {label:<24}: {cnt} records")

            # Show active alarms
            active_alarms = conn.execute(
                text("SELECT id, time, title, challenge_type, difficulty FROM alarms WHERE user_id = :uid AND is_active = true"),
                {"uid": uid}
            ).fetchall()
            if active_alarms:
                print("    * Active Alarms:")
                for a in active_alarms:
                    print(f"        #{a[0]} {a[1]} - {a[2]} ({a[3]}, {a[4]})")

            # Show habits
            habits = conn.execute(
                text("SELECT id, name, category, completed FROM habits WHERE user_id = :uid"),
                {"uid": uid}
            ).fetchall()
            if habits:
                print("    * Habits:")
                for h in habits:
                    status = "[Done]" if h[3] else "[Pending]"
                    print(f"        #{h[0]} {status} {h[1]} ({h[2]})")

            # Show latest behavior profile score
            profile = conn.execute(
                text("SELECT date, habit_score, wake_up_consistency_score, snooze_count FROM behavior_profiles WHERE user_id = :uid ORDER BY date DESC LIMIT 1"),
                {"uid": uid}
            ).fetchone()
            if profile:
                print(f"    * Latest Score ({profile[0]}): Habit Score={profile[1]}/100, Wake Consistency={profile[2]}/35, Snoozes={profile[3]}")

        print("\n" + "=" * 70)
        print("Inspection complete.")
        print("=" * 70)

if __name__ == "__main__":
    email_arg = sys.argv[1] if len(sys.argv) > 1 else None
    view_data(email_arg)
