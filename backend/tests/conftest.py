import os
import tempfile

_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ.update({"ENV": "test", "DATABASE_URL": f"sqlite:///{_db}", "SCHEDULER_ENABLED": "false",
                   "SECRET_KEY": "x" * 48, "COOKIE_PATH": "/", "ADMIN_EMAIL": "", "MONGO_URL": ""})

import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.models import ChallengeInstance, User

PW = "Str0ngPassw0rd!"


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db():
    s = SessionLocal()
    yield s
    s.close()


def register(client, email, name="Test User", account_type="member", pw=PW):
    r = client.post("/auth/register", json={"full_name": name, "email": email, "password": pw, "account_type": account_type})
    assert r.status_code == 201, r.text
    body = r.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]


def set_role(email, role):
    s = SessionLocal()
    u = s.query(User).filter(User.email == email).first()
    u.role = role
    u.coach_requested = False
    s.commit()
    s.close()


def login(client, email, pw=PW, portal=None):
    r = client.post("/auth/login", json={"email": email, "password": pw, "portal": portal})
    return r


def auth(client, email, pw=PW, portal=None):
    r = login(client, email, pw, portal)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def correct_answer(instance_id):
    s = SessionLocal()
    a = s.get(ChallengeInstance, __import__("uuid").UUID(instance_id)).correct_answer.split("|")[0]
    s.close()
    return a
