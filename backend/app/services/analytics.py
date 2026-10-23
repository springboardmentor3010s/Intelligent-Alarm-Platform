"""Behavioural analytics, learning-pattern analysis, sleep analytics, productivity correlation and the
weighted Habit Scoring Engine (35% consistency, 25% challenge completion, 20% snooze reduction, 20% sleep)."""
from collections import defaultdict
from datetime import date, timedelta
from statistics import mean, pstdev

import pandas as pd
from sqlalchemy.orm import Session

from app.core.timeutil import local_now
from app.models import ChallengeInstance, HabitScore, SleepLog, UserProfile, WakeSession

WEIGHTS = {"wake_consistency": 0.35, "challenge_completion": 0.25, "snooze_reduction": 0.20, "sleep_adherence": 0.20}
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def profile_of(db: Session, uid) -> UserProfile | None:
    return db.query(UserProfile).filter(UserProfile.user_id == uid).first()


def today_of(db: Session, uid) -> date:
    p = profile_of(db, uid)
    return local_now(p.timezone if p else "UTC").date()


def finished_sessions(db: Session, uid, days: int):
    since = today_of(db, uid) - timedelta(days=days)
    return (db.query(WakeSession)
            .filter(WakeSession.user_id == uid, WakeSession.is_practice.is_(False),
                    WakeSession.status.in_(["dismissed", "missed"]), WakeSession.local_date >= since)
            .order_by(WakeSession.local_date.asc(), WakeSession.scheduled_at.asc()).all())


def streaks(db: Session, uid) -> dict:
    rows = (db.query(WakeSession).filter(WakeSession.user_id == uid, WakeSession.is_practice.is_(False),
                                         WakeSession.status.in_(["dismissed", "missed"])).all())
    by_day = defaultdict(lambda: [0, 0])  # date -> [dismissed, missed]
    for s in rows:
        by_day[s.local_date][0 if s.status == "dismissed" else 1] += 1
    good = {d for d, (ok, bad) in by_day.items() if ok and not bad}
    today = today_of(db, uid)
    cur, d = 0, today if today in good else today - timedelta(days=1)
    while d in good:
        cur += 1
        d -= timedelta(days=1)
    best = run = 0
    prev = None
    for d in sorted(good):
        run = run + 1 if prev and (d - prev).days == 1 else 1
        best, prev = max(best, run), d
    return {"current": cur, "best": best}


def wake_stats(db: Session, uid, days: int = 30) -> dict:
    ss = finished_sessions(db, uid, days)
    dismissed = [s for s in ss if s.status == "dismissed"]
    total = len(ss)
    ttd = [(s.dismissed_at - s.started_at).total_seconds() for s in dismissed if s.dismissed_at]
    on_time = [s for s in dismissed if s.dismissed_at and (s.dismissed_at - s.scheduled_at).total_seconds() <= 600]
    wd = defaultdict(lambda: [0, 0, 0])  # weekday -> [sessions, snoozes, missed]
    for s in ss:
        w = wd[s.local_date.weekday()]
        w[0] += 1
        w[1] += s.snooze_count
        w[2] += 1 if s.status == "missed" else 0
    return {
        "days": days, "total": total, "dismissed": len(dismissed), "missed": total - len(dismissed),
        "success_rate": round(len(dismissed) / total, 3) if total else None,
        "on_time_rate": round(len(on_time) / total, 3) if total else None,
        "avg_snoozes": round(mean(s.snooze_count for s in ss), 2) if ss else None,
        "avg_seconds_to_dismiss": round(mean(ttd)) if ttd else None,
        "avg_alertness": round(mean(s.alertness_score for s in dismissed if s.alertness_score is not None), 1)
        if any(s.alertness_score is not None for s in dismissed) else None,
        "by_weekday": [{"day": WEEKDAYS[i], "sessions": wd[i][0], "snoozes": wd[i][1], "missed": wd[i][2]} for i in range(7)],
        **{f"{k}_streak": v for k, v in streaks(db, uid).items()},
    }


