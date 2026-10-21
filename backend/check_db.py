from sqlalchemy import create_engine, text

pg_engine = create_engine('postgresql+psycopg2://postgres:Gagan%40123@localhost:5432/postgres')
with pg_engine.connect() as conn:
    dbs = conn.execute(text("SELECT datname FROM pg_database WHERE datistemplate = false;")).fetchall()
    print("Databases:", [d[0] for d in dbs])

try:
    target_engine = create_engine('postgresql+psycopg2://postgres:Gagan%40123@localhost:5432/cognitive_alarm')
    with target_engine.connect() as conn:
        tables = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public';")).fetchall()
        print("Tables in cognitive_alarm:", [t[0] for t in tables])
        
        for table in [t[0] for t in tables]:
            count = conn.execute(text(f"SELECT COUNT(*) FROM {table};")).scalar()
            print(f"Table {table} has {count} rows")
except Exception as e:
    print("Error:", e)
