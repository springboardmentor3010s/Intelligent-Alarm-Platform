"""Pytest fixtures: isolated in-memory DB + FastAPI TestClient.

Run from backend/:  .venv\\Scripts\\python.exe -m pytest
"""

import os
import re
import sys
import uuid

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# Env must be set before the app imports so database.py/auth.py read them.
os.environ["SECRET_KEY"] = "test_secret_key_that_is_long_enough"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["CORS_ORIGINS"] = "http://testserver"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import get_db  # noqa: E402
from app.Models import Base  # noqa: E402
from app.main import app  # noqa: E402

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=test_engine)


@pytest.fixture()
def db():
    """Function-scoped schema on a shared in-memory DB; reset between tests."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def client(db):
    """TestClient wired to the in-memory DB via dependency override."""

    def _override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def user_headers(client):
    """Register a fresh user and return Authorization headers."""
    email = f"u{uuid.uuid4().hex[:10]}@test.io"
    reg = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "password123",
        "timezone": "UTC",
    })
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def solve_math_prompt(prompt):
    """Solve a server-generated Math prompt 'a + b' / 'a - b' / 'a x b'."""
    m = re.match(r"^(\d+)\s*([+\-x])\s*(\d+)$", prompt.strip())
    a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
    if op == "+":
        return str(a + b)
    if op == "-":
        return str(abs(a - b))
    return str(a * b)


def has_key(node, key):
    """Recursively search for `key` in nested dicts/lists."""
    if isinstance(node, dict):
        if key in node:
            return True
        return any(has_key(v, key) for v in node.values())
    if isinstance(node, list):
        return any(has_key(v, key) for v in node)
    return False


@pytest.fixture()
def solved_math_attempt(client, user_headers):
    """Fully complete a single-question Math attempt; return its metadata."""
    nxt = client.get(
        "/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=1",
        headers=user_headers,
    )
    assert nxt.status_code == 200
    ch = nxt.json()
    prompt = ch["puzzle_payload"]["questions"][0]["prompt"]
    sub = client.post("/api/v1/challenges/submit", headers=user_headers, json={
        "challenge_id": ch["id"],
        "challenge_attempt_id": ch["challenge_attempt_id"],
        "user_answer": solve_math_prompt(prompt),
        "time_taken_seconds": 20,
    })
    assert sub.status_code == 200
    res = sub.json()
    assert res["correct"] is True and res["completed"] is True
    return res