def snooze_pattern(db: Session, uid, days: int = 28) -> dict:
    ss = [s for s in finished_sessions(db, uid, days)]
    if not ss:
        return {"average_snoozes": None, "trend": "no_data", "worst_day": None, "days_tracked": 0}
    half = max(1, len(ss) // 2)
    first, second = ss[:half], ss[half:] or ss[:half]
    f, l = mean(s.snooze_count for s in first), mean(s.snooze_count for s in second)
    trend = "improving" if l < f - 0.3 else "worsening" if l > f + 0.3 else "stable"
    per_day = defaultdict(list)
    for s in ss:
        per_day[WEEKDAYS[s.local_date.weekday()]].append(s.snooze_count)
    worst = max(per_day.items(), key=lambda kv: mean(kv[1]))[0] if per_day else None
    return {"average_snoozes": round(mean(s.snooze_count for s in ss), 2), "trend": trend,
            "worst_day": worst, "days_tracked": len({s.local_date for s in ss})}


def challenge_stats(db: Session, uid, days: int = 30) -> dict:
    since = today_of(db, uid) - timedelta(days=days)
    rows = (db.query(ChallengeInstance)
            .filter(ChallengeInstance.user_id == uid, ChallengeInstance.is_practice.is_(False),
                    ChallengeInstance.answered_at.isnot(None), ChallengeInstance.issued_at >= since).all())
    if not rows:
        return {"total": 0, "correct": 0, "accuracy": None, "avg_seconds": None, "by_type": [], "by_difficulty": [],
                "trend": [], "best_type": None, "weakest_type": None}

    def agg(key):
        d = defaultdict(lambda: [0, 0, 0.0])
        for r in rows:
            x = d[key(r)]
            x[0] += 1
            x[1] += 1 if r.is_correct else 0
            x[2] += r.time_taken_seconds or 0
        return d

    by_type = [{"type": k, "attempts": v[0], "correct": v[1], "accuracy": round(v[1] / v[0], 3),
                "avg_seconds": round(v[2] / v[0], 1)} for k, v in agg(lambda r: r.challenge_type).items()]
    by_diff = [{"difficulty": k, "attempts": v[0], "accuracy": round(v[1] / v[0], 3)}
               for k, v in agg(lambda r: r.difficulty).items()]
    daily = defaultdict(lambda: [0, 0])
    for r in rows:
        daily[r.issued_at.date().isoformat()][0] += 1
        daily[r.issued_at.date().isoformat()][1] += 1 if r.is_correct else 0
    trend = [{"date": d, "accuracy": round(v[1] / v[0], 3)} for d, v in sorted(daily.items())]
    qualified = [t for t in by_type if t["attempts"] >= 3] or by_type
    return {
        "total": len(rows), "correct": sum(1 for r in rows if r.is_correct),
        "accuracy": round(sum(1 for r in rows if r.is_correct) / len(rows), 3),
        "avg_seconds": round(mean(r.time_taken_seconds or 0 for r in rows), 1),
        "by_type": sorted(by_type, key=lambda t: -t["attempts"]), "by_difficulty": by_diff, "trend": trend,
        "best_type": max(qualified, key=lambda t: t["accuracy"])["type"],
        "weakest_type": min(qualified, key=lambda t: t["accuracy"])["type"],
    }


def _bed_minutes(t) -> int:  # minutes after 18:00 so that 23:30 and 00:30 sit close together
    return (t.hour * 60 + t.minute - 18 * 60) % (24 * 60)


def sleep_stats(db: Session, uid, days: int = 30) -> dict:
    since = today_of(db, uid) - timedelta(days=days)
    logs = (db.query(SleepLog).filter(SleepLog.user_id == uid, SleepLog.log_date >= since)
            .order_by(SleepLog.log_date.asc()).all())
    p = profile_of(db, uid)
    target = p.sleep_duration_minutes if p else 450
    if not logs:
        return {"n": 0, "target_minutes": target, "series": []}
    beds = [_bed_minutes(l.bedtime) for l in logs]
    avg_bed = int(mean(beds))
    total = (avg_bed + 18 * 60) % (24 * 60)
    durations = [l.duration_minutes for l in logs]
    return {
        "n": len(logs), "target_minutes": target,
        "avg_duration_minutes": round(mean(durations)),
        "avg_quality": round(mean(l.quality for l in logs if l.quality), 2) if any(l.quality for l in logs) else None,
        "avg_bedtime": f"{total // 60:02d}:{total % 60:02d}",
        "bedtime_regularity_minutes": round(pstdev(beds)) if len(beds) > 1 else 0,
        "sleep_debt_minutes": round(sum(max(0, target - d) for d in durations)),
        "series": [{"date": l.log_date.isoformat(), "duration": l.duration_minutes, "quality": l.quality,
                    "productivity": l.productivity, "bedtime": l.bedtime.strftime("%H:%M")} for l in logs],
    }


def productivity_correlation(db: Session, uid, days: int = 60) -> dict:
    """Pearson correlation between the user's daily productivity rating and sleep/wake behaviour."""
    since = today_of(db, uid) - timedelta(days=days)
    logs = db.query(SleepLog).filter(SleepLog.user_id == uid, SleepLog.log_date >= since,
                                     SleepLog.productivity.isnot(None)).all()
    sessions = finished_sessions(db, uid, days)
    snz = defaultdict(list)
    alert = defaultdict(list)
    for s in sessions:
        snz[s.local_date].append(s.snooze_count)
        if s.alertness_score is not None:
            alert[s.local_date].append(s.alertness_score)
    rows = [{"productivity": l.productivity, "sleep_hours": l.duration_minutes / 60,
             "snoozes": mean(snz[l.log_date]) if snz.get(l.log_date) else None,
             "alertness": mean(alert[l.log_date]) if alert.get(l.log_date) else None} for l in logs]
    df = pd.DataFrame(rows)
    out = {"n": len(df), "correlations": []}
    if len(df) < 5:
        out["note"] = "Log at least 5 days of sleep with a productivity rating to unlock correlation insights."
        return out
    for col, label in (("sleep_hours", "Sleep duration"), ("snoozes", "Snoozes"), ("alertness", "Wake-up alertness")):
        sub = df[["productivity", col]].dropna()
        if len(sub) >= 5 and sub[col].nunique() > 1 and sub["productivity"].nunique() > 1:
            out["correlations"].append({"factor": label, "r": round(float(sub["productivity"].corr(sub[col])), 2),
                                        "n": int(len(sub))})
    out["avg_productivity"] = round(float(df["productivity"].mean()), 2)
    return out


# ------------------------------- habit scoring -------------------------------

def _sleep_adherence(db: Session, uid, days=14):
    since = today_of(db, uid) - timedelta(days=days)
    logs = db.query(SleepLog).filter(SleepLog.user_id == uid, SleepLog.log_date >= since).all()
    if not logs:
        return None
    p = profile_of(db, uid)
    beds = [_bed_minutes(l.bedtime) for l in logs]
    ref = _bed_minutes(p.bedtime) if p and p.bedtime else mean(beds)
    bed_score = max(0.0, 100 - mean(abs(b - ref) for b in beds) / 90 * 100)
    target = p.sleep_duration_minutes if p else 450
    dur_score = max(0.0, 100 - mean(abs(l.duration_minutes - target) for l in logs) / 120 * 100)
    return round(0.5 * bed_score + 0.5 * dur_score, 1)


def compute_habit_score(db: Session, uid, days: int = 14) -> dict:
    ss = finished_sessions(db, uid, days)
    wake = round(100 * sum(1 for s in ss if s.status == "dismissed") / len(ss), 1) if ss else None
    ch = challenge_stats(db, uid, days)
    chal = round(100 * ch["accuracy"], 1) if ch["accuracy"] is not None else None
    snooze = None
    if ss:
        ratio = mean(min(1.0, s.snooze_count / max(1, s.max_snoozes)) if s.max_snoozes else 0 for s in ss)
        snooze = round(100 * (1 - ratio), 1)
    sleep = _sleep_adherence(db, uid, days)
    comps = {"wake_consistency": wake, "challenge_completion": chal, "snooze_reduction": snooze, "sleep_adherence": sleep}
    avail = {k: v for k, v in comps.items() if v is not None}
    total = round(sum(WEIGHTS[k] * v for k, v in avail.items()) / sum(WEIGHTS[k] for k in avail), 1) if avail else 0.0
    # Extra sub-scores named in the spec (reported, not part of the weighted total)
    st = sleep_stats(db, uid, days)
    prod = productivity_correlation(db, uid)
    extras = {
        "habit_adherence": wake_stats(db, uid, days)["on_time_rate"],
        "productivity_score": round(prod["avg_productivity"] * 20, 1) if prod.get("avg_productivity") else None,
        "sleep_routine": max(0, round(100 - st.get("bedtime_regularity_minutes", 0) / 90 * 100, 1)) if st["n"] > 1 else None,
    }
    return {**comps, "total": total, "has_data": bool(avail), "weights": WEIGHTS, "extras": extras,
            "missing": [k for k, v in comps.items() if v is None]}


def store_habit_score(db: Session, uid) -> HabitScore:
    d, day = compute_habit_score(db, uid), today_of(db, uid)
    row = db.query(HabitScore).filter(HabitScore.user_id == uid, HabitScore.score_date == day).first() \
        or HabitScore(user_id=uid, score_date=day)
    row.wake_consistency, row.challenge_completion = d["wake_consistency"], d["challenge_completion"]
    row.snooze_reduction, row.sleep_adherence, row.total = d["snooze_reduction"], d["sleep_adherence"], d["total"]
    db.add(row)
    db.flush()
    return row


def habit_history(db: Session, uid, days: int = 30) -> list[dict]:
    since = today_of(db, uid) - timedelta(days=days)
    rows = (db.query(HabitScore).filter(HabitScore.user_id == uid, HabitScore.score_date >= since)
            .order_by(HabitScore.score_date.asc()).all())
    return [{"date": r.score_date.isoformat(), "total": r.total, "wake_consistency": r.wake_consistency,
             "challenge_completion": r.challenge_completion, "snooze_reduction": r.snooze_reduction,
             "sleep_adherence": r.sleep_adherence} for r in rows]


def member_summary(db: Session, uid) -> dict:
    s = compute_habit_score(db, uid)
    w = wake_stats(db, uid, 14)
    return {"habit_score": s["total"] if s["has_data"] else None, "success_rate": w["success_rate"],
            "avg_snoozes": w["avg_snoozes"], "current_streak": w["current_streak"]}
