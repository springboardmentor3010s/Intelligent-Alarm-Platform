from datetime import datetime

from ..models.activity import Activity
from ..models.alarm_performance import AlarmPerformance
from ..models.challenge import Challenge
from ..models.challenge_attempt import ChallengeAttempt
from ..models.notification import Notification
from ..models.recommendation import Recommendation


def record_alarm_performance(db, user, alarm, session_id, activity, trigger_activity):
    questions = []
    if session_id:
        questions = (
            db.query(Challenge)
            .filter(
                Challenge.user_id == user.id,
                Challenge.alarm_id == alarm.id,
                Challenge.session_id == session_id,
            )
            .order_by(Challenge.question_number.asc())
            .all()
        )

    question_ids = [question.id for question in questions]
    successful_attempts = (
        db.query(ChallengeAttempt)
        .filter(
            ChallengeAttempt.user_id == user.id,
            ChallengeAttempt.challenge_id.in_(question_ids),
            ChallengeAttempt.is_completed.is_(True),
        )
        .all()
        if question_ids
        else []
    )
    response_times = [attempt.response_time for attempt in successful_attempts]
    if not response_times:
        response_times = [
            question.response_time
            for question in questions
            if question.user_answer is not None and question.response_time is not None
        ]

    correct_answers = sum(question.is_correct is True for question in questions)
    total_questions = len(questions)
    session_difficulty = questions[0].difficulty if questions else alarm.difficulty
    session_challenge_type = (
        questions[0].challenge_type if questions else alarm.challenge_type
    )
    accuracy_pct = (
        round(correct_answers * 100 / total_questions, 1)
        if total_questions
        else None
    )
    average_response_time = (
        round(sum(response_times) / len(response_times), 1)
        if response_times
        else None
    )

    snooze_count = None
    if trigger_activity and trigger_activity.created_at:
        snooze_count = (
            db.query(Activity)
            .filter(
                Activity.user_id == user.id,
                Activity.alarm_id == alarm.id,
                Activity.activity_type == "snooze",
                Activity.created_at > trigger_activity.created_at,
                Activity.created_at <= activity.created_at,
            )
            .count()
        )

    if accuracy_pct is not None and accuracy_pct < 60:
        reason = (
            f"This session recorded {correct_answers} correct answers out of "
            f"{total_questions} ({accuracy_pct}% accuracy) at "
            f"{session_difficulty} difficulty."
        )
        action = (
            "Use an easier challenge level next time and focus on answering "
            "accurately before increasing speed."
        )
        priority = "high"
    elif accuracy_pct is not None and average_response_time is not None and average_response_time > 40:
        reason = (
            f"You answered {correct_answers} of {total_questions} questions correctly "
            f"({accuracy_pct}% accuracy), with an average response time of "
            f"{average_response_time} seconds."
        )
        action = (
            "Keep the current challenge level and work toward answering each "
            "question within 40 seconds."
        )
        priority = "medium"
    elif accuracy_pct is not None:
        reason = (
            f"You answered {correct_answers} of {total_questions} questions correctly "
            f"({accuracy_pct}% accuracy)"
            + (
                f" with an average response time of {average_response_time} seconds."
                if average_response_time is not None
                else f" at {session_difficulty} difficulty."
            )
        )
        action = (
            f"Keep completing the {session_difficulty} {session_challenge_type} challenge "
            "to build a consistent performance trend."
        )
        priority = "low"
    elif snooze_count:
        reason = (
            f"You completed this alarm after {snooze_count} recorded snooze(s); "
            "no cognitive challenge answers were recorded for this completion."
        )
        action = (
            "Try completing the next alarm without snoozing, and use a cognitive "
            "challenge to track answer accuracy and response time."
        )
        priority = "medium"
    else:
        reason = (
            "This alarm completion was recorded, but no cognitive challenge answers "
            "were available to assess accuracy or response time."
        )
        action = (
            "Complete a cognitive challenge with your next alarm to build a "
            "measurable performance history."
        )
        priority = "low"

    completed_at = activity.created_at or datetime.utcnow()
    title = f"After-alarm coaching #{activity.id}"
    supporting_metric = (
        f"Accuracy: {accuracy_pct}% ({correct_answers}/{total_questions}); "
        f"average response: "
        f"{f'{average_response_time}s' if average_response_time is not None else 'not measured'}; "
        f"snoozes in this alarm cycle: "
        f"{snooze_count if snooze_count is not None else 'not available'}."
    )
    recommendation = Recommendation(
        user_id=user.id,
        title=title,
        reason=reason,
        suggested_action=action,
        supporting_metric=supporting_metric,
        category="post_alarm_performance",
        priority=priority,
    )
    db.add(recommendation)
    db.flush()

    performance = AlarmPerformance(
        user_id=user.id,
        alarm_id=alarm.id,
        completion_activity_id=activity.id,
        session_id=session_id,
        alarm_title=alarm.title,
        challenge_type=session_challenge_type if questions else None,
        difficulty=session_difficulty,
        total_questions=total_questions,
        correct_answers=correct_answers,
        accuracy_pct=accuracy_pct,
        average_response_time_seconds=average_response_time,
        snoozes_before_completion=snooze_count,
        challenge_completed=bool(questions) and all(
            question.is_completed for question in questions
        ),
        completed_at=completed_at,
        recommendation_id=recommendation.id,
        recommendation_title=title,
        recommendation_reason=reason,
        suggested_action=action,
        recommendation_priority=priority,
    )
    db.add(performance)
    db.add(
        Notification(
            user_id=user.id,
            title="Your alarm performance is ready",
            message=f"{reason} Suggested next step: {action}",
            notification_type="progress_notification",
        )
    )
    db.flush()
    return performance
