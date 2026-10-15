"""
Shared pytest fixtures — isolated in-memory SQLite DB per test, FastAPI
TestClient with the `get_db` dependency overridden so tests never touch the
real dev/production database.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import Base, get_db
from app.models.models import User
from app.core.security import hash_password
from app.core.oauth import PROVIDERS


@pytest.fixture(autouse=True)
def _isolate_oauth_credentials(monkeypatch):
    """Tests must not see real Google/GitHub credentials from the developer's .env —
    PROVIDERS captures them at import time, so patch the dict directly, not `settings`."""
    for provider in PROVIDERS.values():
        monkeypatch.setitem(provider, "client_id", "")
        monkeypatch.setitem(provider, "client_secret", "")


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def register_user(client):
    """Registers + logs in a USER account, returns (user_json, auth_headers)."""
    def _register(name="Test User", email="user@example.com", password="testpass123", role="USER"):
        client.post("/auth/register", json={"name": name, "email": email, "password": password, "role": role})
        r = client.post("/auth/login", json={"email": email, "password": password})
        token = r.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    return _register


@pytest.fixture()
def make_admin(db_engine):
    """Directly inserts an ADMINISTRATOR user (bypasses /auth/register, which disallows this role)."""
    def _make(email="admin@example.com", password="adminpass123"):
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
        db = TestingSessionLocal()
        try:
            user = User(name="Admin", email=email, password_hash=hash_password(password), role="ADMINISTRATOR")
            db.add(user)
            db.commit()
        finally:
            db.close()
        return email, password
    return _make
