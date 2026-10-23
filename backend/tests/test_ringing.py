import uuid
from datetime import timedelta

from app.core.database import SessionLocal
from app.core.timeutil import utcnow
from app.models import Alarm, ChallengeInstance, Notification, WakeSession
from tests.conftest import register
from tests.helpers import active, answer, db_session, due_alarm, guard_midnight, tick, user_utc


def test_alarm_rings_at_scheduled_time_and_only_once(client):
    h = user_utc(client)
    due_alarm(client, h)
    assert tick()["opened"] == 1
    s = active(client, h)
    assert s["status"] == "ringing" and s["challenge"]["prompt"]
    assert tick()["opened"] == 0  # idempotent: no duplicate session
    s2 = SessionLocal()
    assert s2.query(WakeSession).count() == 1
    assert s2.query(Notification).filter(Notification.kind == "wake").count() == 1
    s2.close()


def test_correct_answer_never_sent_to_client(client):
    h = user_utc(client)
    due_alarm(client, h)
    tick()
    raw = client.get("/wake/active", headers=h).text
    assert "correct_answer" not in raw
    sess = active(client, h)
    res = answer(client, h, sess, wrong=True)
    assert "correct_answer" not in str(res)


def test_future_alarm_does_not_ring(client):
    guard_midnight()
    if utcnow().hour >= 21:
        return
    h = user_utc(client)
    t = (utcnow() + timedelta(hours=2)).time().replace(microsecond=0)
    client.post("/alarms", headers=h, json={"label": "Later", "time": t.isoformat(), "alarm_type": "daily"})
    assert tick()["opened"] == 0 and active(client, h) is None


def test_alarm_created_after_its_time_does_not_fire_retroactively(client):
    h = user_utc(client)
    due_alarm(client, h, backdate=False)
    assert tick()["opened"] == 0


def test_puzzle_wrong_then_correct_dismisses(client):
    h = user_utc(client)
    due_alarm(client, h)
    tick()
    sess = active(client, h)
    r = answer(client, h, sess, wrong=True)
    assert r["correct"] is False and r["outcome"] == "continue" and r["challenge"]["id"] != sess["challenge"]["id"]
    sess["challenge"] = r["challenge"]
    r = answer(client, h, sess)
    assert r["outcome"] == "dismissed" and r["summary"]["wrong_answers"] == 1
    assert active(client, h) is None
    # the same question can't be answered twice, and a dismissed alarm can't be answered at all
    again = client.post(f"/wake/{sess['id']}/answer", headers=h, json={"instance_id": r["session"]["id"] and sess["challenge"]["id"], "answer": "1"})
    assert again.status_code == 409


def test_multi_step_needs_three_different_types(client):
    h = user_utc(client)
    due_alarm(client, h, verification_method="multi_step")
    tick()
    sess = active(client, h)
    types = []
    for i in range(3):
        types.append(sess["challenge"]["challenge_type"])
        r = answer(client, h, sess)
        if i < 2:
            assert r["outcome"] == "continue"
            sess["challenge"] = r["challenge"]
    assert r["outcome"] == "dismissed" and len(set(types)) == 3


def test_consecutive_streak_resets_on_wrong_answer(client):
    h = user_utc(client)
    due_alarm(client, h, verification_method="consecutive")
    tick()
    sess = active(client, h)
    for step, wrong in enumerate([False, False, True, False, False]):
        r = answer(client, h, sess, wrong=wrong)
        assert r["outcome"] == "continue", step
        sess["challenge"] = r["challenge"]
        assert r["session"]["progress"]["have"] == (0 if wrong else r["session"]["progress"]["have"])
    r = answer(client, h, sess)  # third in a row after the reset
    assert r["outcome"] == "dismissed"


def test_accuracy_check_round_fails_then_passes(client):
    h = user_utc(client)
    due_alarm(client, h, verification_method="accuracy_check")
    tick()
    sess = active(client, h)
    outcomes = []
    for wrong in [True, True, False, False, False]:  # 3/5 < 4 required
        r = answer(client, h, sess, wrong=wrong)
        outcomes.append(r["outcome"])
        sess["challenge"] = r["challenge"]
    assert outcomes[-1] == "round_failed"
    for i in range(4):
        r = answer(client, h, sess)
        sess["challenge"] = r.get("challenge")
    assert r["outcome"] == "dismissed"


def test_timed_out_answer_counts_as_wrong(client):
    h = user_utc(client)
    due_alarm(client, h)
    tick()
    sess = active(client, h)
    s = SessionLocal()
    inst = s.get(ChallengeInstance, uuid.UUID(sess["challenge"]["id"]))
    inst.issued_at = utcnow() - timedelta(seconds=inst.time_limit_seconds + 60)
    s.commit()
    s.close()
    r = answer(client, h, sess)  # correct answer, but far too late
    assert r["timed_out"] is True and r["correct"] is False and r["outcome"] == "continue"


