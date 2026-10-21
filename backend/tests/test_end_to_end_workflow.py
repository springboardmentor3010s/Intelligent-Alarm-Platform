"""
test_end_to_end_workflow.py

Comprehensive 17-step End-to-End integration test covering the complete
lifecycle of the AI Intelligent Cognitive Alarm Platform:
  1. User registration with sleep schedule preferences
  2. Login and JWT authentication
  3. Alarm configuration (Daily, Weekday, Weekend, One-Time, Smart Adaptive)
  4. Alarm triggering and event recording
  5. Cognitive challenge session generation
  6. Submitting challenge answers
  7. Adaptive difficulty progression evaluation
  8. Snooze event tracking
  9. Alarm completion & verification
  10. Official weighted habit scoring (35/25/20/20)
  11. Machine Learning XGBoost Cognitive Wake-Up Readiness prediction
  12. Personalized recommendation generation across 5 domains
  13. Notification management & automated reminder evaluation
  14. Executive PDF and Excel report generation
  15. Wellness Coach client telemetry inspection & guidance dispatch
  16. Administrator platform analytics & role administration
  17. System health check verification
"""

import unittest
from io import BytesIO
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models.user import User
from backend.app.models.challenge import Challenge
from backend.app.utils.security import hash_password, create_access_token


