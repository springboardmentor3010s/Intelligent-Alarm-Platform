from datetime import datetime
import json

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.alarm import Alarm
from ..models.activity import Activity
from ..models.challenge import Challenge
from ..models.challenge_attempt import ChallengeAttempt
from ..models.alarm_performance import AlarmPerformance
from ..schemas.alarm import (
    AlarmCreate,
    AlarmUpdate,
    AlarmResponse
)
from ..utils.deps import get_current_user
from ..services.notification_service import create_notification
from ..services.analytics_service import generate_recommendations
from ..services.performance_service import record_alarm_performance


# ============================================================
# ROUTER
# ============================================================

router = APIRouter()


def _latest_ringing_activity(db, user_id, alarm_id):
    activities = (
        db.query(Activity)
        .filter(
            Activity.user_id == user_id,
            Activity.alarm_id == alarm_id,
            Activity.activity_type == "trigger",
        )
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .all()
    )
    for activity in activities:
        metadata = json.loads(activity.metadata_json or "{}")
        if metadata.get("status", "ringing") == "ringing":
            return activity, metadata
    return None, None


# ============================================================
# CREATE ALARM
# ============================================================

@router.post(
    "",
    response_model=AlarmResponse
)
def create_alarm(
    data: AlarmCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    alarm_data = data.model_dump()

    count = alarm_data.get(
        "challenge_question_count",
        5
    )

    if count < 1:
        count = 5

    if count > 20:
        count = 20

    alarm_data["challenge_question_count"] = count

    alarm = Alarm(
        user_id=user.id,
        **alarm_data
    )

    db.add(alarm)
    db.commit()
    db.refresh(alarm)

    try:
        create_notification(
            db,
            user.id,
            "Alarm created",
            f"{alarm.title} is scheduled for {alarm.alarm_time}."
        )
    except Exception:
        pass

    return alarm


# ============================================================
# GET ALL ALARMS
# ============================================================

@router.get(
    "",
    response_model=list[AlarmResponse]
)
def list_alarms(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    alarms = (
        db.query(Alarm)
        .filter(
            Alarm.user_id == user.id
        )
        .order_by(
            Alarm.alarm_time
        )
        .all()
    )

    return alarms


# ============================================================
# UPDATE ALARM
# ============================================================

@router.post(
    "/{alarm_id}/trigger"
)
def trigger_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user.id
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    now = datetime.utcnow()
    if alarm.last_triggered and (now - alarm.last_triggered).total_seconds() < 3:
        return {
            "message": "Alarm trigger already recorded",
            "last_triggered": alarm.last_triggered,
            "ringing": True,
        }

    alarm.last_triggered = now
    alarm.challenge_completed = False
    db.add(
        Activity(
            user_id=user.id,
            alarm_id=alarm.id,
            activity_type="trigger",
            value=1,
            metadata_json=json.dumps({"status": "ringing"}),
            created_at=now,
        )
    )
    db.commit()
    db.refresh(alarm)

    return {
        "message": "Alarm triggered successfully",
        "last_triggered": alarm.last_triggered,
        "ringing": True,
    }


@router.put(
    "/{alarm_id}",
    response_model=AlarmResponse
)
def update_alarm(
    alarm_id: int,
    data: AlarmUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user.id
        )
        .first()
    )

    if not alarm:

        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    update_data = data.model_dump(
        exclude_unset=True
    )

    if "challenge_question_count" in update_data:

        count = update_data[
            "challenge_question_count"
        ]

        if count < 1:
            count = 5

        if count > 20:
            count = 20

        update_data[
            "challenge_question_count"
        ] = count

    for key, value in update_data.items():

        setattr(
            alarm,
            key,
            value
        )

    db.commit()
    db.refresh(alarm)

    return alarm


# ============================================================
# DELETE ALARM
# ============================================================

@router.delete(
    "/{alarm_id}"
)
def delete_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user.id
        )
        .first()
    )

    if not alarm:

        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    # Delete activity records
    db.query(AlarmPerformance).filter(
        AlarmPerformance.alarm_id == alarm.id
    ).delete(synchronize_session=False)
    db.query(Activity).filter(
        Activity.alarm_id == alarm.id
    ).delete(
        synchronize_session=False
    )

    # Delete challenge attempts before their parent questions.
    challenge_ids = [
        row[0]
        for row in db.query(Challenge.id)
        .filter(Challenge.alarm_id == alarm.id)
        .all()
    ]
    if challenge_ids:
        db.query(ChallengeAttempt).filter(
            ChallengeAttempt.challenge_id.in_(challenge_ids)
        ).delete(synchronize_session=False)
        db.query(Challenge).filter(
            Challenge.id.in_(challenge_ids)
        ).delete(synchronize_session=False)

    # Delete alarm
    db.delete(alarm)

    db.commit()

    return {
        "message": "Alarm deleted successfully"
    }


