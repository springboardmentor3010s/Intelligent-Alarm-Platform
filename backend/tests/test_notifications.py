"""
Notification & Reminder System tests (Module 11).
Run: cd backend && venv\\Scripts\\python.exe -m pytest tests/test_notifications.py -v
"""


def _create_alarm(client, headers):
    payload = {
        "alarm_name": "Morning Alarm",
        "alarm_time": "07:00",
        "alarm_type": "Daily",
        "repeat_days": "",
        "enabled": True,
        "challenge_difficulty": "MEDIUM",
        "challenge_count": 1,
        "challenge_type": "random",
    }
    return client.post("/alarms", json=payload, headers=headers)


class TestNotifications:
    def test_no_notifications_without_alarms(self, client, register_user):
        headers = register_user(email="noalarms@example.com")
        r = client.get("/notifications", headers=headers)
        assert r.status_code == 200
        assert r.json()["unread_count"] == 0
        assert r.json()["notifications"] == []

    def test_reminders_generated_when_alarm_exists(self, client, register_user):
        headers = register_user(email="withalarm@example.com")
        _create_alarm(client, headers)
        r = client.get("/notifications", headers=headers)
        assert r.status_code == 200
        types = {n["type"] for n in r.json()["notifications"]}
        assert "WAKEUP_REMINDER" in types
        assert "BEDTIME_REMINDER" in types

    def test_generation_is_idempotent_per_day(self, client, register_user):
        headers = register_user(email="idempotent@example.com")
        _create_alarm(client, headers)
        first = client.get("/notifications", headers=headers).json()
        second = client.get("/notifications", headers=headers).json()
        assert len(first["notifications"]) == len(second["notifications"])

    def test_mark_single_read(self, client, register_user):
        headers = register_user(email="markread@example.com")
        _create_alarm(client, headers)
        note_id = client.get("/notifications", headers=headers).json()["notifications"][0]["id"]
        r = client.post(f"/notifications/{note_id}/read", headers=headers)
        assert r.status_code == 200
        notes = client.get("/notifications", headers=headers).json()["notifications"]
        assert next(n for n in notes if n["id"] == note_id)["is_read"] is True

    def test_mark_all_read(self, client, register_user):
        headers = register_user(email="markallread@example.com")
        _create_alarm(client, headers)
        client.get("/notifications", headers=headers)  # trigger generation first
        client.post("/notifications/read-all", headers=headers)
        r = client.get("/notifications", headers=headers)
        assert r.json()["unread_count"] == 0

    def test_delete_notification(self, client, register_user):
        headers = register_user(email="deletenote@example.com")
        _create_alarm(client, headers)
        note_id = client.get("/notifications", headers=headers).json()["notifications"][0]["id"]
        r = client.delete(f"/notifications/{note_id}", headers=headers)
        assert r.status_code == 204

    def test_notifications_scoped_per_user(self, client, register_user):
        headers_a = register_user(email="notif_a@example.com")
        headers_b = register_user(email="notif_b@example.com")
        _create_alarm(client, headers_a)
        r = client.get("/notifications", headers=headers_b)
        assert r.json()["notifications"] == []
