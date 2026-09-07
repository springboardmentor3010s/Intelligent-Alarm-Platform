"""Sync routes for offline-first mobile operation.

Implements idempotent upsert with conflict resolution using server timestamps.
Mobile clients cache data locally, then sync via background push/pull.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from ..Models import User, Alarm, ChallengeAttempt, HabitScore
from ..schemas import SyncPendingReq, SyncRes
from ..api.deps import get_current_user
from datetime import datetime
import hashlib
import json

router = APIRouter(prefix="/sync", tags=["sync"])


def _compute_etag(record_data: dict) -> str:
    """Compute a deterministic ETag from record data for conflict detection."""
    serialized = json.dumps(record_data, sort_keys=True, default=str)
    return hashlib.md5(serialized.encode()).hexdigest()[:16]


def _upsert_alarm(db: Session, user_id: int, payload: dict, client_timestamp: datetime) -> tuple:
    """Idempotent upsert for alarm records. Returns (record, is_new)."""
    record_id = payload.get("server_id") or payload.get("id")

    if record_id:
        existing = db.query(Alarm).filter(Alarm.id == record_id, Alarm.user_id == user_id).first()
    else:
        existing = None

    if existing:
        # Update only if client data is newer
        if client_timestamp and existing.updated_at and client_timestamp > existing.updated_at:
            existing.title = payload.get("title", existing.title)
            existing.alarm_type = payload.get("alarm_type", payload.get("type", existing.alarm_type))
            existing.is_enabled = payload.get("is_enabled", existing.is_enabled)
            existing.times_snoozed = payload.get("times_snoozed", existing.times_snoozed)
            if payload.get("next_trigger"):
                existing.next_trigger = datetime.fromisoformat(payload["next_trigger"]) if isinstance(payload["next_trigger"], str) else payload["next_trigger"]
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
        return existing, False
    else:
        new_alarm = Alarm(
            user_id=user_id,
            title=payload.get("title", "Synced Alarm"),
            alarm_type=payload.get("alarm_type", payload.get("type", "Daily")),
            is_enabled=payload.get("is_enabled", True),
            times_snoozed=payload.get("times_snoozed", 0),
            next_trigger=datetime.fromisoformat(payload["next_trigger"]) if payload.get("next_trigger") and isinstance(payload["next_trigger"], str) else payload.get("next_trigger"),
        )
        db.add(new_alarm)
        db.commit()
        db.refresh(new_alarm)
        return new_alarm, True


def _upsert_challenge_attempt(db: Session, user_id: int, payload: dict, client_timestamp: datetime) -> tuple:
    """Idempotent upsert for challenge attempt records."""
    record_id = payload.get("server_id") or payload.get("id")

    if record_id:
        existing = db.query(ChallengeAttempt).filter(
            ChallengeAttempt.id == record_id,
            ChallengeAttempt.user_id == user_id,
        ).first()
    else:
        existing = None

    if existing:
        # Challenge attempts are append-only; update completion status only
        if payload.get("completed") and not existing.completed:
            existing.completed = True
            existing.correct_answers = payload.get("correct_answers", existing.correct_answers)
            existing.total_questions = payload.get("total_questions", existing.total_questions)
            existing.end_time = datetime.utcnow()
            existing.time_taken_seconds = payload.get("time_taken_seconds", existing.time_taken_seconds)
            db.commit()
            db.refresh(existing)
        return existing, False
    else:
        new_attempt = ChallengeAttempt(
            user_id=user_id,
            challenge_id=payload.get("challenge_id", 1),
            attempt_number=payload.get("attempt_number", 1),
            completed=payload.get("completed", False),
            correct_answers=payload.get("correct_answers", 0),
            total_questions=payload.get("total_questions", 1),
            start_time=datetime.fromisoformat(payload["start_time"]) if payload.get("start_time") and isinstance(payload["start_time"], str) else payload.get("start_time", datetime.utcnow()),
            end_time=datetime.fromisoformat(payload["end_time"]) if payload.get("end_time") and isinstance(payload["end_time"], str) else payload.get("end_time"),
            time_taken_seconds=payload.get("time_taken_seconds", 0),
        )
        db.add(new_attempt)
        db.commit()
        db.refresh(new_attempt)
        return new_attempt, True


def _upsert_habit_score(db: Session, user_id: int, payload: dict, client_timestamp: datetime) -> tuple:
    """Idempotent upsert for habit score records (unique per user+date)."""
    date = payload.get("date", datetime.utcnow().strftime("%Y-%m-%d"))

    existing = db.query(HabitScore).filter(
        HabitScore.user_id == user_id,
        HabitScore.date == date,
    ).first()

    if existing:
        # Merge: take higher scores (optimistic merge)
        existing.wake_up_consistency = max(existing.wake_up_consistency, payload.get("wake_up_consistency", 0))
        existing.challenge_completion = max(existing.challenge_completion, payload.get("challenge_completion", 0))
        existing.snooze_reduction = max(existing.snooze_reduction, payload.get("snooze_reduction", 0))
        existing.sleep_schedule_adherence = max(existing.sleep_schedule_adherence, payload.get("sleep_schedule_adherence", 0))
        # Recompute overall
        existing.overall_score = int(
            existing.wake_up_consistency * 0.35 +
            existing.challenge_completion * 0.25 +
            existing.snooze_reduction * 0.20 +
            existing.sleep_schedule_adherence * 0.20
        )
        db.commit()
        db.refresh(existing)
        return existing, False
    else:
        new_score = HabitScore(
            user_id=user_id,
            date=date,
            wake_up_consistency=payload.get("wake_up_consistency", 50),
            challenge_completion=payload.get("challenge_completion", 50),
            snooze_reduction=payload.get("snooze_reduction", 50),
            sleep_schedule_adherence=payload.get("sleep_schedule_adherence", 50),
            overall_score=payload.get("overall_score", 50),
        )
        db.add(new_score)
        db.commit()
        db.refresh(new_score)
        return new_score, True


@router.post("/pending", response_model=SyncRes)
def sync_pending(
    request: SyncPendingReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload offline changes via idempotent upsert.

    Each record is processed independently. Failures don't block other records.
    Returns counts of synced/failed records.
    """
    synced_count = 0
    failed_count = 0
    failed_record_ids = []

    upsert_handlers = {
        "alarms": _upsert_alarm,
        "challenge_attempts": _upsert_challenge_attempt,
        "habit_scores": _upsert_habit_score,
    }

    for record in request.records:
        handler = upsert_handlers.get(record.table_name)
        if not handler:
            failed_count += 1
            failed_record_ids.append(record.record_id)
            continue

        try:
            record_obj, is_new = handler(db, current_user.id, record.payload, record.local_timestamp)
            synced_count += 1
        except Exception:
            failed_count += 1
            failed_record_ids.append(record.record_id)

    return SyncRes(
        synced_count=synced_count,
        failed_count=failed_count,
        failed_record_ids=failed_record_ids,
    )


