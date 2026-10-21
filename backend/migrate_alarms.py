from database import engine
import sqlalchemy as sa

with engine.connect() as conn:
    conn.execute(sa.text("ALTER TABLE alarms ADD COLUMN reminder_message VARCHAR(255)"))
    conn.execute(sa.text("ALTER TABLE alarms ADD COLUMN num_challenges INTEGER DEFAULT 1"))
    conn.commit()
print("Migration completed.")
