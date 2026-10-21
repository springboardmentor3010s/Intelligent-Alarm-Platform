import sqlalchemy
from database import engine

print("Connecting to DB...")
with engine.connect() as conn:
    try:
        conn.execute(sqlalchemy.text("ALTER TABLE habits ADD COLUMN priority VARCHAR(20) DEFAULT 'Medium'"))
        conn.commit()
        print("Added priority")
    except Exception as e:
        conn.rollback()
        print(e)
    try:
        conn.execute(sqlalchemy.text("ALTER TABLE habits ADD COLUMN time_of_day VARCHAR(30) DEFAULT 'Morning'"))
        conn.commit()
        print("Added time_of_day")
    except Exception as e:
        conn.rollback()
        print(e)
    try:
        conn.execute(sqlalchemy.text("ALTER TABLE habits ADD COLUMN notes TEXT DEFAULT ''"))
        conn.commit()
        print("Added notes")
    except Exception as e:
        conn.rollback()
        print(e)
    try:
        conn.execute(sqlalchemy.text("ALTER TABLE challenges ADD COLUMN wake_up_event_id INTEGER REFERENCES wake_up_events(id)"))
        conn.commit()
        print("Added wake_up_event_id to challenges")
    except Exception as e:
        conn.rollback()
        print(e)
print("Done!")
