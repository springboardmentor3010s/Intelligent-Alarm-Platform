from sqlalchemy import create_engine, text

try:
    engine = create_engine('postgresql+psycopg2://postgres:Gagan%40123@localhost:5432/postgres')
    with engine.connect() as conn:
        tables = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public';")).fetchall()
        tables = [t[0] for t in tables]
        print("Tables in postgres DB:", tables)
        for t in tables:
            count = conn.execute(text(f"SELECT COUNT(*) FROM {t};")).scalar()
            print(f"Table {t} has {count} rows")
except Exception as e:
    print("Error:", e)
