"""
test_rbac_and_roles.py

Tests verifying Role-Based Access Control (RBAC):
- Roles: 'user', 'wellness_coach', 'admin'
- Permission isolation on /api/admin/* and /api/coach/*
- Admin user role promotion and management
"""

import unittest
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models.user import User
from backend.app.models.alarm import Alarm
from backend.app.models.challenge import Challenge
from backend.app.models.activity import Activity
from backend.app.models.coach_assignment import CoachAssignment
from backend.app.models.login_event import LoginEvent
from backend.app.utils.security import hash_password, create_access_token


class TestRBACAndRoles(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # StaticPool ensures all sessions share the same in-memory connection
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

        db = cls.Session()
        # 1. Standard User
        user = User(
            name="Normal User",
            email="user@test.com",
            password_hash=hash_password("userpass"),
            role="user",
        )
        # 2. Wellness Coach
        coach = User(
            name="Coach Sarah",
            email="coach@test.com",
            password_hash=hash_password("coachpass"),
            role="wellness_coach",
        )
        unassigned_user = User(
            name="Unassigned User",
            email="unassigned@test.com",
            password_hash=hash_password("unassignedpass"),
            role="user",
        )
        # 3. Administrator
        admin = User(
            name="Admin Dave",
            email="admin@test.com",
            password_hash=hash_password("adminpass"),
            role="admin",
        )
        db.add_all([user, coach, admin, unassigned_user])
        db.commit()
        db.refresh(user)
        db.refresh(coach)
        db.refresh(admin)
        db.refresh(unassigned_user)

        # Store IDs before closing the session to avoid DetachedInstanceError
        cls.user_id = user.id
        cls.coach_id = coach.id
        cls.admin_id = admin.id
        cls.unassigned_user_id = unassigned_user.id
        db.close()

        cls.user_token = create_access_token({"sub": str(cls.user_id), "role": "user"})
        cls.coach_token = create_access_token({"sub": str(cls.coach_id), "role": "wellness_coach"})
        cls.admin_token = create_access_token({"sub": str(cls.admin_id), "role": "admin"})

        def override_get_db():
            session = cls.Session()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def test_public_registration_cannot_assign_privileged_roles(self):
        for role in ("wellness_coach", "admin"):
            response = self.client.post(
                "/api/auth/register",
                json={
                    "name": "Untrusted Signup",
                    "email": f"signup-{role}@test.com",
                    "password": "secure-password",
                    "role": role,
                },
            )
            self.assertEqual(response.status_code, 403)

    def test_user_cannot_access_admin_endpoints(self):
        headers = {"Authorization": f"Bearer {self.user_token}"}
        resp = self.client.get("/api/admin/platform-analytics", headers=headers)
        self.assertEqual(resp.status_code, 403)

    def test_user_cannot_access_coach_endpoints(self):
        headers = {"Authorization": f"Bearer {self.user_token}"}
        resp = self.client.get("/api/coach/clients", headers=headers)
        self.assertEqual(resp.status_code, 403)

    def test_coach_can_access_coach_endpoints(self):
        headers = {"Authorization": f"Bearer {self.coach_token}"}
        resp = self.client.get("/api/coach/clients", headers=headers)
        self.assertEqual(resp.status_code, 200)
        clients = resp.json()
        self.assertTrue(isinstance(clients, list))
        # Ensure coach only sees users with 'user' role
        for c in clients:
            self.assertNotIn(c.get("role"), ["wellness_coach", "admin"])

    def test_coach_cannot_access_unassigned_user(self):
        db = self.Session()
        db.query(CoachAssignment).filter(
            CoachAssignment.user_id == self.unassigned_user_id
        ).delete()
        db.commit()
        db.close()
        headers = {"Authorization": "Bearer " + self.coach_token}
        response = self.client.get(
            f"/api/coach/clients/{self.unassigned_user_id}/behavior",
            headers=headers,
        )
        self.assertEqual(response.status_code, 404)

    def test_admin_assigns_client_and_coach_sees_only_assigned_data(self):
        admin_headers = {"Authorization": "Bearer " + self.admin_token}
        coach_headers = {"Authorization": "Bearer " + self.coach_token}
        assignment = self.client.put(
            f"/api/admin/coaches/{self.coach_id}/clients/{self.user_id}",
            headers=admin_headers,
        )
        self.assertEqual(assignment.status_code, 200)
        roster = self.client.get("/api/coach/clients", headers=coach_headers)
        self.assertEqual(roster.status_code, 200)
        self.assertEqual([item["id"] for item in roster.json()], [self.user_id])
        detail = self.client.get(
            f"/api/coach/clients/{self.user_id}/behavior",
            headers=coach_headers,
        )
        self.assertEqual(detail.status_code, 200)
        self.assertIn("challenge_history", detail.json())
        self.assertEqual(detail.json()["client"]["id"], self.user_id)

    def test_coach_cannot_access_admin_endpoints(self):
        headers = {"Authorization": f"Bearer {self.coach_token}"}
        resp = self.client.get("/api/admin/platform-analytics", headers=headers)
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_access_admin_and_coach_endpoints(self):
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        resp_admin = self.client.get("/api/admin/platform-analytics", headers=headers)
        self.assertEqual(resp_admin.status_code, 200)
        data = resp_admin.json()
        self.assertIn("total_users", data)
        self.assertIn("users_by_role", data)

        recommendation_response = self.client.get(
            "/api/admin/recommendations",
            headers=headers,
        )
        self.assertEqual(recommendation_response.status_code, 200)
        self.assertIsInstance(recommendation_response.json(), list)

        resp_coach = self.client.get("/api/coach/clients", headers=headers)
        self.assertEqual(resp_coach.status_code, 200)

    def test_admin_is_the_system_wellness_coach_for_every_user(self):
        headers = {"Authorization": "Bearer " + self.admin_token}
        users = self.client.get("/api/admin/users", headers=headers)
        self.assertEqual(users.status_code, 200)
        user_item = next(
            item for item in users.json()["items"]
            if item["id"] == self.user_id
        )
        self.assertEqual(
            user_item["coach_coverage"]["coach_name"],
            "Admin Dave (Admin Wellness Coach)",
        )
        self.assertEqual(user_item["coach_coverage"]["coverage"], "admin_all_users")

        overview = self.client.get("/api/coach/overview", headers=headers)
        self.assertEqual(overview.status_code, 200)
        db = self.Session()
        expected_client_ids = {
            item.id for item in db.query(User).filter(User.role == "user").all()
        }
        db.close()
        self.assertEqual(overview.json()["accessible_users"], len(expected_client_ids))
        self.assertEqual(
            {item["id"] for item in overview.json()["clients"]},
            expected_client_ids,
        )

        guidance = self.client.post(
            f"/api/coach/clients/{self.unassigned_user_id}/recommendation",
            headers=headers,
            json={"suggested_action": "Try one short challenge each morning."},
        )
        self.assertEqual(guidance.status_code, 200)

    def test_admin_can_list_and_update_user_role(self):
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        # List users
        resp_users = self.client.get("/api/admin/users", headers=headers)
        self.assertEqual(resp_users.status_code, 200)
        users = resp_users.json()
        self.assertGreaterEqual(users["total"], 4)
        self.assertLessEqual(len(users["items"]), users["page_size"])

        search_response = self.client.get(
            "/api/admin/users?q=Admin%20Dave&page=1&page_size=1",
            headers=headers,
        )
        self.assertEqual(search_response.status_code, 200)
        self.assertEqual(search_response.json()["total"], 1)
        self.assertEqual(search_response.json()["items"][0]["name"], "Admin Dave")

        # Verify existing unassigned users are enrolled when a coach is promoted.
        db = self.Session()
        orphan = User(
            name="Needs Automatic Coach",
            email="needs-coach@test.com",
            password_hash=hash_password("secure-password"),
            role="user",
        )
        db.add(orphan)
        db.commit()
        db.close()

        # Update user role to wellness_coach
        resp_update = self.client.put(
            f"/api/admin/users/{self.user_id}/role",
            headers=headers,
            json={"role": "wellness_coach"}
        )
        self.assertEqual(resp_update.status_code, 200)
        self.assertEqual(resp_update.json()["role"], "wellness_coach")
        self.assertGreaterEqual(resp_update.json()["new_clients_assigned"], 1)

        # Revert back to user
        self.client.put(
            f"/api/admin/users/{self.user_id}/role",
            headers=headers,
            json={"role": "user"}
        )


    def test_admin_cannot_remove_a_users_only_available_coach(self):
        db = self.Session()
        client = User(
            name="Protected Client",
            email="protected-client@test.com",
            password_hash=hash_password("secure-password"),
            role="user",
        )
        db.add(client)
        db.commit()
        db.refresh(client)
        client_id = client.id
        db.close()

        admin_headers = {"Authorization": "Bearer " + self.admin_token}
        assigned = self.client.put(
            f"/api/admin/coaches/{self.coach_id}/clients/{client_id}",
            headers=admin_headers,
        )
        self.assertEqual(assigned.status_code, 200)
        unassigned = self.client.delete(
            f"/api/admin/coaches/{self.coach_id}/clients/{client_id}",
            headers=admin_headers,
        )
        self.assertEqual(unassigned.status_code, 409)

    def test_platform_analytics_aggregates_recorded_period_data(self):
        now = datetime.utcnow()
        db = self.Session()
        total_user_count = db.query(User).count()
        alarm = Alarm(
            user_id=self.user_id,
            title="Analytics test alarm",
            alarm_time="07:00",
        )
        db.add(alarm)
        db.flush()
        db.add_all([
            Activity(user_id=self.user_id, alarm_id=alarm.id, activity_type="trigger", created_at=now),
            Activity(user_id=self.user_id, alarm_id=alarm.id, activity_type="complete", created_at=now),
            LoginEvent(user_id=self.user_id, logged_at=now),
            LoginEvent(user_id=self.user_id, logged_at=now),
            Challenge(
                user_id=self.user_id,
                alarm_id=alarm.id,
                session_id="analytics-complete",
                question_number=1,
                question="2 + 2",
                answer="4",
                user_answer="4",
                difficulty="easy",
                is_correct=True,
                is_completed=True,
                created_at=now,
            ),
            Challenge(
                user_id=self.user_id,
                alarm_id=alarm.id,
                session_id="analytics-incomplete",
                question_number=1,
                question="3 + 3",
                answer="6",
                user_answer="5",
                difficulty="easy",
                is_correct=False,
                is_completed=False,
                created_at=now,
            ),
        ])
        db.commit()
        db.close()

        response = self.client.get(
            "/api/admin/platform-analytics",
            params={"start_date": now.date().isoformat(), "end_date": now.date().isoformat()},
            headers={"Authorization": "Bearer " + self.admin_token},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_users"], total_user_count)
        self.assertGreaterEqual(data["active_users"], 1)
        self.assertEqual(data["total_challenges"], 2)
        self.assertEqual(data["completed_challenges"], 1)
        self.assertEqual(data["challenge_completion_rate"], 50.0)
        self.assertEqual(data["platform_accuracy"], 50.0)
        self.assertEqual(data["activity_summary"]["total_triggers"], 1)
        self.assertEqual(data["activity_summary"]["total_completions"], 1)
        self.assertEqual(data["successful_logins"], 2)
        self.assertEqual(data["users_logged_in"], 1)
        self.assertEqual(data["login_trend"], [{
            "date": now.date().isoformat(),
            "logins": 2,
            "users": 1,
        }])
        details = self.client.get(
            f"/api/admin/users/{self.user_id}",
            headers={"Authorization": "Bearer " + self.admin_token},
        )
        self.assertEqual(details.status_code, 200)
        self.assertEqual(len(details.json()["alarms"]), 1)
        self.assertEqual(len(details.json()["challenge_history"]), 2)

    def test_registration_and_successful_login_record_participation_and_coach(self):
        registration = self.client.post(
            "/api/auth/register",
            json={
                "name": "Tracked Participant",
                "email": "tracked-participant@test.com",
                "password": "secure-password",
                "role": "user",
            },
        )
        self.assertEqual(registration.status_code, 201, registration.text)
        user_id = registration.json()["id"]

        db = self.Session()
        assignments = db.query(CoachAssignment).filter(
            CoachAssignment.user_id == user_id
        ).all()
        self.assertEqual(len(assignments), 1)
        self.assertIsNone(assignments[0].assigned_by_id)
        db.close()

        login = self.client.post(
            "/api/auth/login",
            data={
                "username": "tracked-participant@test.com",
                "password": "secure-password",
            },
        )
        self.assertEqual(login.status_code, 200, login.text)
        details = self.client.get(
            f"/api/admin/users/{user_id}",
            headers={"Authorization": "Bearer " + self.admin_token},
        )
        self.assertEqual(details.status_code, 200)
        self.assertEqual(details.json()["login_summary"]["successful_logins"], 1)
        self.assertEqual(len(details.json()["login_summary"]["recent_logins"]), 1)
        self.assertEqual(len(details.json()["assigned_coaches"]), 1)

        admin_users = self.client.get(
            "/api/admin/users?q=tracked-participant%40test.com",
            headers={"Authorization": "Bearer " + self.admin_token},
        )
        self.assertEqual(admin_users.status_code, 200)
        listed_user = admin_users.json()["items"][0]
        self.assertEqual(listed_user["successful_logins"], 1)
        self.assertIsNotNone(listed_user["last_login_at"])
        self.assertTrue(listed_user["assigned_coaches"])

    def test_platform_analytics_rejects_reversed_date_range(self):
        today = datetime.utcnow().date()
        response = self.client.get(
            "/api/admin/platform-analytics",
            params={
                "start_date": (today + timedelta(days=1)).isoformat(),
                "end_date": today.isoformat(),
            },
            headers={"Authorization": "Bearer " + self.admin_token},
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
