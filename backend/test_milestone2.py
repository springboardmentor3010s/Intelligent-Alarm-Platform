from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from Models.user import User
from Models.alarm import Alarm
from Models.challenge import Challenge, ChallengeAttempt, WakeUpEvent
from auth import create_access_token
import json

client = TestClient(app)

def test_milestone_2_workflow():
    db = SessionLocal()
    user = User(email="test_ms2@test.com", password_hash="hashedpassword", name="Test MS2")
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"user_id": user.id, "email": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    # Create Alarm
    alarm = Alarm(user_id=user.id, title="Morning Test Alarm", time="07:00", challenge_type="Math Problems", difficulty="Medium")
    db.add(alarm)
    db.commit()
    db.refresh(alarm)

    # 1. Start Wake Up Event
    start_res = client.post("/challenges/wake-up/start", params={"alarm_id": alarm.id}, headers=headers)
    assert start_res.status_code == 200
    start_data = start_res.json()
    assert start_data["wake_up_event_id"] is not None
    assert start_data["required_challenges"] == 1
    assert start_data["verification_status"] == "pending"
    event_id = start_data["wake_up_event_id"]

    # 2. Generate Challenge
    gen_res = client.post("/challenges/generate", json={"alarm_id": alarm.id, "wake_up_event_id": event_id}, headers=headers)
    assert gen_res.status_code == 200
    challenge_data = gen_res.json()
    assert "id" in challenge_data
    challenge_id = challenge_data["id"]

    db_challenge = db.query(Challenge).filter_by(id=challenge_id).first()
    assert db_challenge is not None
    assert db_challenge.wake_up_event_id == event_id

    correct_answer = db_challenge.correct_answer

    # 3. Submit Challenge (Incorrect)
    submit_bad = client.post(f"/challenges/{challenge_id}/submit", json={"answer": "wrong_answer", "solve_time": 5}, headers=headers)
    assert submit_bad.status_code == 200
    assert submit_bad.json()["correct"] is False
    assert submit_bad.json()["verified"] is False
    # Check attempts
    attempts = db.query(ChallengeAttempt).filter_by(challenge_id=challenge_id).all()
    assert len(attempts) == 1

    # Get the next challenge from response
    assert "next_challenge" in submit_bad.json()
    next_challenge_id = submit_bad.json()["next_challenge"]["id"]
    next_db_challenge = db.query(Challenge).filter_by(id=next_challenge_id).first()
    correct_answer = next_db_challenge.correct_answer

    # 4. Submit Challenge (Correct)
    submit_good = client.post(f"/challenges/{next_challenge_id}/submit", json={"answer": correct_answer, "solve_time": 5}, headers=headers)
    assert submit_good.status_code == 200
    assert submit_good.json()["correct"] is True
    assert submit_good.json()["verified"] is True
    
    attempts2 = db.query(ChallengeAttempt).filter_by(challenge_id=next_challenge_id).all()
    assert len(attempts2) == 1

    # Verify event status
    event = db.query(WakeUpEvent).filter_by(id=event_id).first()
    assert event.verification_status == "verified"
    assert event.status == "completed"

    # 5. History API
    history_res = client.get("/challenges/history/all", headers=headers)
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) == 2 # 1 failed, 1 completed

    # 6. Analytics API
    stats_res = client.get("/challenges/analytics/stats", headers=headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_challenges"] == 2
    assert stats["completed"] == 1
    assert stats["failed"] == 1
    assert stats["total_wake_up_events"] == 1
    assert stats["verified_wake_ups"] == 1

    print("All Milestone 2 logic tests passed successfully!")

if __name__ == "__main__":
    test_milestone_2_workflow()
