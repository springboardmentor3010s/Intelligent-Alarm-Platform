"""Server-authoritative wake sessions: issue challenges, validate answers, snooze, dismiss."""
import json
import random
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.timeutil import utcnow
from app.models import (CHALLENGE_TYPES, LEVELS, Alarm, ChallengeInstance, UserProfile, WakeSession)
from app.services import challenge_gen, difficulty, verification
from app.services.eventlog import log_event
from app.services.notify import notify

TIMEOUT_GRACE_SECONDS = 2


def _allowed_types(db: Session, session: WakeSession) -> list[str]:
    alarm = db.get(Alarm, session.alarm_id) if session.alarm_id else None
    profile = db.query(UserProfile).filter(UserProfile.user_id == session.user_id).first()
    raw = (alarm.challenge_types if alarm and alarm.challenge_types else None) or \
          (profile.preferred_challenge_types if profile else "")
    types = [t for t in raw.split(",") if t in CHALLENGE_TYPES]
    return types or list(CHALLENGE_TYPES)


def effective_difficulty(session: WakeSession) -> str:
    """Anti-snooze: every snooze makes the final challenge one level harder."""
    idx = LEVELS.index(session.difficulty) if session.difficulty in LEVELS else 1
    return LEVELS[min(len(LEVELS) - 1, idx + session.snooze_count)]


def current_instance(db: Session, session: WakeSession) -> ChallengeInstance | None:
    return (db.query(ChallengeInstance)
            .filter(ChallengeInstance.session_id == session.id, ChallengeInstance.answered_at.is_(None),
                    ChallengeInstance.issued_at >= session.last_ring_at)
            .order_by(ChallengeInstance.issued_at.desc()).first())


def issue_challenge(db: Session, session: WakeSession, rng: random.Random | None = None) -> ChallengeInstance:
    cfg = verification.config_for(session.verification_method)
    exclude = set()
    if cfg.distinct_types:
        exclude = {i.challenge_type for i in db.query(ChallengeInstance).filter(
            ChallengeInstance.session_id == session.id, ChallengeInstance.is_correct.is_(True)).all()}
    ctype = difficulty.choose_type(db, session.user_id, _allowed_types(db, session), exclude, rng)
    diff = effective_difficulty(session)
    g = challenge_gen.generate(ctype, diff, rng)
    inst = ChallengeInstance(
        user_id=session.user_id, session_id=session.id, challenge_type=ctype, difficulty=diff,
        prompt=g["prompt"], correct_answer=g["answer"],
        options=json.dumps(g["options"]) if g["options"] else None, display=g["display"],
        reveal_seconds=g["reveal_seconds"], is_practice=session.is_practice,
        time_limit_seconds=max(10, int(g["time_limit"] * cfg.time_factor)), issued_at=utcnow(),
    )
    db.add(inst)
    db.flush()
    return inst


def public_challenge(inst: ChallengeInstance) -> dict:
    elapsed = (utcnow() - inst.issued_at).total_seconds()
    return {
        "id": str(inst.id), "challenge_type": inst.challenge_type, "difficulty": inst.difficulty,
        "prompt": inst.prompt, "options": json.loads(inst.options) if inst.options else None,
        "display": inst.display, "reveal_seconds": inst.reveal_seconds,
        "time_limit_seconds": inst.time_limit_seconds,
        "seconds_left": max(0, round(inst.time_limit_seconds - elapsed)),
    }


def session_view(db: Session, session: WakeSession, with_challenge: bool = True) -> dict:
    view = {
        "id": str(session.id), "label": session.label, "status": session.status, "is_practice": session.is_practice,
        "sound": session.sound, "volume": session.volume, "scheduled_at": session.scheduled_at,
        "snooze_count": session.snooze_count, "max_snoozes": session.max_snoozes,
        "snooze_minutes": session.snooze_minutes, "snoozed_until": session.snoozed_until,
        "difficulty": effective_difficulty(session), "progress": verification.progress(session),
        "challenge": None,
    }
    if with_challenge and session.status == "ringing":
        inst = current_instance(db, session) or issue_challenge(db, session)
        view["challenge"] = public_challenge(inst)
    return view