class TestEndToEndWorkflow(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)
        db = cls.Session()
        provisioning_admin = User(
            name="Provisioning Admin",
            email="provisioning.admin@example.com",
            password_hash=hash_password("ProvisioningPassword123!"),
            role="admin",
        )
        db.add(provisioning_admin)
        db.commit()
        db.refresh(provisioning_admin)
        cls.provisioning_admin_id = provisioning_admin.id
        db.close()
        cls.provisioning_admin_headers = {
            "Authorization": "Bearer "
            + create_access_token({
                "sub": str(cls.provisioning_admin_id),
                "role": "admin",
            })
        }

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

    def test_complete_17_step_platform_workflow(self):
        client = self.client

        # ==============================================================
        # STEP 1: User Registration with Sleep Preferences
        # ==============================================================
        reg_payload = {
            "name": "Alex Mercer",
            "email": "alex.mercer@example.com",
            "password": "SecurePassword123!",
            "role": "user",
            "preferred_wake_time": "06:45",
            "sleep_duration": 8.0,
            "timezone": "America/New_York",
            "productivity_goal": "Consistent Morning Deep Work",
            "difficulty_preference": "medium",
        }
        res_reg = client.post("/api/auth/register", json=reg_payload)
        self.assertEqual(res_reg.status_code, 201, res_reg.text)
        user_data = res_reg.json()
        self.assertEqual(user_data["email"], "alex.mercer@example.com")
        user_id = user_data["id"]

        # Privileged roles are assigned by an existing administrator, never at signup.
        coach_res = client.post("/api/auth/register", json={
            "name": "Coach Helen",
            "email": "helen.coach@example.com",
            "password": "CoachPassword123!",
            "role": "user",
        })
        self.assertEqual(coach_res.status_code, 201)
        coach_id = coach_res.json()["id"]

        admin_res = client.post("/api/auth/register", json={
            "name": "Admin Marcus",
            "email": "marcus.admin@example.com",
            "password": "AdminPassword123!",
            "role": "user",
        })
        self.assertEqual(admin_res.status_code, 201)
        admin_id = admin_res.json()["id"]
        role_update = client.put(
            f"/api/admin/users/{coach_id}/role",
            headers=self.provisioning_admin_headers,
            json={"role": "wellness_coach"},
        )
        self.assertEqual(role_update.status_code, 200)
        role_update = client.put(
            f"/api/admin/users/{admin_id}/role",
            headers=self.provisioning_admin_headers,
            json={"role": "admin"},
        )
        self.assertEqual(role_update.status_code, 200)

        # ==============================================================
        # STEP 2: Login and JWT Token Acquisition
        # ==============================================================
        login_res = client.post("/api/auth/login", data={
            "username": "alex.mercer@example.com",
            "password": "SecurePassword123!",
        })
        self.assertEqual(login_res.status_code, 200)
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Coach token
        coach_login = client.post("/api/auth/login", data={
            "username": "helen.coach@example.com",
            "password": "CoachPassword123!",
        })
        coach_token = coach_login.json()["access_token"]
        coach_headers = {"Authorization": f"Bearer {coach_token}"}

        # Admin token
        admin_login = client.post("/api/auth/login", data={
            "username": "marcus.admin@example.com",
            "password": "AdminPassword123!",
        })
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Verify /api/auth/me
        me_res = client.get("/api/auth/me", headers=headers)
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()["name"], "Alex Mercer")

        # ==============================================================
        # STEP 3: Alarm Configuration (Multiple types & challenges)
        # ==============================================================
        alarm_payload = {
            "title": "Morning Focus Alarm",
            "description": "Daily wake-up call for focus",
            "alarm_time": "06:45",
            "alarm_type": "smart_adaptive",
            "days": "Monday,Tuesday,Wednesday,Thursday,Friday",
            "difficulty": "medium",
            "challenge_type": "math",
            "is_smart": True,
            "is_active": True,
            "challenge_question_count": 3,
        }
        alarm_res = client.post("/api/alarms", json=alarm_payload, headers=headers)
        self.assertEqual(alarm_res.status_code, 200)
        alarm = alarm_res.json()
        alarm_id = alarm["id"]

        one_time_res = client.post(
            "/api/alarms",
            json={
                "title": "One-time verification",
                "alarm_time": "07:00",
                "alarm_type": "one_time",
                "is_smart": False,
            },
            headers=headers,
        )
        self.assertEqual(one_time_res.status_code, 200)
        one_time_alarm_id = one_time_res.json()["id"]
        self.assertEqual(
            client.post(
                f"/api/alarms/{one_time_alarm_id}/trigger",
                headers=headers,
            ).status_code,
            200,
        )
        one_time_complete = client.post(
            f"/api/alarms/{one_time_alarm_id}/complete",
            headers=headers,
        )
        self.assertEqual(one_time_complete.status_code, 200)
        self.assertFalse(one_time_complete.json()["is_active"])

        # ==============================================================
        # STEP 4: Alarm Triggering & Event Logging
        # ==============================================================
        trig_res = client.post(f"/api/alarms/{alarm_id}/trigger", headers=headers)
        self.assertEqual(trig_res.status_code, 200)

        # ==============================================================
        # STEP 5: Cognitive Challenge Session Generation
        # ==============================================================
        gen_res = client.post(f"/api/challenges/generate/{alarm_id}", headers=headers)
        self.assertEqual(gen_res.status_code, 200)
        session_data = gen_res.json()
        session_id = session_data["session_id"]
        questions = session_data["questions"]
        self.assertGreaterEqual(len(questions), 1)

        # ==============================================================
        # STEP 6: Answering Challenge Questions
        # ==============================================================
        db = self.Session()
        for idx, q in enumerate(questions):
            ch_record = db.query(Challenge).filter(Challenge.id == q["id"]).first()
            ans_to_submit = ch_record.answer if ch_record else "1"
            ans_res = client.post(
                f"/api/challenges/{q['id']}/submit",
                params={
                    "answer": ans_to_submit,
                    "response_time_seconds": 18.5,
                },
                headers=headers,
            )
            self.assertEqual(ans_res.status_code, 200)
            self.assertTrue(ans_res.json()["is_correct"])
        db.close()

        # ==============================================================
        # STEP 7: Adaptive Difficulty Progression Evaluation
        # ==============================================================
        dash_res = client.get("/api/dashboard/stats", headers=headers)
        self.assertEqual(dash_res.status_code, 200)
        dash = dash_res.json()
        self.assertIn("current_difficulty", dash)
        self.assertIn(dash["current_difficulty"], ["beginner", "easy", "medium", "hard", "expert"])

        # ==============================================================
        # STEP 8: Snooze Event Tracking
        # ==============================================================
        snooze_res = client.post(f"/api/alarms/{alarm_id}/snooze", headers=headers)
        self.assertEqual(snooze_res.status_code, 200)
        self.assertGreaterEqual(snooze_res.json()["snooze_count"], 1)

        # ==============================================================
        # STEP 9: Complete Alarm & Verification
        # ==============================================================
        comp_res = client.post(
            f"/api/alarms/{alarm_id}/complete",
            json={"session_id": session_id},
            headers=headers,
        )
        self.assertEqual(comp_res.status_code, 200)

        # ==============================================================
        # STEP 10: Official Weighted Habit Score (35/25/20/20)
        # ==============================================================
        dash_after = client.get("/api/dashboard/stats", headers=headers).json()
        self.assertIn("habit_score", dash_after)
        self.assertIn("wake_up_consistency", dash_after)
        self.assertIn("challenge_completion_success", dash_after)
        self.assertIn("snooze_reduction", dash_after)
        self.assertIn("sleep_adherence", dash_after)

        breakdown = dash_after.get("habit_score_breakdown", {})
        self.assertIn("weights", breakdown)
        weights = breakdown["weights"]
        self.assertEqual(weights["wake_up_consistency"], 0.35)
        self.assertEqual(weights["challenge_completion_success"], 0.25)
        self.assertEqual(weights["snooze_reduction"], 0.20)
        self.assertEqual(weights["sleep_schedule_adherence"], 0.20)

        # ==============================================================
        # STEP 11: Machine Learning XGBoost Wake-Up Readiness
        # ==============================================================
        ml_res = client.get("/api/ml/readiness", headers=headers)
        self.assertEqual(ml_res.status_code, 422)
        self.assertIn("Actual sleep duration is not collected", ml_res.json()["detail"])

        # ==============================================================
        # STEP 12: Personalized Recommendations Across 5 Domains
        # ==============================================================
        rec_res = client.get("/api/dashboard/recommendations", headers=headers)
        self.assertEqual(rec_res.status_code, 200)
        recs = rec_res.json()
        self.assertTrue(isinstance(recs, list))
        if recs:
            first_rec = recs[0]
            self.assertIn("title", first_rec)
            self.assertIn("reason", first_rec)
            self.assertIn("suggested_action", first_rec)

        # ==============================================================
        # STEP 13: Notification Management & Reminder Evaluation
        # ==============================================================
        notif_gen = client.post("/api/notifications/generate-reminders", headers=headers)
        self.assertEqual(notif_gen.status_code, 200)

        notif_list = client.get("/api/notifications", headers=headers)
        self.assertEqual(notif_list.status_code, 200)
        all_notifs = notif_list.json()
        self.assertGreater(len(all_notifs), 0)

        # Mark all read
        read_all = client.put("/api/notifications/read-all", headers=headers)
        self.assertEqual(read_all.status_code, 200)

        # ==============================================================
        # STEP 14: Executive PDF & Excel Reports
        # ==============================================================
        pdf_res = client.get("/api/reports/pdf?report_type=comprehensive", headers=headers)
        self.assertEqual(pdf_res.status_code, 200)
        self.assertEqual(pdf_res.headers.get("content-type"), "application/pdf")
        self.assertTrue(pdf_res.content.startswith(b"%PDF"))

        excel_res = client.get("/api/reports/excel?report_type=comprehensive", headers=headers)
        self.assertEqual(excel_res.status_code, 200)
        wb = load_workbook(filename=BytesIO(excel_res.content))
        self.assertIn("User Performance", wb.sheetnames)
        self.assertIn("Alarm Schedule", wb.sheetnames)

        # ==============================================================
        # STEP 15: Wellness Coach Client Inspection & Guidance
        # ==============================================================
        assign_client = client.put(
            f"/api/admin/coaches/{coach_id}/clients/{user_id}",
            headers=admin_headers,
        )
        self.assertEqual(assign_client.status_code, 200)
        coach_clients = client.get("/api/coach/clients", headers=coach_headers)
        self.assertEqual(coach_clients.status_code, 200)
        client_ids = [c["id"] for c in coach_clients.json()]
        self.assertIn(user_id, client_ids)

        # Inspect behavior
        behavior_res = client.get(f"/api/coach/clients/{user_id}/behavior", headers=coach_headers)
        self.assertEqual(behavior_res.status_code, 200)
        self.assertEqual(behavior_res.json()["client"]["email"], "alex.mercer@example.com")

        # Dispatch coach recommendation
        coach_rec = client.post(
            f"/api/coach/clients/{user_id}/recommendation",
            headers=coach_headers,
            json={
                "title": "Hydration and Morning Sunlight",
                "reason": "You completed challenges with solid accuracy.",
                "suggested_action": "Drink 500ml water and get 10 minutes of direct sunlight.",
                "priority": "high",
            }
        )
        self.assertEqual(coach_rec.status_code, 200)

        # ==============================================================
        # STEP 16: Administrator Platform Analytics & Role Management
        # ==============================================================
        admin_stats = client.get("/api/admin/platform-analytics", headers=admin_headers)
        self.assertEqual(admin_stats.status_code, 200)
        self.assertGreaterEqual(admin_stats.json()["total_users"], 3)

        admin_users = client.get("/api/admin/users", headers=admin_headers)
        self.assertEqual(admin_users.status_code, 200)
        self.assertIn("items", admin_users.json())
        platform_excel = client.get("/api/admin/reports/excel", headers=admin_headers)
        self.assertEqual(platform_excel.status_code, 200)
        platform_workbook = load_workbook(filename=BytesIO(platform_excel.content))
        self.assertIn("Platform Summary", platform_workbook.sheetnames)
        admin_recommendations = client.get(
            "/api/admin/recommendations",
            headers=admin_headers,
        )
        self.assertEqual(admin_recommendations.status_code, 200)
        self.assertGreaterEqual(len(admin_recommendations.json()), 1)

        # ==============================================================
        # STEP 17: System Metrics & Health Check Verification
        # ==============================================================
        metrics_res = client.get("/api/system/performance-metrics", headers=headers)
        self.assertEqual(metrics_res.status_code, 200)
        metrics = metrics_res.json()
        self.assertIsInstance(metrics["system_performance"]["database_query_latency_ms"], (int, float))
        self.assertIsNone(metrics["system_performance"]["concurrent_user_handling_capacity"])
        self.assertIsNone(metrics["recommendation"]["productivity_improvement_rate"])

        health_res = client.get("/api/health")
        self.assertEqual(health_res.status_code, 200)
        health_data = health_res.json()
        self.assertEqual(health_data["status"], "healthy")
        self.assertEqual(health_data["database"], "connected")
        self.assertEqual(health_data["ml_model"], "loaded")


if __name__ == "__main__":
    unittest.main()
