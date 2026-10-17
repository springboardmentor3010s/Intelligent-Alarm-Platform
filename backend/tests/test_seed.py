# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Seed bootstrap: the three role accounts, the cohort link, and legacy removal."""

import uuid

from app.Models import CoachAssignment, Role, User, UserRole
from app.services import bootstrap


def _role_name(db, user_id):
    return (
        db.query(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user_id)
        .scalar()
    )


def test_seed_accounts_creates_three_roles_and_cohort(db):
    bootstrap._seed_roles(db)
    bootstrap._seed_accounts(db)
    bootstrap._seed_accounts(db)  # idempotent: re-running must not duplicate

    users = {u.email: u for u in db.query(User).all()}
    assert set(users) == {"admin@gmail.com", "coach@gmail.com", "user@gmail.com"}
    assert _role_name(db, users["admin@gmail.com"].id) == "Administrator"
    assert _role_name(db, users["coach@gmail.com"].id) == "Wellness Coach"
    assert _role_name(db, users["user@gmail.com"].id) == "User"

    link = db.query(CoachAssignment).filter(
        CoachAssignment.coach_id == users["coach@gmail.com"].id,
        CoachAssignment.user_id == users["user@gmail.com"].id,
    ).first()
    assert link is not None


def test_seed_accounts_removes_legacy_demo(db):
    bootstrap._seed_roles(db)
    role = db.query(Role).filter(Role.name == "User").first()
    demo = User(email="demo@cerebro.com", hashed_password="x", timezone="UTC")
    db.add(demo)
    db.flush()
    db.add(UserRole(user_id=demo.id, role_id=role.id))
    db.commit()

    bootstrap._seed_accounts(db)

    assert db.query(User).filter(User.email == "demo@cerebro.com").first() is None
    assert db.query(UserRole).filter(UserRole.user_id == demo.id).first() is None


def test_me_exposes_default_user_role(client):
    email = f"role_{uuid.uuid4().hex[:8]}@test.io"
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "timezone": "UTC"},
    )
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "User"


def test_me_reflects_promoted_admin(client, admin_headers):
    me = client.get("/api/v1/auth/me", headers=admin_headers)
    assert me.status_code == 200
    assert me.json()["role"] == "Administrator"


def test_register_self_selects_wellness_coach(client):
    email = f"coach_{uuid.uuid4().hex[:8]}@test.io"
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "timezone": "UTC", "role": "Wellness Coach"},
    )
    assert reg.status_code == 200
    assert reg.json()["user"]["role"] == "Wellness Coach"


def test_register_rejects_administrator_self_signup(client):
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": f"adm_{uuid.uuid4().hex[:8]}@test.io", "password": "password123",
              "timezone": "UTC", "role": "Administrator"},
    )
    assert reg.status_code == 422