def _finalize(db: Session, session: WakeSession) -> None:
    now = utcnow()
    session.status, session.dismissed_at = "dismissed", now
    insts = db.query(ChallengeInstance).filter(ChallengeInstance.session_id == session.id,
                                               ChallengeInstance.answered_at.isnot(None)).all()
    if insts:
        acc = sum(1 for i in insts if i.is_correct) / len(insts)
        ratios = [min(1.0, (i.time_taken_seconds or i.time_limit_seconds) / max(1, i.time_limit_seconds)) for i in insts]
        speed = max(0.0, 1 - sum(ratios) / len(ratios))
        penalty = min(0.3, 0.1 * session.snooze_count)
        session.alertness_score = round(100 * (0.6 * acc + 0.4 * speed) * (1 - penalty), 1)
    if session.is_practice:
        return
    profile = db.query(UserProfile).filter(UserProfile.user_id == session.user_id).first()
    db.flush()
    if profile and profile.difficulty_preference == "auto":
        profile.current_difficulty = difficulty.next_difficulty(db, session.user_id, profile.current_difficulty)
    elif profile and profile.difficulty_preference in LEVELS:
        profile.current_difficulty = profile.difficulty_preference
    from app.services import analytics  # local import avoids a cycle
    analytics.store_habit_score(db, session.user_id)
    streak = analytics.streaks(db, session.user_id)["current"]
    if streak and streak % 7 == 0:
        notify(db, session.user_id, "progress", f"🔥 {streak}-day wake-up streak!",
               f"You've dismissed your alarms {streak} days in a row. Keep it going!",
               dedupe_key=f"streak:{streak}:{session.local_date}")


def answer(db: Session, session: WakeSession, instance_id, user_answer: str) -> dict:
    if session.status != "ringing":
        raise HTTPException(409, "This alarm is not ringing.")
    inst = db.get(ChallengeInstance, instance_id)
    if not inst or inst.session_id != session.id or inst.user_id != session.user_id:
        raise HTTPException(404, "Challenge not found.")
    if inst.answered_at is not None:
        raise HTTPException(409, "This challenge was already answered.")
    now = utcnow()
    elapsed = (now - inst.issued_at).total_seconds()
    timed_out = elapsed > inst.time_limit_seconds + TIMEOUT_GRACE_SECONDS
    correct = (not timed_out) and challenge_gen.answers_match(user_answer, inst.correct_answer)
    inst.answered_at, inst.user_answer = now, (user_answer or "")[:255]
    inst.is_correct, inst.timed_out, inst.time_taken_seconds = correct, timed_out, round(elapsed, 2)
    outcome = verification.apply_answer(session, correct)
    db.flush()  # make this answer visible to the queries that choose the next challenge
    log_event("challenge_answer", user=session.user_id, session=session.id, type=inst.challenge_type,
              difficulty=inst.difficulty, correct=correct, seconds=round(elapsed, 2), timed_out=timed_out)

    if outcome == "dismissed":
        _finalize(db, session)
        db.commit()
        return {"correct": True, "timed_out": False, "outcome": "dismissed",
                "message": "Alarm dismissed. Great job waking up!", "session": session_view(db, session, False),
                "summary": {"alertness_score": session.alertness_score,
                            "seconds_to_dismiss": round((now - session.started_at).total_seconds()),
                            "wrong_answers": session.wrong_count, "snoozes": session.snooze_count}}
    if timed_out:
        msg = "Too slow! A new challenge is ready."
    elif outcome == "round_failed":
        msg = "Not enough correct answers — starting a fresh round."
    elif correct:
        msg = "Correct! Keep going."
    else:
        msg = "Not quite. Here's a new challenge."
    nxt = issue_challenge(db, session)
    db.commit()
    return {"correct": correct, "timed_out": timed_out, "outcome": outcome, "message": msg,
            "session": session_view(db, session, False), "challenge": public_challenge(nxt)}


def snooze(db: Session, session: WakeSession) -> dict:
    if session.status != "ringing":
        raise HTTPException(409, "This alarm is not ringing.")
    if session.snooze_count >= session.max_snoozes:
        raise HTTPException(409, "No snoozes left — solve the challenge to dismiss the alarm.")
    session.snooze_count += 1
    session.status = "snoozed"
    session.snoozed_until = utcnow() + timedelta(minutes=session.snooze_minutes)
    db.commit()
    return session_view(db, session, False)
