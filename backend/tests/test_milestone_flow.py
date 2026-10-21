import unittest
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.activity import Activity
from app.models.alarm import Alarm
from app.models.challenge import Challenge
from app.models.challenge_attempt import ChallengeAttempt
from app.models.alarm_performance import AlarmPerformance
from app.models.notification import Notification
from app.models.recommendation import Recommendation
from app.models.user import User
from app.main import app
from app.routers.admin import get_user_details, list_users
from app.routers.coach import get_client_behavior
from app.routers.dashboard import recommendation_history
from app.routers.alarms import complete_alarm, trigger_alarm
from app.routers.challenges import generate_alarm_challenge, submit_challenge
from app.services.analytics_service import (
    generate_recommendations,
    get_dashboard,
)


class MilestoneFlowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.session_factory = sessionmaker(bind=self.engine)
        self.db = self.session_factory()
        self.user = User(
            name="Milestone Tester",
            email="milestone@example.com",
            password_hash="test-hash",
            difficulty_preference="medium",
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def create_alarm(self, difficulty="easy", question_count=3):
        alarm = Alarm(
            user_id=self.user.id,
            title="Test alarm",
            alarm_time="07:00",
            difficulty=difficulty,
            challenge_type="math",
            is_smart=True,
            challenge_question_count=question_count,
            is_active=True,
        )
        self.db.add(alarm)
        self.db.commit()
        self.db.refresh(alarm)
        return alarm

    def generate_session(self, alarm):
        trigger_alarm(alarm.id, db=self.db, user=self.user)
        return generate_alarm_challenge(
            alarm.id,
            db=self.db,
            current_user=self.user,
        )

    def submit_session(self, session):
        results = []
        for question_data in session["questions"]:
            question = self.db.get(Challenge, question_data["id"])
            results.append(
                submit_challenge(
                    question.id,
                    question.answer,
                    response_time_seconds=10,
                    db=self.db,
                    current_user=self.user,
                )
            )
        return results

    def test_successful_session_counts_once_and_next_session_uses_adapted_level(self):
        alarm = self.create_alarm()
        before = get_dashboard(self.db, self.user)
        self.assertEqual(before["completed_challenges"], 0)

        first_session = self.generate_session(alarm)
        self.assertEqual(first_session["difficulty"], "easy")
        self.assertEqual(get_dashboard(self.db, self.user)["completed_challenges"], 0)

        results = self.submit_session(first_session)
        self.assertTrue(results[-1]["challenge_completed"])
        self.assertEqual(results[-1]["score"], 3)

        repeated = submit_challenge(
            first_session["questions"][-1]["id"],
            "duplicate submission",
            response_time_seconds=2,
            db=self.db,
            current_user=self.user,
        )
        self.assertTrue(repeated["challenge_completed"])
        self.assertEqual(
            self.db.query(ChallengeAttempt)
            .filter(ChallengeAttempt.user_id == self.user.id)
            .count(),
            3,
        )
        self.assertEqual(get_dashboard(self.db, self.user)["completed_challenges"], 1)

        completion = complete_alarm(
            alarm.id,
            session_id=first_session["session_id"],
            db=self.db,
            user=self.user,
        )
        self.assertEqual(completion.completed_count, 1)
        performance = (
            self.db.query(AlarmPerformance)
            .filter(AlarmPerformance.user_id == self.user.id)
            .one()
        )
        self.assertEqual(performance.alarm_title, alarm.title)
        self.assertEqual(performance.total_questions, 3)
        self.assertEqual(performance.correct_answers, 3)
        self.assertEqual(performance.accuracy_pct, 100)
        self.assertEqual(performance.average_response_time_seconds, 10)
        self.assertTrue(performance.challenge_completed)
        self.assertIsNotNone(performance.recommendation_id)
        self.assertEqual(
            self.db.query(Notification)
            .filter(Notification.user_id == self.user.id)
            .count(),
            1,
        )
        self.assertEqual(
            self.db.query(Recommendation)
            .filter(
                Recommendation.id == performance.recommendation_id,
                Recommendation.category == "post_alarm_performance",
            )
            .count(),
            1,
        )
        self.assertTrue(
            any(
                item["id"] == performance.recommendation_id
                for item in generate_recommendations(self.db, self.user)
            )
        )
        admin_details = get_user_details(
            target_user_id=self.user.id,
            db=self.db,
            admin_user=self.user,
        )
        self.assertEqual(len(admin_details["performance_history"]), 1)
        self.assertEqual(
            admin_details["performance_history"][0]["accuracy_pct"],
            100,
        )
        admin = User(
            name="Test Admin",
            email="admin-milestone@example.com",
            password_hash="test-hash",
            role="admin",
        )
        self.db.add(admin)
        self.db.commit()
        coach_details = get_client_behavior(
            client_id=self.user.id,
            db=self.db,
            coach=admin,
        )
        self.assertEqual(len(coach_details["performance_history"]), 1)
        self.assertEqual(
            coach_details["performance_history"][0]["suggested_action"],
            performance.suggested_action,
        )
        roster = list_users(
            q=None,
            role=None,
            page=1,
            page_size=25,
            db=self.db,
            admin_user=admin,
        )
        listed_user = next(
            item for item in roster["items"] if item["id"] == self.user.id
        )
        self.assertEqual(listed_user["recorded_performances"], 1)
        complete_alarm(
            alarm.id,
            session_id=first_session["session_id"],
            db=self.db,
            user=self.user,
        )
        self.assertEqual(alarm.completed_count, 1)
        self.assertEqual(
            self.db.query(AlarmPerformance)
            .filter(AlarmPerformance.user_id == self.user.id)
            .count(),
            1,
        )

        self.assertEqual(self.user.difficulty_preference, "medium")
        alarm.last_triggered = datetime.utcnow() - timedelta(seconds=4)
        self.db.commit()
        next_session = self.generate_session(alarm)
        self.assertEqual(next_session["difficulty"], "medium")
        self.assertTrue(
            all(
                self.db.get(Challenge, item["id"]).difficulty == "medium"
                for item in next_session["questions"]
            )
        )

        after = get_dashboard(self.db, self.user)
        self.assertEqual(after["successful_challenges"], 1)
        self.assertGreater(after["habit_score"], before["habit_score"])

    def test_failed_session_is_recorded_but_not_counted_as_completed(self):
        alarm = self.create_alarm(difficulty="medium")
        session = self.generate_session(alarm)

        for item in session["questions"]:
            response = submit_challenge(
                item["id"],
                "not the answer",
                response_time_seconds=45,
                db=self.db,
                current_user=self.user,
            )

        stats = get_dashboard(self.db, self.user)
        self.assertFalse(response["challenge_completed"])
        self.assertEqual(stats["completed_challenges"], 0)
        self.assertEqual(stats["failed_challenges"], 1)
        self.assertEqual(stats["failed_attempts"], 3)
        self.assertEqual(stats["challenge_accuracy"], 0)
        self.assertEqual(stats["average_challenge_time"], 45)
        self.assertEqual(stats["missed_alarms"], 1)
        recommendations = generate_recommendations(
            self.db,
            self.user,
            dashboard_data=stats,
        )
        practice = next(
            item for item in recommendations
            if item["title"] == "Practice at Your Selected Difficulty"
        )
        self.assertIn("Easy", practice["reason"])
        self.assertIn("selected level: Easy", practice["supporting_metric"])
        self.assertEqual(self.user.difficulty_preference, "easy")
        self.assertEqual(
            self.db.query(ChallengeAttempt)
            .filter(
                ChallengeAttempt.user_id == self.user.id,
                ChallengeAttempt.is_correct.is_(False),
            )
            .count(),
            3,
        )

    def test_generated_or_unanswered_session_does_not_change_completion_or_accuracy(self):
        alarm = self.create_alarm()
        before = get_dashboard(self.db, self.user)
        session = self.generate_session(alarm)
        after = get_dashboard(self.db, self.user)

        self.assertEqual(len(session["questions"]), 3)
        self.assertEqual(after["completed_challenges"], 0)
        self.assertEqual(after["answered_questions"], 0)
        self.assertIsNone(after["challenge_accuracy"])
        self.assertEqual(after["habit_score"], before["habit_score"])
        self.assertEqual(
            self.db.query(ChallengeAttempt)
            .filter(ChallengeAttempt.user_id == self.user.id)
            .count(),
            0,
        )

    def test_user_and_coach_can_review_all_persisted_recommendations(self):
        recommendations = [
            Recommendation(
                user_id=self.user.id,
                title=f"Performance recommendation {index}",
                reason=f"Recorded behavior insight {index}",
                suggested_action=f"Suggested action {index}",
                category="post_alarm_performance",
                priority="medium",
            )
            for index in range(12)
        ]
        other_user = User(
            name="Other User",
            email="other-recommendation@example.com",
            password_hash="test-hash",
        )
        self.db.add_all([*recommendations, other_user])
        self.db.flush()
        self.db.add(
            Recommendation(
                user_id=other_user.id,
                title="Private recommendation",
                reason="Belongs to another user",
                suggested_action="Do not expose",
                category="post_alarm_performance",
            )
        )
        self.db.commit()

        user_history = recommendation_history(db=self.db, user=self.user)
        self.assertEqual(len(user_history), 12)
        self.assertNotIn("Private recommendation", {
            item["title"] for item in user_history
        })

        admin = User(
            name="Coach Admin",
            email="coach-admin@example.com",
            password_hash="test-hash",
            role="admin",
        )
        self.db.add(admin)
        self.db.commit()
        coach_view = get_client_behavior(
            client_id=self.user.id,
            db=self.db,
            coach=admin,
        )
        coach_titles = {item["title"] for item in coach_view["recommendations"]}
        self.assertTrue(
            {item.title for item in recommendations}.issubset(coach_titles)
        )

    def test_missing_answer_does_not_create_attempt(self):
        alarm = self.create_alarm(question_count=1)
        session = self.generate_session(alarm)
        question_id = session["questions"][0]["id"]

        with self.assertRaises(Exception):
            submit_challenge(
                question_id,
                " ",
                response_time_seconds=1,
                db=self.db,
                current_user=self.user,
            )

        self.assertEqual(
            self.db.query(ChallengeAttempt)
            .filter(ChallengeAttempt.user_id == self.user.id)
            .count(),
            0,
        )
        self.assertEqual(get_dashboard(self.db, self.user)["completed_challenges"], 0)

    def test_authenticated_http_flow_updates_dashboard_and_adaptive_level(self):
        def override_get_db():
            db = self.session_factory()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        try:
            with TestClient(app) as client:
                registration = client.post(
                    "/api/auth/register",
                    json={
                        "name": "HTTP Milestone Tester",
                        "email": "http-milestone@example.com",
                        "password": "StrongPass123!",
                        "role": "user",
                    },
                )
                self.assertEqual(registration.status_code, 201, registration.text)
                login = client.post(
                    "/api/auth/login",
                    data={
                        "username": "http-milestone@example.com",
                        "password": "StrongPass123!",
                    },
                )
                self.assertEqual(login.status_code, 200, login.text)
                headers = {
                    "Authorization": f"Bearer {login.json()['access_token']}"
                }

                self.assertEqual(
                    client.get("/api/dashboard/stats").status_code,
                    401,
                )
                created_alarm = client.post(
                    "/api/alarms",
                    headers=headers,
                    json={
                        "title": "HTTP morning alarm",
                        "alarm_time": "07:00",
                        "difficulty": "easy",
                        "challenge_type": "math",
                        "is_smart": True,
                        "challenge_question_count": 3,
                    },
                )
                self.assertEqual(created_alarm.status_code, 200, created_alarm.text)
                alarm_id = created_alarm.json()["id"]
                self.assertEqual(
                    client.post(
                        f"/api/alarms/{alarm_id}/trigger",
                        headers=headers,
                        json={},
                    ).status_code,
                    200,
                )

                generated = client.post(
                    f"/api/challenges/generate/{alarm_id}",
                    headers=headers,
                    json={},
                )
                self.assertEqual(generated.status_code, 200, generated.text)
                session = generated.json()
                self.assertEqual(session["difficulty"], "easy")
                self.assertEqual(
                    client.get("/api/dashboard/stats", headers=headers)
                    .json()["completed_challenges"],
                    0,
                )

                for question_data in session["questions"]:
                    question = self.db.get(Challenge, question_data["id"])
                    response = client.post(
                        f"/api/challenges/{question.id}/submit",
                        headers=headers,
                        params={
                            "answer": question.answer,
                            "response_time_seconds": 8.5,
                        },
                    )
                    self.assertEqual(response.status_code, 200, response.text)

                completion = client.post(
                    f"/api/alarms/{alarm_id}/complete",
                    headers=headers,
                    json={"session_id": session["session_id"]},
                )
                self.assertEqual(completion.status_code, 200, completion.text)
                duplicate_completion = client.post(
                    f"/api/alarms/{alarm_id}/complete",
                    headers=headers,
                    json={"session_id": session["session_id"]},
                )
                self.assertEqual(duplicate_completion.status_code, 200)

                stats = client.get("/api/dashboard/stats", headers=headers)
                self.assertEqual(stats.status_code, 200, stats.text)
                self.assertEqual(stats.json()["completed_challenges"], 1)
                self.assertEqual(stats.json()["challenge_accuracy"], 100)
                self.assertEqual(stats.json()["current_difficulty"], "medium")
                self.assertEqual(stats.json()["challenge_attempts"], 3)
                self.assertEqual(completion.json()["completed_count"], 1)
                self.assertTrue(
                    any(
                        item["title"] == "Difficulty Increased to Medium"
                        for item in stats.json()["recommendations"]
                    )
                )
        finally:
            app.dependency_overrides.pop(get_db, None)


if __name__ == "__main__":
    unittest.main()