def test_snooze_limits_and_anti_snooze_difficulty(client):
    h = user_utc(client)
    due_alarm(client, h, max_snoozes=1, snooze_minutes=5, difficulty_override="easy")
    tick()
    sess = active(client, h)
    assert sess["difficulty"] == "easy"
    r = client.post(f"/wake/{sess['id']}/snooze", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "snoozed"
    assert tick()["woken_from_snooze"] == 0  # still snoozing
    s, obj = db_session(sess["id"])
    obj.snoozed_until = utcnow() - timedelta(seconds=1)
    s.commit()
    s.close()
    assert tick()["woken_from_snooze"] == 1
    again = active(client, h)
    assert again["status"] == "ringing" and again["difficulty"] == "medium"  # anti-snooze: one level harder
    assert again["challenge"]["difficulty"] == "medium"
    assert client.post(f"/wake/{sess['id']}/snooze", headers=h).status_code == 409  # no snoozes left


def test_unanswered_alarm_becomes_missed(client):
    h = user_utc(client)
    due_alarm(client, h)
    tick()
    sess = active(client, h)
    s, obj = db_session(sess["id"])
    obj.last_ring_at = utcnow() - timedelta(minutes=50)
    s.commit()
    s.close()
    assert tick()["missed"] == 1
    assert active(client, h) is None
    hist = client.get("/wake/history", headers=h).json()
    assert hist[0]["status"] == "missed"


def test_one_time_alarm_fires_once_then_deactivates(client):
    h = user_utc(client)
    due_alarm(client, h, alarm_type="one_time", one_time_date=utcnow().date().isoformat())
    tick()
    s = SessionLocal()
    assert s.query(Alarm).first().is_active is False
    s.close()


def test_other_users_cannot_touch_my_alarm_session(client):
    ha = user_utc(client, "a@example.com")
    hb, _ = register(client, "b@example.com")
    due_alarm(client, ha)
    tick()
    sess = active(client, ha)
    assert active(client, hb) is None
    r = client.post(f"/wake/{sess['id']}/answer", headers=hb, json={"instance_id": sess["challenge"]["id"], "answer": "1"})
    assert r.status_code == 404
    assert client.post(f"/wake/{sess['id']}/snooze", headers=hb).status_code == 404


def test_practice_ring_works_and_is_excluded_from_stats(client):
    h = user_utc(client)
    r = client.post("/wake/test", headers=h, json={})
    sess = r.json()["session"]
    assert sess["is_practice"] and sess["challenge"]
    out = answer(client, h, sess)
    assert out["outcome"] == "dismissed"
    summary = client.get("/insights/summary", headers=h).json()
    assert summary["wake"]["total"] == 0 and summary["challenges"]["total"] == 0
    p = client.post("/wake/test", headers=h, json={}).json()["session"]
    assert client.post(f"/wake/{p['id']}/cancel", headers=h).status_code == 200


def test_real_alarm_cannot_be_cancelled(client):
    h = user_utc(client)
    due_alarm(client, h)
    tick()
    sess = active(client, h)
    assert client.post(f"/wake/{sess['id']}/cancel", headers=h).status_code == 409


def test_alarm_is_editable_toggle_delete(client):
    h = user_utc(client)
    a = client.post("/alarms", headers=h, json={"label": "Gym", "time": "05:30:00", "alarm_type": "weekday"}).json()
    assert a["repeat_days"] == [0, 1, 2, 3, 4]
    edited = client.put(f"/alarms/{a['id']}", headers=h, json={
        "label": "Run", "time": "06:15:00", "alarm_type": "weekend", "sound": "chime", "volume": 55,
        "verification_method": "consecutive", "max_snoozes": 0, "challenge_types": ["math", "riddle"]})
    assert edited.status_code == 200
    e = edited.json()
    assert (e["label"], e["time"], e["repeat_days"], e["sound"], e["verification_method"]) == \
           ("Run", "06:15:00", [5, 6], "chime", "consecutive") and e["challenge_types"] == ["math", "riddle"]
    assert client.post(f"/alarms/{a['id']}/toggle", headers=h).json()["is_active"] is False
    hb, _ = register(client, "other@example.com")
    assert client.put(f"/alarms/{a['id']}", headers=hb, json={"label": "x", "time": "01:00:00"}).status_code == 404
    assert client.delete(f"/alarms/{a['id']}", headers=hb).status_code == 404
    assert client.delete(f"/alarms/{a['id']}", headers=h).status_code == 200


def test_alarm_input_validation(client):
    h = user_utc(client)
    base = {"label": "x", "time": "06:00:00"}
    for bad in ({"label": "<script>"}, {"volume": 500}, {"max_snoozes": 99}, {"sound": "nope"},
                {"verification_method": "nope"}, {"alarm_type": "nope"}):
        assert client.post("/alarms", headers=h, json={**base, **bad}).status_code == 422, bad


def test_smart_adaptive_rings_at_end_of_sleep_cycle():
    from datetime import time
    from app.models import Alarm, UserProfile
    from app.services import schedule
    p = UserProfile(bedtime=time(23, 0), timezone="UTC")
    a = Alarm(user_id=uuid.uuid4(), time=time(7, 0), alarm_type="smart_adaptive", smart_window_minutes=20)

    class FakeDB:  # no sleep logs -> falls back to the profile bedtime
        def query(self, *_):
            return self
        def filter(self, *_):
            return self
        def order_by(self, *_):
            return self
        def limit(self, *_):
            return self
        def all(self):
            return []
    assert schedule.smart_time(FakeDB(), a, p) == time(6, 45)   # 23:00 + 15 min latency + 5 cycles of 90 min
    a.smart_window_minutes = 5
    assert schedule.smart_time(FakeDB(), a, p) == time(7, 0)    # no cycle end inside the window


def test_bedtime_reminder_sent_once(client):
    guard_midnight()
    if not (1 <= utcnow().hour <= 22):
        return
    h = user_utc(client)
    bed = (utcnow() + timedelta(minutes=29)).time().replace(microsecond=0)
    client.put("/users/me/profile", headers=h, json={"timezone": "UTC", "bedtime": bed.isoformat()})
    assert tick()["reminders"] == 1 and tick()["reminders"] == 0
