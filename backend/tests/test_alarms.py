"""
Alarm CRUD + ownership isolation tests.
Run: cd backend && venv\\Scripts\\python.exe -m pytest tests/test_alarms.py -v
"""


def _create_alarm(client, headers, **overrides):
    payload = {
        "alarm_name": "Morning Alarm",
        "alarm_time": "07:00",
        "alarm_type": "Daily",
        "repeat_days": "Mon,Tue,Wed,Thu,Fri",
        "enabled": True,
        "challenge_difficulty": "MEDIUM",
        "challenge_count": 1,
        "challenge_type": "random",
    }
    payload.update(overrides)
    return client.post("/alarms", json=payload, headers=headers)


class TestAlarmCRUD:
    def test_create_alarm(self, client, register_user):
        headers = register_user(email="alarmuser@example.com")
        r = _create_alarm(client, headers)
        assert r.status_code == 201
        assert r.json()["alarm_name"] == "Morning Alarm"

    def test_list_alarms(self, client, register_user):
        headers = register_user(email="alarmuser2@example.com")
        _create_alarm(client, headers)
        _create_alarm(client, headers, alarm_name="Second Alarm")
        r = client.get("/alarms", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_get_single_alarm(self, client, register_user):
        headers = register_user(email="alarmuser3@example.com")
        created = _create_alarm(client, headers).json()
        r = client.get(f"/alarms/{created['id']}", headers=headers)
        assert r.status_code == 200
        assert r.json()["id"] == created["id"]

    def test_update_alarm(self, client, register_user):
        headers = register_user(email="alarmuser4@example.com")
        created = _create_alarm(client, headers).json()
        r = client.put(f"/alarms/{created['id']}", json={"alarm_name": "Renamed"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["alarm_name"] == "Renamed"

    def test_delete_alarm(self, client, register_user):
        headers = register_user(email="alarmuser5@example.com")
        created = _create_alarm(client, headers).json()
        r = client.delete(f"/alarms/{created['id']}", headers=headers)
        assert r.status_code == 204
        r = client.get(f"/alarms/{created['id']}", headers=headers)
        assert r.status_code == 404

    def test_get_nonexistent_alarm_404(self, client, register_user):
        headers = register_user(email="alarmuser6@example.com")
        r = client.get("/alarms/99999", headers=headers)
        assert r.status_code == 404


class TestAlarmOwnershipIsolation:
    def test_user_cannot_see_others_alarms(self, client, register_user):
        headers_a = register_user(email="owner_a@example.com")
        headers_b = register_user(email="owner_b@example.com")
        created = _create_alarm(client, headers_a).json()

        r = client.get(f"/alarms/{created['id']}", headers=headers_b)
        assert r.status_code == 404

    def test_user_cannot_update_others_alarm(self, client, register_user):
        headers_a = register_user(email="owner_c@example.com")
        headers_b = register_user(email="owner_d@example.com")
        created = _create_alarm(client, headers_a).json()

        r = client.put(f"/alarms/{created['id']}", json={"alarm_name": "Hijacked"}, headers=headers_b)
        assert r.status_code == 404

    def test_user_cannot_delete_others_alarm(self, client, register_user):
        headers_a = register_user(email="owner_e@example.com")
        headers_b = register_user(email="owner_f@example.com")
        created = _create_alarm(client, headers_a).json()

        r = client.delete(f"/alarms/{created['id']}", headers=headers_b)
        assert r.status_code == 404

    def test_alarms_list_scoped_per_user(self, client, register_user):
        headers_a = register_user(email="owner_g@example.com")
        headers_b = register_user(email="owner_h@example.com")
        _create_alarm(client, headers_a)

        r = client.get("/alarms", headers=headers_b)
        assert r.status_code == 200
        assert r.json() == []
