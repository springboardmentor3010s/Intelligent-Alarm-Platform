"""Alarm CRUD, snooze cap, and schema validation tests."""


def test_create_and_list_alarm(client, user_headers):
    r = client.post("/api/v1/alarms", headers=user_headers, json={
        "title": "Wake up", "type": "Daily", "time": "06:30",
        "challenge_type": "Math", "difficulty": "Easy", "question_count": 1,
    })
    assert r.status_code == 200, r.text
    alarm = r.json()
    assert alarm["title"] == "Wake up"
    assert alarm["alarm_type"] == "Daily"
    assert alarm["time"] == "06:30"
    assert alarm["next_trigger"]

    lst = client.get("/api/v1/alarms", headers=user_headers)
    assert lst.status_code == 200
    assert any(a["id"] == alarm["id"] for a in lst.json())


def test_update_alarm(client, user_headers):
    created = client.post("/api/v1/alarms", headers=user_headers, json={
        "title": "A", "type": "One-Time", "time": "07:00", "challenge_type": "Math",
    }).json()
    upd = client.put(f"/api/v1/alarms/{created['id']}", headers=user_headers, json={
        "title": "A2", "type": "Daily", "time": "07:30", "challenge_type": "Logic",
    })
    assert upd.status_code == 200
    assert upd.json()["title"] == "A2"


def test_delete_alarm(client, user_headers):
    created = client.post("/api/v1/alarms", headers=user_headers, json={
        "title": "Del", "type": "One-Time", "time": "08:00",
    }).json()
    d = client.delete(f"/api/v1/alarms/{created['id']}", headers=user_headers)
    assert d.status_code == 200
    assert d.json()["status"] == "success"


def test_snooze_caps_at_five(client, user_headers):
    created = client.post("/api/v1/alarms", headers=user_headers, json={
        "title": "S", "type": "Daily", "time": "06:00",
    }).json()
    count = 0
    for _ in range(5):
        s = client.post(f"/api/v1/alarms/{created['id']}/snooze", headers=user_headers)
        assert s.status_code == 200, s.text
        count = s.json()["times_snoozed"]
    assert count == 5
    # sixth snooze is rejected
    over = client.post(f"/api/v1/alarms/{created['id']}/snooze", headers=user_headers)
    assert over.status_code == 400


def test_invalid_alarm_payload_rejected(client, user_headers):
    r = client.post("/api/v1/alarms", headers=user_headers, json={"title": ""})
    assert r.status_code in (400, 422)
