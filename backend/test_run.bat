@echo off
python -c "
import sys
sys.path.insert(0, '.')
from app.main import app
from fastapi.testclient import TestClient
client = TestClient(app)

# Test health
r = client.get('/health')
print('Health: %d - %s' % (r.status_code, r.json()))

# Test habit score  
r = client.get('/api/v1/habits/score')
print('Habit score: %d - %s' % (r.status_code, r.json()))

# Test challenges
r = client.get('/api/v1/challenges')
print('Challenges: %d - count: %d' % (r.status_code, len(r.json())))

# Test next challenge
r = client.get('/api/v1/challenges/next')
status = r.status_code
print('Next challenge: %s' % status, end='')
if status == 200:
    title = r.json().get('title', 'N/A')
    print(' - %s' % title)
else:
    detail = r.json().get('detail', 'N/A')
    print(' - %s' % detail)
"