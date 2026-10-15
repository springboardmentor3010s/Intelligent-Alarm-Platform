import csv
import io
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Response
from app.core.security import get_current_user, user_scope
from app.services import report_service
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.alarm import Alarm
from app.models.challenge_attempt import ChallengeAttempt
from app.models.wake_up_verification import WakeUpVerification
from app.services.behavior_analytics import behavior_analytics_service
from app.services.habit_score import habit_score_service

router = APIRouter(prefix="/reports", tags=["Reports and Exports"], dependencies=[Depends(user_scope)])

def _ensure_user(db: Session, user_id: int):
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")

@router.get("/summary/{user_id}")
def report_summary(user_id: int, db: Session = Depends(get_db)):
    _ensure_user(db, user_id)
    since = datetime.now(timezone.utc) - timedelta(days=30)
    verifications = db.execute(select(WakeUpVerification).where(
        WakeUpVerification.user_id == user_id, WakeUpVerification.created_at >= since)).scalars().all()
    attempts = db.execute(select(ChallengeAttempt).where(
        ChallengeAttempt.user_id == user_id, ChallengeAttempt.created_at >= since)).scalars().all()
    alarms = db.execute(select(Alarm).where(Alarm.user_id == user_id)).scalars().all()
    success_count = sum(int(v.successful) for v in verifications)
    correct_count = sum(int(a.is_correct) for a in attempts)
    response_times = [v.response_time for v in verifications if v.response_time is not None]
    try:
        behavior = behavior_analytics_service.get_user_behavior(db=db, user_id=user_id)
        habit = habit_score_service.calculate_habit_score(db=db, user_id=user_id)
    except Exception:
        behavior, habit = {}, {}
    return {
        "user_id": user_id, "period_days": 30,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "alarms": {"total": len(alarms), "enabled": sum(int(a.enabled) for a in alarms)},
        "wake_up": {"attempts": len(verifications), "successful": success_count,
                    "success_rate_percent": round(100 * success_count / len(verifications), 1) if verifications else 0,
                    "average_response_seconds": round(sum(response_times) / len(response_times), 2) if response_times else None},
        "challenges": {"attempts": len(attempts), "correct": correct_count,
                       "accuracy_percent": round(100 * correct_count / len(attempts), 1) if attempts else 0},
        "habit_score": habit.get("habit_score", 0),
        "behavior": behavior,
    }

@router.get("/export.csv")
def export_csv(user_id: int | None = None, current: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    user_id = user_id or current.id
    _ensure_user(db, user_id)
    alarms = db.execute(select(Alarm).where(Alarm.user_id == user_id).order_by(Alarm.alarm_time)).scalars().all()
    verifications = db.execute(select(WakeUpVerification).where(
        WakeUpVerification.user_id == user_id).order_by(WakeUpVerification.created_at.desc())).scalars().all()
    attempts = db.execute(select(ChallengeAttempt).where(
        ChallengeAttempt.user_id == user_id).order_by(ChallengeAttempt.created_at.desc())).scalars().all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["record_type", "record_id", "date_time", "title_or_type", "status_or_result", "duration_seconds", "details"])
    for a in alarms:
        writer.writerow(["alarm", a.id, a.created_at.isoformat() if a.created_at else "", a.title,
                         "enabled" if a.enabled else "disabled", "", f"time={a.alarm_time}; recurrence={a.recurrence}; challenge={a.challenge_type}/{a.difficulty}"])
    for v in verifications:
        writer.writerow(["wake_up_verification", v.id, v.created_at.isoformat(), v.verification_method,
                         "successful" if v.successful else v.status, v.response_time or "", f"alarm_id={v.alarm_id}; attempt={v.attempt_number}"])
    for a in attempts:
        writer.writerow(["challenge_attempt", a.id, a.created_at.isoformat(), f"challenge_id={a.challenge_id}",
                         "correct" if a.is_correct else "incorrect", a.response_time, f"attempt={a.attempt_number}; submitted_answer={a.submitted_answer}"])
    payload = "\ufeff" + buffer.getvalue()
    return StreamingResponse(iter([payload]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="cognitive_alarm_report_user_{user_id}.csv"'})


@router.get("/types")
def report_types():
    return {"types": [{"id": k, "title": v} for k, v in report_service.REPORT_TYPES.items()]}


@router.get("/export.pdf")
def export_pdf(report: str = "habit", days: int = 30, user_id: int | None = None,
               current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user_id or current.id
    data = report_service.build_report(db, user_id, report, days)
    return Response(
        content=report_service.render_pdf(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{report}_report_user_{user_id}.pdf"'},
    )


@router.get("/export.xlsx")
def export_xlsx(report: str = "habit", days: int = 30, user_id: int | None = None,
                current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user_id or current.id
    data = report_service.build_report(db, user_id, report, days)
    return Response(
        content=report_service.render_xlsx(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{report}_report_user_{user_id}.xlsx"'},
    )
