import urllib.request
import json

# Login to get token
login_req = urllib.request.Request(
    "http://localhost:8000/api/v1/auth/login",
    data=json.dumps({"email": "demo@cerebro.com", "password": "password123"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST"
)
resp = urllib.request.urlopen(login_req)
data = json.loads(resp.read())
token = data["access_token"]
print(f"Got token: {token[:20]}...")

# Test habits score
req = urllib.request.Request(
    "http://localhost:8000/api/v1/habits/score",
    headers={"Authorization": f"Bearer {token}"}
)
resp = urllib.request.urlopen(req)
result = json.loads(resp.read())
print(f"Habit score: {json.dumps(result, indent=2)}")