# ============================================================
# SNOOZE ALARM
# ============================================================

@router.post(
    "/{alarm_id}/snooze",
    response_model=AlarmResponse
)
def snooze_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user.id
        )
        .first()
    )

    if not alarm:

        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    trigger_activity, trigger_metadata = _latest_ringing_activity(
        db,
        user.id,
        alarm.id,
    )
    if trigger_activity:
        trigger_metadata["status"] = "snoozed"
        trigger_activity.metadata_json = json.dumps(trigger_metadata)

    alarm.snooze_count += 1

    activity = Activity(
        user_id=user.id,
        alarm_id=alarm.id,
        activity_type="snooze",
        value=1
    )

    db.add(activity)

    db.commit()
    db.refresh(alarm)

    return alarm


# ============================================================
# COMPLETE ALARM
# ============================================================

@router.post(
    "/{alarm_id}/complete",
    response_model=AlarmResponse
)
def complete_alarm(
    alarm_id: int,
    session_id: str | None = Body(default=None, embed=True),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user.id
        )
        .first()
    )

    if not alarm:

        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    if session_id:
        prior_completion = (
            db.query(Activity)
            .filter(
                Activity.user_id == user.id,
                Activity.alarm_id == alarm.id,
                Activity.activity_type == "complete",
            )
            .order_by(Activity.created_at.desc())
            .all()
        )
        for activity in prior_completion:
            metadata = json.loads(activity.metadata_json or "{}")
            if metadata.get("session_id") == session_id:
                return alarm

        session_questions = (
            db.query(Challenge)
            .filter(
                Challenge.user_id == user.id,
                Challenge.alarm_id == alarm.id,
                Challenge.session_id == session_id,
            )
            .all()
        )
        if not session_questions or not all(
            question.is_completed for question in session_questions
        ):
            raise HTTPException(
                status_code=400,
                detail="The cognitive challenge session is not successfully completed.",
            )

    # --------------------------------------------------------
    # REQUIRE CHALLENGE
    # --------------------------------------------------------

    if alarm.is_smart and not session_id:

        if not alarm.challenge_completed:

            raise HTTPException(
                status_code=400,
                detail="Complete the cognitive challenge before dismissing the alarm."
            )

    # --------------------------------------------------------
    # COMPLETE
    # --------------------------------------------------------

    alarm.completed_count += 1
    if alarm.alarm_type == "one_time":
        alarm.is_active = False

    trigger_activity, trigger_metadata = _latest_ringing_activity(
        db,
        user.id,
        alarm.id,
    )
    if trigger_activity:
        trigger_metadata["status"] = "completed"
        trigger_activity.metadata_json = json.dumps(trigger_metadata)

    activity = Activity(
        user_id=user.id,
        alarm_id=alarm.id,
        activity_type="complete",
        value=1
    )
    activity.metadata_json = json.dumps({"session_id": session_id})

    db.add(activity)
    db.flush()

    record_alarm_performance(
        db,
        user,
        alarm,
        session_id,
        activity,
        trigger_activity,
    )
    generate_recommendations(db, user)

    db.refresh(alarm)

    return alarm