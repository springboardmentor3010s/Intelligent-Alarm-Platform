"""Recommendation Engine: sleep, wake-up optimisation, habit, productivity and personalised-challenge advice.

A transparent rule-based expert system over the analytics engines - each recommendation can explain
exactly which of the user's own numbers triggered it."""
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow
from app.models import Recommendation
from app.services import analytics as A


def _hm(minutes: float) -> str:
    return f"{int(minutes // 60)}h {int(minutes % 60):02d}m"


def build(db: Session, uid) -> list[dict]:
    wk = utcnow().strftime("%G-W%V")
    w, sn, ch = A.wake_stats(db, uid, 14), A.snooze_pattern(db, uid), A.challenge_stats(db, uid, 30)
    sl, pr, hs = A.sleep_stats(db, uid, 30), A.productivity_correlation(db, uid), A.compute_habit_score(db, uid)
    recs = []

    def add(cat, key, title, body):
        recs.append({"category": cat, "dedupe_key": f"{key}:{wk}", "title": title, "body": body})

    if w["total"] >= 3 and w["success_rate"] < 0.7:
        add("wake", "wake-low", "Your wake-ups are slipping",
            f"You dismissed {round(w['success_rate'] * 100)}% of your alarms in the last 14 days. Try moving your alarm "
            "15 minutes later for a week, or use a Smart Adaptive alarm so it rings at the end of a sleep cycle.")
    if sn["average_snoozes"] and sn["average_snoozes"] >= 1:
        add("habit", "snooze-high", "Snoozing a lot",
            f"You average {sn['average_snoozes']} snoozes per alarm (trend: {sn['trend']}). Lower 'max snoozes' to 1 on your "
            "alarms — fewer snoozes means a harder challenge, which breaks the snooze loop.")
    if sn["worst_day"] and w["total"] >= 7:
        add("wake", "worst-day", f"{sn['worst_day']} is your hardest morning",
            f"Most of your snoozes happen on {sn['worst_day']}. Plan an earlier bedtime the night before.")
    if ch["accuracy"] is not None and ch["total"] >= 5:
        if ch["accuracy"] < 0.6:
            add("challenge", "acc-low", "Challenges feel tough right now",
                f"Your accuracy is {round(ch['accuracy'] * 100)}%. The engine eases difficulty automatically; you can also pin a "
                "lower level in Settings while you build the habit.")
        if ch["best_type"] and ch["weakest_type"] and ch["best_type"] != ch["weakest_type"]:
            add("challenge", "types", f"You shine at {ch['best_type']} challenges",
                f"{ch['best_type'].title()} is your strongest type; {ch['weakest_type']} is your weakest. Put the "
                f"types you enjoy first in Settings → Challenge types, or practise {ch['weakest_type']} in Practice mode.")
    if sl["n"] >= 3:
        gap = sl["target_minutes"] - sl["avg_duration_minutes"]
        if gap >= 45:
            add("sleep", "sleep-short", "You're short on sleep",
                f"You average {_hm(sl['avg_duration_minutes'])} against a target of {_hm(sl['target_minutes'])}. "
                f"Going to bed about {int(gap)} minutes earlier would close the gap.")
        if sl["bedtime_regularity_minutes"] > 60:
            add("sleep", "sleep-irregular", "Irregular bedtime",
                f"Your bedtime varies by about ±{sl['bedtime_regularity_minutes']} minutes. A consistent bedtime is one of the "
                "strongest predictors of easier mornings.")
    for c in pr.get("correlations", []):
        if c["factor"] == "Sleep duration" and c["r"] >= 0.4:
            add("productivity", "prod-sleep", "Sleep and productivity are linked for you",
                f"Your productivity rating rises with sleep duration (r = {c['r']}, {c['n']} days). Protect your sleep on "
                "important days.")
    if w["current_streak"] >= 7:
        add("habit", "streak", f"{w['current_streak']}-day streak — superb!",
            "Consistency is paying off. Consider a Smart Adaptive alarm or a harder verification method for extra challenge.")
    if hs["has_data"] and hs["total"] >= 80:
        add("productivity", "score-high", "Strong habit score",
            f"Your habit score is {hs['total']}/100. You're ready to raise the bar: try 'Accuracy check' verification.")
    if not recs:
        add("habit", "start", "Keep going to unlock insights",
            "Ring a few alarms and log your sleep for a week — recommendations get sharper as your data grows.")
    return recs


def refresh(db: Session, uid) -> list[Recommendation]:
    for r in build(db, uid):
        exists = db.query(Recommendation.id).filter(Recommendation.user_id == uid,
                                                    Recommendation.dedupe_key == r["dedupe_key"]).first()
        if not exists:
            db.add(Recommendation(user_id=uid, **r))
    db.commit()
    return (db.query(Recommendation).filter(Recommendation.user_id == uid, Recommendation.is_dismissed.is_(False))
            .order_by(Recommendation.created_at.desc()).limit(12).all())
