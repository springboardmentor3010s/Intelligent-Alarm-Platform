from database import engine
from sqlalchemy import text

with engine.begin() as conn:
    try:
        conn.execute(text('ALTER TABLE wake_up_events ADD COLUMN snoozes INTEGER DEFAULT 0'))
        print("Table altered successfully.")
    except Exception as e:
        print(f"Column might already exist: {e}")
