"""
test_reports_and_notifications.py

Tests for:
- PDF and Excel export endpoints
- Notification lifecycle (list, unread count, mark read, mark all read, delete, reminder generator)
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
from backend.app.models.alarm import Alarm
from backend.app.utils.security import hash_password, create_access_token


class TestReportsAndNotifications(unittest.TestCase):

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
        user = User(
            name="Report User",
            email="report_user@example.com",
            password_hash=hash_password("reppass"),
            role="user",
            preferred_wake_time="06:30",
            sleep_duration=7.5,
            difficulty_preference="medium",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        alarm = Alarm(
            user_id=user.id,
            title="Sunrise Routine",
            alarm_time="06:30",
            alarm_type="daily",
            difficulty="medium",
            challenge_type="math",
            is_active=True,
        )
        db.add(alarm)
        db.commit()

        # Store IDs before closing the session to avoid DetachedInstanceError
        cls.user_id = user.id
        db.close()

        cls.token = create_access_token({"sub": str(cls.user_id), "role": "user"})

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

    def test_pdf_report_download(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        resp = self.client.get("/api/reports/pdf?report_type=comprehensive", headers=headers)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("content-type"), "application/pdf")
        self.assertGreater(len(resp.content), 1000)

    def test_excel_report_download_and_structure(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        resp = self.client.get("/api/reports/excel?report_type=comprehensive", headers=headers)
        self.assertEqual(resp.status_code, 200)
        content_type = resp.headers.get("content-type", "")
        self.assertIn("spreadsheet", content_type)

        wb = load_workbook(BytesIO(resp.content))
        sheet_names = wb.sheetnames
        self.assertIn("User Performance", sheet_names)
        self.assertIn("Alarm Schedule", sheet_names)

    def test_notification_flow(self):
        headers = {"Authorization": f"Bearer {self.token}"}

        # 1. Get initial notifications list (may be empty)
        resp_list = self.client.get("/api/notifications", headers=headers)
        self.assertEqual(resp_list.status_code, 200)
        initial_notifications = resp_list.json()
        self.assertIsInstance(initial_notifications, list)

        # 2. Unread count
        resp_count = self.client.get("/api/notifications/unread-count", headers=headers)
        self.assertEqual(resp_count.status_code, 200)
        count_data = resp_count.json()
        self.assertIn("unread_count", count_data)
        self.assertIsInstance(count_data["unread_count"], int)

        # 3. Generate reminders
        resp_gen = self.client.post("/api/notifications/generate-reminders", headers=headers)
        self.assertIn(resp_gen.status_code, [200, 201])
        gen_data = resp_gen.json()
        self.assertIn("generated", gen_data)

        # 4. Mark all read
        resp_read_all = self.client.put("/api/notifications/read-all", headers=headers)
        self.assertEqual(resp_read_all.status_code, 200)

        # 5. After marking all read, unread count should be 0
        resp_count2 = self.client.get("/api/notifications/unread-count", headers=headers)
        self.assertEqual(resp_count2.status_code, 200)
        self.assertEqual(resp_count2.json()["unread_count"], 0)


if __name__ == "__main__":
    unittest.main()
