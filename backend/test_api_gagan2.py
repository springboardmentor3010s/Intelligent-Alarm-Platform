from fastapi.testclient import TestClient
from main import app
from auth import create_access_token
from database import SessionLocal
from Models.user import User

client = TestClient(app)

db = SessionLocal()
user = db.query(User).filter_by(email="Gagan2@gmail.com").first()
token = create_access_token(data={"sub": user.email, "id": user.id, "user_id": user.id, "role": user.role})
db.close()

headers = {"Authorization": f"Bearer {token}"}

print("=== TESTING DASHBOARD ENDPOINTS IN FASTAPI (POSTGRESQL) ===")

# 1. Alarms
res = client.get("/alarms", headers=headers)
print(f"GET /alarms: status={res.status_code}, count={len(res.json()) if res.status_code == 200 else res.text}")
if res.status_code == 200:
    for a in res.json()[:3]:
        print(f"  Alarm: {a.get('time')} - {a.get('title')} (active: {a.get('is_active')})")

# 2. Habits
res = client.get("/habits", headers=headers)
print(f"GET /habits: status={res.status_code}, count={len(res.json()) if res.status_code == 200 else res.text}")
if res.status_code == 200:
    for h in res.json():
        print(f"  Habit: {h.get('name')} (completed: {h.get('completed')})")

# 3. Profile
res = client.get("/profile", headers=headers)
print(f"GET /profile: status={res.status_code}, data={res.json().get('name') if res.status_code == 200 else res.text}")

# 4. Challenges stats
res = client.get("/challenges/analytics/stats", headers=headers)
print(f"GET /challenges/analytics/stats: status={res.status_code}, stats={res.json() if res.status_code == 200 else res.text}")

# 5. Challenges history all
res = client.get("/challenges/history/all", headers=headers)
print(f"GET /challenges/history/all: status={res.status_code}, history_count={len(res.json()) if res.status_code == 200 else res.text}")

# 6. Analytics dashboard
res = client.get("/analytics/dashboard", headers=headers)
print(f"GET /analytics/dashboard: status={res.status_code}")
if res.status_code == 200:
    data = res.json()
    curr = data.get("current")
    print(f"  Current profile score: {curr.get('habit_score') if curr else 'None'}")
    print(f"  History profiles count: {len(data.get('history', []))}")
    print(f"  Events count: {len(data.get('events', []))}")
    print(f"  Behavior trend: {data.get('behavior_trend')}")
    print(f"  Difficulty: {data.get('current_difficulty')}")
