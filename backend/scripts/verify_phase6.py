# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Independent end-to-end verification of the six Phase 6 AI engines.

Boots the real app on a temp SQLite DB and exercises every engine through
HTTP plus direct service calls. Exits 0 only if ALL six engines verify;
prints a per-engine verdict table. Run from backend/:
    python scripts/verify_phase6.py
"""

import os
import sys
import tempfile

TMP_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
os.environ["DATABASE_URL"] = f"sqlite:///{TMP_DB}"
os.environ["SECRET_KEY"] = "verify_secret_key_that_is_long_enough"
os.environ["CORS_ORIGINS"] = "http://testserver"
os.environ["ENVIRONMENT"] = "development"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta, timezone  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

# NOTE: app.database reads backend/.env at import with override=True, so env
# above cannot redirect the app's engine. Instead we create an isolated engine
# and override the get_db dependency (same pattern as tests/conftest.py), so
# this verifier never touches the real dev database.
from app.database import get_db  # noqa: E402
from app.Models import Alarm, Base, HabitScore  # noqa: E402
from app.main import app  # noqa: E402

verify_engine = create_engine(
    f"sqlite:///{TMP_DB}",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(bind=verify_engine)
VerifySession = sessionmaker(bind=verify_engine)


def _override_get_db():
    session = VerifySession()
    try:
        yield session
    finally:
        session.close()


app.dependency_overrides[get_db] = _override_get_db

results = []


def check(engine, name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((engine, name, status, detail))
    print(f"[{status}] {engine}: {name}" + (f" — {detail}" if detail else ""))
    return cond


def register(client, email):
    r = client.post("/api/v1/auth/register", json={
        "email": email, "password": "password123", "timezone": "UTC",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    return body["user"]["id"], {"Authorization": f"Bearer {body['access_token']}"}


def main():
    with TestClient(app) as client:
        # ---- fresh user: gates must report unavailable, never fabricated ----
        fresh_id, fresh_h = register(client, "verify_fresh@test.io")

        ml = client.get("/api/v1/analytics/ml-status", headers=fresh_h).json()
        check("ml-status", "version/fallback/training fields present",
              ml.get("model_version") == "1.0.0"
              and ml.get("training_data") == "synthetic"
              and ml.get("fallback") == "rule_based_v2"
              and isinstance(ml.get("last_training"), dict),
              f"model_loaded={ml.get('model_loaded')}")

        an = client.get("/api/v1/analytics/anomalies", headers=fresh_h).json()
        check("anomaly", "thin history -> available:false with reason",
              an["available"] is False and bool(an.get("reason")) and an["anomalies"] == [])

        fc = client.get("/api/v1/analytics/forecast", headers=fresh_h).json()
        check("forecast", "thin history -> available:false with reason",
              fc["available"] is False and bool(fc.get("reason")))

        # ---- difficulty engine: direct + served ----
        from app.ai_engine import difficulty as engine
        from app.ai_engine.difficulty import MLInferenceService, explain_difficulty, recommend_difficulty

        pred, method = MLInferenceService.predict_difficulty(0.9, 20.0, 0, 8, "Medium")
        check("difficulty", f"direct predict works (method={method})",
              pred in ("Beginner", "Easy", "Medium", "Hard", "Expert") and method in ("ml", "rule_based"),
              f"predicted={pred}")

        # Rule vote tested directly so torch presence cannot mask it.
        rule_out = engine._rule_based_difficulty(
            0.05, "Hard", avg_time_seconds=300.0, snooze_frequency=5.0,
            failed_attempts=4, wake_up_consistency=10.0)
        check("difficulty", "6-signal vote steps down on bad signals",
              rule_out == "Easy", f"predicted={rule_out}")

        expl = explain_difficulty(0.9, "Medium", predicted="Hard", method="rule_based_v2",
                                  avg_time_seconds=18, snooze_frequency=0.0)
        check("difficulty", "explanation names signals",
              "accuracy 90%" in expl and "Hard" in expl)

        # served adaptive path: solve one Easy Math, next must stay in band
        nxt = client.get("/api/v1/challenges/next?challenge_type=Math&difficulty=Easy&question_count=1",
                         headers=fresh_h).json()
        q = nxt["puzzle_payload"]["questions"][0]["prompt"]
        import re
        m = re.match(r"^(\d+)\s*([+\-x])\s*(\d+)$", q.strip())
        a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
        ans = str(a + b) if op == "+" else (str(abs(a - b)) if op == "-" else str(a * b))
        sub = client.post("/api/v1/challenges/submit", headers=fresh_h, json={
            "challenge_id": nxt["id"], "challenge_attempt_id": nxt["challenge_attempt_id"],
            "user_answer": ans, "time_taken_seconds": 20})
        check("challenge_generation", "serve has no answers; submit verifies",
              sub.status_code == 200 and sub.json()["completed"] is True
              and "expected_answers" not in str(nxt),
              f"completed={sub.json().get('completed')}")

        nxt2 = client.get("/api/v1/challenges/next?challenge_type=Math&question_count=1",
                          headers=fresh_h).json()
        check("difficulty", "served adaptive stays in ±1 band after Easy",
              nxt2["difficulty"] == "Medium", f"difficulty={nxt2['difficulty']}")

        # ---- behavior analysis: real values ----
        summary = client.get("/api/v1/analytics/me", headers=fresh_h).json()
        check("behavior_analysis", "summary reflects the solved attempt",
              summary["challenge_accuracy"] == 1.0
              and summary["recent_activity"]["challenge_accuracy_by_type"]["Math"]["attempts"] >= 1,
              f"accuracy={summary['challenge_accuracy']}")

        # ---- recommendations carry reason + source ----
        db = VerifySession()
        try:
            db.add(Alarm(user_id=fresh_id, title="S", alarm_type="Daily",
                         next_trigger=datetime.now(timezone.utc), is_enabled=True, times_snoozed=4))
            db.commit()
        finally:
            db.close()
        recs = client.get("/api/v1/analytics/recommendations", headers=fresh_h).json()
        check("recommendations", "every rec has reason + source_metric",
              len(recs) >= 1 and all(r.get("reason") and r.get("source_metric", {}).get("key") for r in recs),
              f"count={len(recs)}")

        # ---- rich user: anomaly detection + forecast trend ----
        rich_id, rich_h = register(client, "verify_rich@test.io")
        db = VerifySession()
        try:
            today = datetime.now(timezone.utc).date()
            for i, score in enumerate([50, 52, 51, 53, 55, 58, 62]):
                target = (today - timedelta(days=6 - i)).strftime("%Y-%m-%d")
                db.add(HabitScore(user_id=rich_id, date=target, wake_up_consistency=score,
                                 challenge_completion=score, snooze_reduction=score,
                                 sleep_schedule_adherence=score, overall_score=score))
            db.add(Alarm(user_id=rich_id, title="Spike", alarm_type="One-Time",
                         next_trigger=datetime.now(timezone.utc), is_enabled=False, times_snoozed=5))
            db.commit()
        finally:
            db.close()

        an2 = client.get("/api/v1/analytics/anomalies", headers=rich_h).json()
        check("anomaly", "spike flagged on rich history",
              an2["available"] is True and [a["type"] for a in an2["anomalies"]] == ["snooze_spike"],
              f"types={[a['type'] for a in an2['anomalies']]}")

        fc2 = client.get("/api/v1/analytics/forecast", headers=rich_h).json()
        # Series 50..62 has least-squares slope 52/28 ≈ 1.857 pts/day:
        # predicted = 62 + 7*52/28 = 75.0; n=7 but |slope|<2 -> medium.
        check("forecast", "rising series -> improving/medium",
              fc2["available"] is True and fc2["trend"] == "improving"
              and fc2["confidence"] == "medium" and fc2["predicted_next_week"] == 75.0,
              f"trend={fc2['trend']} predicted={fc2['predicted_next_week']}")

        # ---- recommend_difficulty on measured rows ----
        db = VerifySession()
        try:
            pred3, m3, e3 = recommend_difficulty(db, rich_id, "Medium")
        finally:
            db.close()
        check("difficulty", "DB-backed recommend returns label+method+explanation",
              pred3 in ("Beginner", "Easy", "Medium", "Hard", "Expert") and bool(e3),
              f"{pred3}/{m3}")

    failed = [r for r in results if r[2] == "FAIL"]
    print(f"\nVERIFY PHASE 6 RESULT: {'ALL PASS' if not failed else f'{len(failed)} FAILURES'} "
          f"({len(results) - len(failed)}/{len(results)})")
    try:
        os.unlink(TMP_DB)
    except OSError:
        pass
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
