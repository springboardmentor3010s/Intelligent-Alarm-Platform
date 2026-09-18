import sqlite3
conn = sqlite3.connect('cerebrokognit.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()
print('Tables:', [t[0] for t in tables])

cursor.execute('SELECT COUNT(*) FROM habit_scores')
print('HabitScores count:', cursor.fetchone()[0])

cursor.execute('SELECT * FROM habit_scores LIMIT 5')
rows = cursor.fetchall()
for r in rows:
    print('HabitScore row:', r)

cursor.execute('SELECT COUNT(*) FROM alarms WHERE user_id = 1')
print('Alarms for user 1:', cursor.fetchone()[0])

cursor.execute('SELECT COUNT(*) FROM challenge_attempts WHERE user_id = 1')
print('Challenge attempts for user 1:', cursor.fetchone()[0])

cursor.execute('SELECT COUNT(*) FROM habit_scores WHERE user_id = 1')
print('HabitScores for user 1:', cursor.fetchone()[0])

cursor.execute('SELECT * FROM habit_scores WHERE user_id = 1')
rows = cursor.fetchall()
for r in rows:
    print('HabitScore user 1:', r)

cursor.execute('SELECT * FROM alarms WHERE user_id = 1 LIMIT 5')
rows = cursor.fetchall()
for r in rows:
    print('Alarm row:', r)

conn.close()