@router.get("/pull")
def sync_pull(
    since: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download changes since a given timestamp.

    If `since` is not provided, returns all records for the user.
    Used by mobile client to fetch latest server state after reconnecting.
    """
    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid timestamp format. Use ISO 8601.")

    # Pull alarms
    alarms_query = db.query(Alarm).filter(Alarm.user_id == current_user.id)
    if since_dt:
        alarms_query = alarms_query.filter(or_(Alarm.created_at >= since_dt, Alarm.updated_at >= since_dt))
    alarms = alarms_query.all()

    # Pull challenge attempts
    attempts_query = db.query(ChallengeAttempt).filter(ChallengeAttempt.user_id == current_user.id)
    if since_dt:
        attempts_query = attempts_query.filter(ChallengeAttempt.created_at >= since_dt)
    attempts = attempts_query.all()

    # Pull habit scores
    habits_query = db.query(HabitScore).filter(HabitScore.user_id == current_user.id)
    if since_dt:
        habits_query = habits_query.filter(HabitScore.created_at >= since_dt)
    habits = habits_query.all()

    return {
        "alarms": [
            {
                "id": a.id,
                "title": a.title,
                "alarm_type": a.alarm_type,
                "next_trigger": a.next_trigger.isoformat() if a.next_trigger else None,
                "is_enabled": a.is_enabled,
                "times_snoozed": a.times_snoozed,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
            for a in alarms
        ],
        "challenge_attempts": [
            {
                "id": a.id,
                "challenge_id": a.challenge_id,
                "attempt_number": a.attempt_number,
                "completed": a.completed,
                "correct_answers": a.correct_answers,
                "total_questions": a.total_questions,
                "start_time": a.start_time.isoformat() if a.start_time else None,
                "end_time": a.end_time.isoformat() if a.end_time else None,
                "time_taken_seconds": a.time_taken_seconds,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in attempts
        ],
        "habit_scores": [
            {
                "id": h.id,
                "date": h.date,
                "wake_up_consistency": h.wake_up_consistency,
                "challenge_completion": h.challenge_completion,
                "snooze_reduction": h.snooze_reduction,
                "sleep_schedule_adherence": h.sleep_schedule_adherence,
                "overall_score": h.overall_score,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in habits
        ],
        "server_timestamp": datetime.utcnow().isoformat(),
    }
