import uuid
from datetime import timedelta

import pytest

from app.core.database import SessionLocal
from app.core.timeutil import utcnow
from app.models import Alarm, ChallengeInstance, WakeSession
from app.services import jobs
from tests.conftest import register, correct_answer


def user_utc(client, email="u@example.com"):
    h, _ = register(client, email)
    r = client.put("/users/me/profile", headers=h, json={
        "timezone": "UTC", "sleep_duration_minutes": 450, "bedtime": "23:00:00", "preferred_wake_time": "07:00:00"})
    assert r.status_code == 200, r.text
    return h


def guard_midnight():
    n = utcnow()
    if n.hour == 0 and n.minute < 3 or n.hour == 23 and n.minute > 56:
        pytest.skip("too close to midnight UTC for wall-clock based test")


def due_alarm(client, h, seconds_ago=20, backdate=True, **kw):
    guard_midnight()
    t = (utcnow() - timedelta(seconds=seconds_ago)).time().replace(microsecond=0)
    r = client.post("/alarms", headers=h, json={"label": "Test", "time": t.isoformat(), "alarm_type": "daily", **kw})
    assert r.status_code == 201, r.text
    aid = r.json()["id"]
    if backdate:
        s = SessionLocal()
        a = s.get(Alarm, uuid.UUID(aid))
        a.created_at = utcnow() - timedelta(days=2)
        s.commit()
        s.close()
    return aid


def tick():
    s = SessionLocal()
    try:
        return jobs.tick(s)
    finally:
        s.close()


def active(client, h):
    return client.get("/wake/active", headers=h).json()["session"]


def answer(client, h, sess, text=None, wrong=False):
    ch = sess["challenge"]
    ans = "definitely-wrong-answer" if wrong else (text or correct_answer(ch["id"]))
    r = client.post(f"/wake/{sess['id']}/answer", headers=h, json={"instance_id": ch["id"], "answer": ans})
    assert r.status_code == 200, r.text
    return r.json()


def db_session(sid):
    s = SessionLocal()
    obj = s.get(WakeSession, uuid.UUID(sid))
    return s, obj
