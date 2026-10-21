import unittest
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


class AlarmCreationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

        def override_get_db():
            session = cls.Session()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = override_get_db

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        cls.engine.dispose()

    def setUp(self):
        self.client = TestClient(app)
        self.email = f"alarm-creator-{uuid.uuid4().hex[:8]}@example.com"
        self.password = "StrongPass123!"

    def test_authenticated_user_can_create_alarm(self):
        registration = self.client.post(
            "/api/auth/register",
            json={
                "name": "Alarm Creator",
                "email": self.email,
                "password": self.password,
                "role": "user",
            },
        )
        self.assertEqual(registration.status_code, 201, registration.text)

        login = self.client.post(
            "/api/auth/login",
            data={"username": self.email, "password": self.password},
        )
        self.assertEqual(login.status_code, 200, login.text)

        token = login.json()["access_token"]

        alarm_payload = {
            "title": "Morning Focus",
            "description": "Wake up with a quick challenge",
            "alarm_time": "07:30",
            "alarm_type": "daily",
            "days": "Monday,Tuesday,Wednesday,Thursday,Friday",
            "difficulty": "medium",
            "challenge_type": "math",
            "is_smart": True,
            "is_active": True,
        }

        response = self.client.post(
            "/api/alarms",
            json=alarm_payload,
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["title"], "Morning Focus")
        self.assertEqual(payload["alarm_time"], "07:30")
        self.assertEqual(payload["challenge_question_count"], 5)


if __name__ == "__main__":
    unittest.main()
