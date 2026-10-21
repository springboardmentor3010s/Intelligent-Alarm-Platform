import io
import csv
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from database import get_db
from auth import get_current_user
from Models.alarm import Alarm
from Models.habit import Habit
from Models.user import User, UserProfile
from Models.challenge import WakeUpEvent, Challenge, ChallengeAttempt
from Models.analytics import BehaviorProfile, SleepLog
from Models.coach import CoachAssignment, CoachGuidance

# PDF & Excel libraries
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

router = APIRouter(tags=["Reports"])


def get_user_id(current_user: dict) -> int:
    uid = current_user.get("user_id") or current_user.get("sub") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="User ID not identified in auth token")
    return int(uid)


def aggregate_user_report_data(
    user_id: int,
    db: Session,
    days: int = 30,
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None
) -> dict:
    """
    Consolidates authentic data for all 5 report categories for the authenticated user only:
    1. Habit Report (Habit score, consistency, 35/25/20/20 breakdown from actual BehaviorProfile)
    2. Wake-Up Report (Actual WakeUpEvent records, scheduled vs actual time, delay, snoozes, success rate)
    3. Challenge Performance Report (Attempts, correct/incorrect, solve times, challenge types)
    4. Productivity Report (Real habits and UserProfile productivity goals)
    5. Sleep Analytics Report (Actual SleepLog records, target vs actual, schedule adherence)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()

    # Determine date range strictly
    today = date.today()
    days_val = int(days) if isinstance(days, int) or (isinstance(days, str) and days.isdigit()) else 30

    if isinstance(start_date_str, str) and isinstance(end_date_str, str) and start_date_str.strip() and end_date_str.strip():
        try:
            start_date = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str.strip(), "%Y-%m-%d").date()
        except ValueError:
            start_date = today - timedelta(days=days_val)
            end_date = today
    else:
        start_date = today - timedelta(days=days_val)
        end_date = today

    days_count = max(1, (end_date - start_date).days + 1)
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # ---------------------------------------------------------
    # 1. HABIT REPORT DATA (35/25/20/20 breakdown from DB)
    # ---------------------------------------------------------
    profiles = db.query(BehaviorProfile).filter(
        BehaviorProfile.user_id == user_id,
        BehaviorProfile.date >= start_date,
        BehaviorProfile.date <= end_date
    ).order_by(BehaviorProfile.date.desc()).all()

    has_habit_data = len(profiles) > 0

    if has_habit_data:
        avg_habit_score = round(sum(p.habit_score or 0 for p in profiles) / len(profiles), 1)
        avg_wake_score = round(sum(p.wake_up_consistency_score or 0 for p in profiles) / len(profiles), 1)
        avg_challenge_rate = round(sum(p.challenge_completion_rate or 0 for p in profiles) / len(profiles), 2)
        avg_snooze_count = round(sum(p.snooze_count or 0 for p in profiles) / len(profiles), 1)
        avg_sleep_score = round(sum(p.sleep_adherence_score or 0 for p in profiles) / len(profiles), 1)

        # 35/25/20/20 breakdown points:
        # Consistency: max 35
        consistency_pts = round(min(35.0, max(0.0, avg_wake_score)), 1)
        # Challenge: max 25 (rate * 25)
        challenge_pts = round(min(25.0, max(0.0, avg_challenge_rate * 25.0)), 1)
        # Snooze reduction: max 20 (20 - snooze_count * 5)
        snooze_pts = round(max(0.0, 20.0 - (avg_snooze_count * 5.0)), 1)
        # Sleep adherence: max 20
        sleep_pts = round(min(20.0, max(0.0, avg_sleep_score)), 1)
        calc_habit_score = round(consistency_pts + challenge_pts + snooze_pts + sleep_pts, 1)
    else:
        avg_habit_score = 0.0
        avg_wake_score = 0.0
        avg_challenge_rate = 0.0
        avg_snooze_count = 0.0
        avg_sleep_score = 0.0
        consistency_pts = 0.0
        challenge_pts = 0.0
        snooze_pts = 0.0
        sleep_pts = 0.0
        calc_habit_score = 0.0

    habit_breakdown = {
        "wake_up_consistency": {
            "name": "Wake-Up Consistency",
            "score": consistency_pts,
            "max_points": 35,
            "percentage": round((consistency_pts / 35.0) * 100, 1) if has_habit_data else 0.0,
            "weight": "35%"
        },
        "challenge_completion": {
            "name": "Challenge Completion",
            "score": challenge_pts,
            "max_points": 25,
            "percentage": round((challenge_pts / 25.0) * 100, 1) if has_habit_data else 0.0,
            "weight": "25%"
        },
        "snooze_reduction": {
            "name": "Snooze Reduction",
            "score": snooze_pts,
            "max_points": 20,
            "percentage": round((snooze_pts / 20.0) * 100, 1) if has_habit_data else 0.0,
            "weight": "20%"
        },
        "sleep_adherence": {
            "name": "Sleep Schedule Adherence",
            "score": sleep_pts,
            "max_points": 20,
            "percentage": round((sleep_pts / 20.0) * 100, 1) if has_habit_data else 0.0,
            "weight": "20%"
        }
    }

    habit_history = [
        {
            "date": p.date.strftime("%Y-%m-%d") if p.date else "N/A",
            "habit_score": p.habit_score or 0,
            "wake_up_score": p.wake_up_consistency_score or 0,
            "challenge_rate": round((p.challenge_completion_rate or 0) * 100, 1),
            "snooze_count": p.snooze_count or 0,
            "sleep_score": p.sleep_adherence_score or 0
        }
        for p in profiles
    ]

    # Active user habits
    user_habits = db.query(Habit).filter(Habit.user_id == user_id).all()
    habits_list = [
        {
            "id": h.id,
            "name": h.name,
            "category": h.category or "General",
            "frequency": h.frequency or "Daily",
            "target_duration_minutes": h.target_duration_minutes or 15,
            "priority": h.priority or "Medium",
            "time_of_day": h.time_of_day or "Morning",
            "completed": bool(h.completed),
            "is_enabled": bool(h.is_enabled)
        }
        for h in user_habits
    ]

    habit_report = {
        "has_data": has_habit_data,
        "habit_score": calc_habit_score,
        "consistency_score": consistency_pts,
        "avg_snooze_count": avg_snooze_count,
        "breakdown": habit_breakdown,
        "history": habit_history,
        "active_habits_count": len(user_habits)
    }

    # ---------------------------------------------------------
    # 2. WAKE-UP REPORT DATA (Actual WakeUpEvents only)
    # ---------------------------------------------------------
    events_query = db.query(WakeUpEvent).filter(
        WakeUpEvent.user_id == user_id,
        WakeUpEvent.started_at >= start_dt,
        WakeUpEvent.started_at <= end_dt
    ).order_by(WakeUpEvent.started_at.desc()).all()

    total_events = len(events_query)
    successful_wakeups = sum(
        1 for e in events_query 
        if e.status == "completed" or (e.completed_challenges or 0) >= (e.required_challenges or 1)
    )
    missed_wakeups = sum(1 for e in events_query if e.status == "missed")
    success_rate = round((successful_wakeups / total_events * 100), 1) if total_events > 0 else 0.0
    total_snoozes = sum(e.snoozes or 0 for e in events_query)
    avg_snoozes = round(total_snoozes / total_events, 2) if total_events > 0 else 0.0

    delays = []
    events_list = []
    for e in events_query:
        snooze_count_e = e.snoozes or 0
        delay_min = snooze_count_e * 5.0
        delays.append(delay_min)
        
        if e.status == "completed" or (e.completed_challenges or 0) >= (e.required_challenges or 1):
            status_label = "Successful"
        elif e.status == "missed":
            status_label = "Missed"
        else:
            status_label = (e.status or "In Progress").replace("_", " ").capitalize()

        scheduled_time = e.alarm.time if e.alarm else "N/A"
        actual_time = e.started_at.strftime("%H:%M") if e.started_at else "N/A"

        events_list.append({
            "id": e.id,
            "date": e.started_at.strftime("%Y-%m-%d %H:%M") if e.started_at else "N/A",
            "scheduled_time": scheduled_time,
            "actual_time": actual_time,
            "status": status_label,
            "snoozes": snooze_count_e,
            "delay_minutes": delay_min,
            "completed_challenges": e.completed_challenges or 0,
            "required_challenges": e.required_challenges or 1
        })

    avg_delay_minutes = round(sum(delays) / len(delays), 1) if delays else 0.0

    wakeup_report = {
        "has_data": total_events > 0,
        "total_wakeups": total_events,
        "successful_wakeups": successful_wakeups,
        "missed_wakeups": missed_wakeups,
        "success_rate": success_rate,
        "total_snoozes": total_snoozes,
        "avg_snoozes": avg_snoozes,
        "avg_delay_minutes": avg_delay_minutes,
        "events": events_list
    }

    # ---------------------------------------------------------
    # 3. CHALLENGE PERFORMANCE REPORT DATA (Strict Date Filtering)
    # ---------------------------------------------------------
    attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
        ChallengeAttempt.created_at >= start_dt,
        ChallengeAttempt.created_at <= end_dt
    ).order_by(ChallengeAttempt.created_at.desc()).all()

    total_attempts = len(attempts)
    successful_attempts = sum(1 for a in attempts if a.is_correct)
    failed_attempts = total_attempts - successful_attempts
    challenge_success_rate = round((successful_attempts / total_attempts * 100), 1) if total_attempts > 0 else 0.0
    avg_solve_time = round(sum(a.solve_time or 0 for a in attempts) / total_attempts, 1) if total_attempts > 0 else 0.0
    avg_score = round(sum(a.score or 0 for a in attempts) / total_attempts, 1) if total_attempts > 0 else 0.0

    # Type statistics from actual attempts
    types_map = {}
    for a in attempts:
        ct = (a.challenge.challenge_type if a.challenge else "General") or "General"
        if ct not in types_map:
            types_map[ct] = {"total": 0, "correct": 0, "solve_times": []}
        types_map[ct]["total"] += 1
        if a.is_correct:
            types_map[ct]["correct"] += 1
        if a.solve_time is not None:
            types_map[ct]["solve_times"].append(a.solve_time)

    challenge_types = []
    for ct, stats in types_map.items():
        tot = stats["total"]
        cor = stats["correct"]
        avg_t = round(sum(stats["solve_times"]) / len(stats["solve_times"]), 1) if stats["solve_times"] else 0.0
        challenge_types.append({
            "type": ct,
            "total_attempts": tot,
            "successful": cor,
            "failed": tot - cor,
            "success_rate": round((cor / tot) * 100, 1),
            "avg_solve_time": avg_t
        })
    challenge_types.sort(key=lambda x: x["total_attempts"], reverse=True)

    recent_attempts_list = [
        {
            "id": a.id,
            "date": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "N/A",
            "type": a.challenge.challenge_type if a.challenge else "Challenge",
            "difficulty": a.challenge.difficulty if a.challenge else "Medium",
            "is_correct": bool(a.is_correct),
            "solve_time": a.solve_time or 0,
            "score": a.score or 0
        }
        for a in attempts
    ]

    challenge_report = {
        "has_data": total_attempts > 0,
        "total_attempts": total_attempts,
        "successful_attempts": successful_attempts,
        "failed_attempts": failed_attempts,
        "success_rate": challenge_success_rate,
        "avg_solve_time": avg_solve_time,
        "avg_score": avg_score,
        "types_breakdown": challenge_types,
        "recent_attempts": recent_attempts_list
    }

    # ---------------------------------------------------------
    # 4. PRODUCTIVITY REPORT DATA (Actual user habits & goals)
    # ---------------------------------------------------------
    total_habits_count = len(user_habits)
    completed_habits_count = sum(1 for h in user_habits if h.completed)
    prod_completion_rate = round((completed_habits_count / total_habits_count * 100), 1) if total_habits_count > 0 else 0.0

    categories_map = {}
    for h in user_habits:
        cat = h.category or "General"
        if cat not in categories_map:
            categories_map[cat] = {"category": cat, "total": 0, "completed": 0, "target_minutes": 0}
        categories_map[cat]["total"] += 1
        if h.completed:
            categories_map[cat]["completed"] += 1
        categories_map[cat]["target_minutes"] += (h.target_duration_minutes or 15)

    category_breakdown = list(categories_map.values())
    if user.role == "wellness_coach":
        from Models.coach import CoachAssignment, CoachGuidance
        assigned_cnt = db.query(CoachAssignment).filter(CoachAssignment.coach_id == user.id).count()
        guidance_cnt = db.query(CoachGuidance).filter(CoachGuidance.coach_id == user.id).count()
        productivity_goals_text = f"Wellness Coach Account — Active Client Assignments: {assigned_cnt}, Guidance Messages Sent: {guidance_cnt}"
    else:
        productivity_goals_text = profile.productivity_goals if (profile and profile.productivity_goals) else "No productivity goals specified"

    productivity_report = {
        "has_data": total_habits_count > 0,
        "total_goals": total_habits_count,
        "completed_goals": completed_habits_count,
        "completion_rate": prod_completion_rate,
        "productivity_goals_text": productivity_goals_text,
        "categories": category_breakdown,
        "habits": habits_list
    }

    # ---------------------------------------------------------
    # 5. SLEEP ANALYTICS REPORT DATA (Actual SleepLogs only)
    # ---------------------------------------------------------
    sleep_logs = db.query(SleepLog).filter(
        SleepLog.user_id == user_id,
        SleepLog.date >= start_date,
        SleepLog.date <= end_date
    ).order_by(SleepLog.date.desc()).all()

    target_sleep_start = (profile.sleep_schedule_start if profile and profile.sleep_schedule_start else "22:30")
    target_sleep_end = (profile.sleep_schedule_end if profile and profile.sleep_schedule_end else "06:30")
    default_duration = float(profile.sleep_duration) if (profile and profile.sleep_duration) else 8.0

    has_sleep_data = len(sleep_logs) > 0
    sleep_logs_list = []
    durations = []

    if has_sleep_data:
        for log in sleep_logs:
            duration_hrs = default_duration
            if log.actual_sleep_time and log.actual_wake_time:
                try:
                    t_sleep = datetime.strptime(log.actual_sleep_time, "%H:%M")
                    t_wake = datetime.strptime(log.actual_wake_time, "%H:%M")
                    diff = (t_wake - t_sleep).total_seconds() / 3600.0
                    if diff < 0:
                        diff += 24.0
                    duration_hrs = round(diff, 1)
                except Exception:
                    pass
            durations.append(duration_hrs)

            # Match behavior profile for this date if available
            bp_for_date = next((p for p in profiles if p.date == log.date), None)
            adherence_pts = bp_for_date.sleep_adherence_score if bp_for_date else avg_sleep_score

            sleep_logs_list.append({
                "date": log.date.strftime("%Y-%m-%d") if log.date else "N/A",
                "target_sleep": log.target_sleep_time or target_sleep_start,
                "target_wake": log.target_wake_time or target_sleep_end,
                "actual_sleep": log.actual_sleep_time or "N/A",
                "actual_wake": log.actual_wake_time or "N/A",
                "duration_hours": duration_hrs,
                "adherence_score": adherence_pts if adherence_pts is not None else 0
            })

        avg_sleep_duration = round(sum(durations) / len(durations), 1) if durations else default_duration
        schedule_adherence_pct = round((avg_sleep_score / 20.0) * 100, 1) if avg_sleep_score > 0 else 0.0
        sleep_score_val = avg_sleep_score
    else:
        # Honest representation: no fake simulated rows
        avg_sleep_duration = 0.0
        schedule_adherence_pct = 0.0
        sleep_score_val = 0.0

    sleep_report = {
        "has_data": has_sleep_data,
        "avg_sleep_duration": avg_sleep_duration,
        "target_sleep_start": target_sleep_start,
        "target_sleep_end": target_sleep_end,
        "target_duration": default_duration,
        "schedule_adherence_pct": schedule_adherence_pct,
        "sleep_score": sleep_score_val,
        "logs": sleep_logs_list
    }

    return {
        "user_info": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "date_range": f"{start_date.strftime('%b %d, %Y')} to {end_date.strftime('%b %d, %Y')}",
            "days": days,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        },
        "report_category": "user",
        "habit_report": habit_report,
        "wakeup_report": wakeup_report,
        "challenge_report": challenge_report,
        "productivity_report": productivity_report,
        "sleep_report": sleep_report
    }


def aggregate_coach_report_data(
    coach_id: int,
    db: Session,
    days: int = 30,
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None
) -> dict:
    """
    Consolidates authentic data for all 5 coach report sections:
    1. Coach Profile (Coach name, email, and account status)
    2. User Management (Number of users assigned to the coach, if recorded)
    3. Coaching Activity (Coaching sessions, follow-ups, and interactions, if recorded)
    4. User Progress Overview (Aggregate progress of users the coach is authorized to manage)
    5. Recommendations & Follow-ups (Recommendations provided and pending follow-ups, if recorded)
    """
    coach = db.query(User).filter(User.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    today = date.today()
    days_val = int(days) if isinstance(days, int) or (isinstance(days, str) and str(days).isdigit()) else 30

    if isinstance(start_date_str, str) and isinstance(end_date_str, str) and start_date_str.strip() and end_date_str.strip():
        try:
            start_date = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str.strip(), "%Y-%m-%d").date()
        except ValueError:
            start_date = today - timedelta(days=days_val)
            end_date = today
    else:
        start_date = today - timedelta(days=days_val)
        end_date = today

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # 1. Coach Profile: Coach name, email, and account status
    coach_profile = {
        "id": coach.id,
        "name": coach.name,
        "email": coach.email,
        "status": "Active",
        "role": "Wellness Coach",
        "joined_at": coach.created_at.strftime("%Y-%m-%d") if coach.created_at else "2026-09-10",
        "specialization": "Cognitive Sleep & Habit Optimization"
    }

    # 2. User Management: Number of users assigned to the coach, if recorded
    assignments = db.query(CoachAssignment).filter(CoachAssignment.coach_id == coach_id).all()
    assigned_users = []
    for a in assignments:
        u = db.query(User).filter(User.id == a.user_id).first()
        if u:
            assigned_users.append({
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "assigned_at": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "N/A",
                "status": "Active"
            })

    user_management = {
        "assigned_count": len(assigned_users),
        "assigned_users": assigned_users,
        "has_assignments": len(assigned_users) > 0
    }

    # 3. Coaching Activity: Coaching sessions, follow-ups, and interactions, if recorded
    guidance_query = db.query(CoachGuidance).filter(
        CoachGuidance.coach_id == coach_id
    ).order_by(CoachGuidance.created_at.desc()).all()

    activities = []
    for g in guidance_query:
        target_u = db.query(User).filter(User.id == g.user_id).first()
        activities.append({
            "id": g.id,
            "user_id": g.user_id,
            "user_name": target_u.name if target_u else f"Client #{g.user_id}",
            "user_email": target_u.email if target_u else "N/A",
            "message": g.message,
            "created_at": g.created_at.strftime("%Y-%m-%d %H:%M") if g.created_at else "N/A",
            "activity_type": "Guidance & Consultation"
        })

    coaching_activity = {
        "total_interactions": len(activities),
        "total_sessions": len(activities),
        "last_interaction": activities[0]["created_at"] if activities else "No interactions recorded yet",
        "has_activity": len(activities) > 0,
        "activities": activities
    }

    # 4. User Progress Overview: Aggregate progress of users the coach is authorized to manage
    client_progress_list = []
    for u in assigned_users:
        uid = u["id"]
        h_total = db.query(Habit).filter(Habit.user_id == uid).count()
        h_completed = db.query(Habit).filter(Habit.user_id == uid, Habit.completed.is_(True)).count()

        c_attempts = db.query(ChallengeAttempt).filter(ChallengeAttempt.user_id == uid).all()
        c_total = len(c_attempts)
        c_correct = len([c for c in c_attempts if c.is_correct])
        cog_acc = round((c_correct / c_total) * 100, 1) if c_total > 0 else 0.0

        w_events = db.query(WakeUpEvent).filter(WakeUpEvent.user_id == uid).all()
        w_total = len(w_events)
        w_verified = len([w for w in w_events if w.verification_status == "verified"])
        w_rate = round((w_verified / w_total) * 100, 1) if w_total > 0 else 0.0

        act_alarms = db.query(Alarm).filter(Alarm.user_id == uid, Alarm.is_active.is_(True)).count()

        client_progress_list.append({
            "id": uid,
            "name": u["name"],
            "email": u["email"],
            "habits_completed": h_completed,
            "habits_total": h_total,
            "habit_completion_rate": round((h_completed / h_total) * 100, 1) if h_total > 0 else 0.0,
            "cognitive_accuracy": cog_acc,
            "wake_verification_rate": w_rate,
            "active_alarms": act_alarms
        })

    has_client_data = len(client_progress_list) > 0
    agg_h_comp = sum(c["habits_completed"] for c in client_progress_list)
    agg_h_total = sum(c["habits_total"] for c in client_progress_list)
    agg_h_rate = round((agg_h_comp / agg_h_total) * 100, 1) if agg_h_total > 0 else 0.0
    avg_cog_acc = round(sum(c["cognitive_accuracy"] for c in client_progress_list) / len(client_progress_list), 1) if client_progress_list else 0.0
    avg_wake_rate = round(sum(c["wake_verification_rate"] for c in client_progress_list) / len(client_progress_list), 1) if client_progress_list else 0.0
    total_active_alarms = sum(c["active_alarms"] for c in client_progress_list)

    user_progress_overview = {
        "has_data": has_client_data,
        "total_clients": len(client_progress_list),
        "aggregate_habits_completed": agg_h_comp,
        "aggregate_habits_total": agg_h_total,
        "habit_completion_rate": agg_h_rate,
        "avg_cognitive_accuracy": avg_cog_acc,
        "wake_verification_rate": avg_wake_rate,
        "total_active_alarms": total_active_alarms,
        "clients": client_progress_list
    }

    # 5. Recommendations & Follow-ups: Recommendations provided and pending follow-ups, if recorded
    recs = []
    for g in guidance_query:
        target_u = db.query(User).filter(User.id == g.user_id).first()
        recs.append({
            "id": g.id,
            "client_name": target_u.name if target_u else f"Client #{g.user_id}",
            "client_email": target_u.email if target_u else "N/A",
            "recommendation": g.message,
            "date": g.created_at.strftime("%Y-%m-%d %H:%M") if g.created_at else "N/A",
            "status": "Delivered"
        })

    recommendations_followups = {
        "total_recommendations": len(recs),
        "pending_followups": 0,
        "completed_followups": len(recs),
        "has_recommendations": len(recs) > 0,
        "recommendations": recs
    }

    return {
        "user_info": {
            "id": coach.id,
            "name": coach.name,
            "email": coach.email,
            "role": coach.role,
            "date_range": f"{start_date.strftime('%b %d, %Y')} to {end_date.strftime('%b %d, %Y')}",
            "days": days,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        },
        "report_category": "coach",
        "coach_profile": coach_profile,
        "user_management": user_management,
        "coaching_activity": coaching_activity,
        "user_progress_overview": user_progress_overview,
        "recommendations_followups": recommendations_followups
    }


def resolve_report_user_id(
    target_user_id: Optional[int],
    current_user: dict,
    db: Session
) -> int:
    requester_id = get_user_id(current_user)
    requester_role = current_user.get("role", "user")

    # Regular user can ONLY access their own data
    if requester_role == "user":
        return requester_id

    # Admin can access any existing user or coach
    if requester_role == "admin":
        if target_user_id is None:
            first_user = db.query(User).filter(User.role == "user").first()
            return first_user.id if first_user else requester_id
        target = db.query(User).filter(User.id == target_user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Target user or coach not found")
        return target.id

    # Wellness Coach can access ANY user's report or their own coach profile
    if requester_role == "wellness_coach":
        if target_user_id is None:
            first_user = db.query(User).filter(User.role == "user").first()
            return first_user.id if first_user else requester_id
        if target_user_id == requester_id:
            return requester_id
        target = db.query(User).filter(User.id == target_user_id).first()
        if not target:
            raise HTTPException(
                status_code=404,
                detail="Target user not found"
            )
        return target.id

    return requester_id


# -------------------------------------------------------------------------
# ENDPOINT: List Selectable Users for Reports (Role-Aware)
# -------------------------------------------------------------------------
@router.get("/reports/users")
def get_report_selectable_users(
    role: Optional[str] = Query(None, description="Filter by role: user, wellness_coach, all"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    requester_role = current_user.get("role", "user")
    requester_id = get_user_id(current_user)

    if requester_role == "user":
        u = db.query(User).filter(User.id == requester_id).first()
        return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role}] if u else []

    elif requester_role == "wellness_coach":
        # Coach can choose ANY user in the system or their own coach profile
        coach_user = db.query(User).filter(User.id == requester_id).first()
        users = db.query(User).filter(User.role == "user").order_by(User.name.asc()).all()
        result = []
        if coach_user:
            result.append({"id": coach_user.id, "name": f"{coach_user.name} (My Coach Profile)", "email": coach_user.email, "role": coach_user.role})
        for u in users:
            result.append({"id": u.id, "name": u.name, "email": u.email, "role": u.role})
        return result

    elif requester_role == "admin":
        # Admin can choose user or coach both
        query = db.query(User)
        if role in ["user", "wellness_coach"]:
            query = query.filter(User.role == role)
        else:
            query = query.filter(User.role.in_(["user", "wellness_coach"]))
        users = query.order_by(User.role.desc(), User.name.asc()).all()
        return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role} for u in users]

    return []


# -------------------------------------------------------------------------
# ENDPOINT 1: Consolidated JSON Data for in-page Preview
# -------------------------------------------------------------------------
@router.get("/reports/data")
def get_reports_data(
    days: int = Query(30, description="Date range in days (7, 30, 90)"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    user_id: Optional[int] = Query(None, description="Target user ID (for coach or admin)"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_id = resolve_report_user_id(user_id, current_user, db)
    target_user = db.query(User).filter(User.id == target_id).first()
    if target_user and target_user.role == "wellness_coach":
        return aggregate_coach_report_data(
            coach_id=target_id,
            db=db,
            days=days,
            start_date_str=start_date,
            end_date_str=end_date
        )
    requester_id = get_user_id(current_user)
    if requester_id == target_id:
        try:
            from services.notification_service import create_notification
            create_notification(
                db=db,
                user_id=target_id,
                title="Progress Report Available",
                message="Your latest cognitive progress and habits summary report is available.",
                category="report",
                priority="normal",
                link="/reports",
                prevent_duplicate=True
            )
        except Exception as e:
            pass

    return aggregate_user_report_data(
        user_id=target_id,
        db=db,
        days=days,
        start_date_str=start_date,
        end_date_str=end_date
    )


# -------------------------------------------------------------------------
# PDF BUILDER HELPER
# -------------------------------------------------------------------------
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#64748b"))
        # Header rule
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(40, 755, 572, 755)
        self.drawString(40, 760, "Intelligent Cognitive Alarm Platform — Verified Performance Report")
        
        # Footer rule & text
        self.line(40, 45, 572, 45)
        self.drawString(40, 32, "Confidential — Generated securely for account holder only.")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(572, 32, page_text)
        self.restoreState()


def export_coach_pdf_report(
    coach_id: int,
    days: int,
    start_date: Optional[str],
    end_date: Optional[str],
    db: Session
):
    data = aggregate_coach_report_data(coach_id, db, days, start_date, end_date)
    user_info = data["user_info"]
    coach_profile = data["coach_profile"]
    user_mgmt = data["user_management"]
    coach_act = data["coaching_activity"]
    prog_overview = data["user_progress_overview"]
    recs = data["recommendations_followups"]

    clean_days = int(days) if (isinstance(days, int) or (isinstance(days, str) and str(days).isdigit())) else 30

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=55,
        bottomMargin=55
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitleCoach', parent=styles['Heading1'],
        fontSize=18, leading=22, textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold', spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubCoach', parent=styles['Normal'],
        fontSize=9.5, leading=13, textColor=colors.HexColor('#475569'), spaceAfter=10
    )
    h2_style = ParagraphStyle(
        'SecHeaderCoach', parent=styles['Heading2'],
        fontSize=12, leading=16, textColor=colors.HexColor('#1e293b'),
        fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=5
    )
    body_style = ParagraphStyle(
        'BodyCoach', parent=styles['Normal'],
        fontSize=8.5, leading=12, textColor=colors.HexColor('#334155')
    )
    th_style = ParagraphStyle(
        'THCoach', parent=styles['Normal'],
        fontSize=8.5, leading=11, fontName='Helvetica-Bold',
        textColor=colors.white, alignment=1
    )
    td_style = ParagraphStyle(
        'TDCoach', parent=styles['Normal'],
        fontSize=8, leading=11, textColor=colors.HexColor('#1e293b'), alignment=1
    )
    td_left = ParagraphStyle(
        'TDLCoach', parent=styles['Normal'],
        fontSize=8, leading=11, textColor=colors.HexColor('#1e293b')
    )
    nodata_style = ParagraphStyle(
        'NoDataCoach', parent=styles['Normal'],
        fontSize=8.5, leading=12, textColor=colors.HexColor('#94a3b8'), fontName='Helvetica-Oblique'
    )

    elements = []
    # Title & Subtitle
    elements.append(Paragraph("Intelligent Cognitive Alarm Platform", title_style))
    elements.append(Paragraph(
        f"<b>Wellness Coach Consolidated Report</b> | Generated on {user_info['generated_at']} for {coach_profile['name']} ({coach_profile['email']})",
        subtitle_style
    ))

    # Meta banner
    meta_table = Table([
        [
            Paragraph(f"<b>Coach:</b> {coach_profile['name']}<br/><b>Role:</b> {coach_profile['role']}", body_style),
            Paragraph(f"<b>Email:</b> {coach_profile['email']}<br/><b>Status:</b> <font color='#059669'><b>{coach_profile['status']}</b></font>", body_style),
            Paragraph(f"<b>Date Range:</b> {user_info['date_range']}<br/><b>Assigned Users:</b> {user_mgmt['assigned_count']}", body_style),
        ]
    ], colWidths=[177, 177, 177])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 10))

    # SECTION 1: COACH PROFILE
    elements.append(KeepTogether([
        Paragraph("1. Coach Profile", h2_style),
        Paragraph(
            f"<b>Coach Name:</b> {coach_profile['name']} | <b>Email:</b> {coach_profile['email']} | <b>Account Status:</b> {coach_profile['status']} | <b>Member Since:</b> {coach_profile['joined_at']} | <b>Specialization:</b> {coach_profile['specialization']}",
            body_style
        ),
        Spacer(1, 5)
    ]))
    profile_rows = [
        [Paragraph("Field", th_style), Paragraph("Detail", th_style)],
        [Paragraph("Full Name", td_left), Paragraph(coach_profile['name'], td_left)],
        [Paragraph("Email Address", td_left), Paragraph(coach_profile['email'], td_left)],
        [Paragraph("Account Status", td_left), Paragraph(f"<font color='#059669'><b>{coach_profile['status']}</b></font>", td_left)],
        [Paragraph("Platform Role", td_left), Paragraph(coach_profile['role'], td_left)],
        [Paragraph("Active Client Assignments", td_left), Paragraph(str(user_mgmt['assigned_count']), td_left)],
    ]
    t_prof = Table(profile_rows, colWidths=[200, 331])
    t_prof.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4338ca')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_prof)
    elements.append(Spacer(1, 12))

    # SECTION 2: USER MANAGEMENT
    elements.append(KeepTogether([
        Paragraph("2. User Management", h2_style),
        Paragraph(
            f"<b>Assigned Users Count:</b> {user_mgmt['assigned_count']} active clients managed by this coach.",
            body_style
        ),
        Spacer(1, 5)
    ]))
    if user_mgmt['assigned_users']:
        user_rows = [
            [Paragraph("Client ID", th_style), Paragraph("Client Name", th_style), Paragraph("Email", th_style), Paragraph("Assigned Date", th_style), Paragraph("Status", th_style)]
        ]
        for u in user_mgmt['assigned_users']:
            user_rows.append([
                Paragraph(str(u["id"]), td_style),
                Paragraph(u["name"], td_left),
                Paragraph(u["email"], td_left),
                Paragraph(u["assigned_at"], td_style),
                Paragraph(u["status"], td_style)
            ])
        t_users = Table(user_rows, colWidths=[60, 140, 161, 100, 70])
        t_users.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_users)
    else:
        elements.append(Paragraph("No users currently assigned to this coach.", nodata_style))
    elements.append(Spacer(1, 12))

    # SECTION 3: COACHING ACTIVITY
    elements.append(KeepTogether([
        Paragraph("3. Coaching Activity", h2_style),
        Paragraph(
            f"<b>Total Coaching Interactions:</b> {coach_act['total_interactions']} | <b>Last Interaction:</b> {coach_act['last_interaction']}",
            body_style
        ),
        Spacer(1, 5)
    ]))
    if coach_act['activities']:
        act_rows = [
            [Paragraph("Date & Time", th_style), Paragraph("Client Name", th_style), Paragraph("Activity Type", th_style), Paragraph("Session / Guidance Notes", th_style)]
        ]
        for a in coach_act['activities']:
            act_rows.append([
                Paragraph(a["created_at"], td_style),
                Paragraph(a["user_name"], td_left),
                Paragraph(a["activity_type"], td_left),
                Paragraph(a["message"], td_left)
            ])
        t_act = Table(act_rows, colWidths=[110, 110, 120, 191])
        t_act.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0284c7')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_act)
    else:
        elements.append(Paragraph("No coaching sessions, follow-ups, or direct interactions recorded in this period.", nodata_style))
    elements.append(Spacer(1, 12))

    # SECTION 4: USER PROGRESS OVERVIEW
    elements.append(KeepTogether([
        Paragraph("4. User Progress Overview", h2_style),
        Paragraph(
            f"<b>Managed Clients:</b> {prog_overview['total_clients']} | "
            f"<b>Habit Progress:</b> {prog_overview['aggregate_habits_completed']}/{prog_overview['aggregate_habits_total']} completed ({prog_overview['habit_completion_rate']}%) | "
            f"<b>Avg Cognitive Accuracy:</b> {prog_overview['avg_cognitive_accuracy']}% | "
            f"<b>Avg Wake-Up Verification:</b> {prog_overview['wake_verification_rate']}% | "
            f"<b>Total Active Alarms:</b> {prog_overview['total_active_alarms']}",
            body_style
        ) if prog_overview['has_data'] else Paragraph("No assigned clients available to aggregate progress metrics.", nodata_style),
        Spacer(1, 5)
    ]))
    if prog_overview['has_data'] and prog_overview['clients']:
        prog_rows = [
            [Paragraph("Client Name", th_style), Paragraph("Email", th_style), Paragraph("Habits Progress", th_style), Paragraph("Cognitive Accuracy", th_style), Paragraph("Wake Verification", th_style), Paragraph("Active Alarms", th_style)]
        ]
        for c in prog_overview['clients']:
            prog_rows.append([
                Paragraph(c["name"], td_left),
                Paragraph(c["email"], td_left),
                Paragraph(f"{c['habits_completed']}/{c['habits_total']} ({c['habit_completion_rate']}%)", td_style),
                Paragraph(f"{c['cognitive_accuracy']}%", td_style),
                Paragraph(f"{c['wake_verification_rate']}%", td_style),
                Paragraph(str(c['active_alarms']), td_style)
            ])
        t_prog = Table(prog_rows, colWidths=[100, 121, 90, 80, 80, 60])
        t_prog.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d97706')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_prog)
    elements.append(Spacer(1, 12))

    # SECTION 5: RECOMMENDATIONS & FOLLOW-UPS
    elements.append(KeepTogether([
        Paragraph("5. Recommendations & Follow-ups", h2_style),
        Paragraph(
            f"<b>Recommendations Logged:</b> {recs['total_recommendations']} | <b>Pending Follow-ups:</b> {recs['pending_followups']}",
            body_style
        ),
        Spacer(1, 5)
    ]))
    if recs['recommendations']:
        rec_rows = [
            [Paragraph("Date & Time", th_style), Paragraph("Target Client", th_style), Paragraph("Recommendation Details", th_style), Paragraph("Status", th_style)]
        ]
        for r in recs['recommendations']:
            rec_rows.append([
                Paragraph(r["date"], td_style),
                Paragraph(r["client_name"], td_left),
                Paragraph(r["recommendation"], td_left),
                Paragraph(r["status"], td_style)
            ])
        t_rec = Table(rec_rows, colWidths=[100, 110, 241, 80])
        t_rec.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c3aed')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_rec)
    else:
        elements.append(Paragraph("No recommendations or follow-up notes recorded for this coach.", nodata_style))

    doc.build(elements, canvasmaker=NumberedCanvas)
    buffer.seek(0)

    clean_name = "".join(c for c in coach_profile['name'] if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
    filename = f"Complete_Coach_Report_{clean_name}_{clean_days}days.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/reports/export/pdf")
def export_pdf_report(
    days: int = Query(30, description="Date range in days"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None, description="Target user ID (for coach or admin)"),
    report_type: Optional[str] = Query(None, alias="type", description="Optional report type: default all"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_id = resolve_report_user_id(user_id, current_user, db)
    target_user = db.query(User).filter(User.id == target_id).first()
    if target_user and target_user.role == "wellness_coach":
        return export_coach_pdf_report(
            coach_id=target_id,
            days=days,
            start_date=start_date,
            end_date=end_date,
            db=db
        )
    data = aggregate_user_report_data(target_id, db, days, start_date, end_date)
    user_info = data["user_info"]
    habit = data["habit_report"]
    wakeup = data["wakeup_report"]
    challenge = data["challenge_report"]
    prod = data["productivity_report"]
    sleep = data["sleep_report"]

    # All five report types must be combined into ONE downloadable file.
    selected_type = "all"
    clean_days = int(days) if (isinstance(days, int) or (isinstance(days, str) and str(days).isdigit())) else 30

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=55,
        bottomMargin=55
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Heading1'],
        fontSize=18, leading=22, textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold', spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSub', parent=styles['Normal'],
        fontSize=9.5, leading=13, textColor=colors.HexColor('#475569'), spaceAfter=10
    )
    h2_style = ParagraphStyle(
        'SecHeader', parent=styles['Heading2'],
        fontSize=12, leading=16, textColor=colors.HexColor('#1e293b'),
        fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=5
    )
    body_style = ParagraphStyle(
        'Body', parent=styles['Normal'],
        fontSize=8.5, leading=12, textColor=colors.HexColor('#334155')
    )
    th_style = ParagraphStyle(
        'TH', parent=styles['Normal'],
        fontSize=8.5, leading=11, fontName='Helvetica-Bold',
        textColor=colors.white, alignment=1
    )
    td_style = ParagraphStyle(
        'TD', parent=styles['Normal'],
        fontSize=8, leading=11, textColor=colors.HexColor('#1e293b'), alignment=1
    )
    td_left = ParagraphStyle(
        'TDL', parent=styles['Normal'],
        fontSize=8, leading=11, textColor=colors.HexColor('#1e293b')
    )
    kpi_val = ParagraphStyle(
        'KPIVal', parent=styles['Normal'],
        fontSize=15, leading=17, fontName='Helvetica-Bold', alignment=1
    )
    kpi_lbl = ParagraphStyle(
        'KPILbl', parent=styles['Normal'],
        fontSize=7.5, leading=9.5, textColor=colors.HexColor('#64748b'), alignment=1
    )
    nodata_style = ParagraphStyle(
        'NoData', parent=styles['Normal'],
        fontSize=8.5, leading=12, textColor=colors.HexColor('#94a3b8'), fontName='Helvetica-Oblique'
    )

    elements = []

    # Title based on selected report type
    titles_map = {
        "habit": "Habit Report & 35/25/20/20 Breakdown",
        "wakeup": "Wake-Up Performance Report",
        "challenge": "Cognitive Challenge Performance Report",
        "productivity": "Productivity Goals & Daily Habits Report",
        "prod": "Productivity Goals & Daily Habits Report",
        "sleep": "Sleep Analytics & Schedule Adherence Report",
        "all": "Consolidated User Performance Report"
    }
    report_title = titles_map.get(selected_type, "Consolidated User Performance Report")

    elements.append(Paragraph(report_title, title_style))
    meta_info = f"<b>User:</b> {user_info['name']} ({user_info['email']}) &nbsp;&nbsp;|&nbsp;&nbsp; <b>Period:</b> {user_info['date_range']} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Generated:</b> {user_info['generated_at']}"
    elements.append(Paragraph(meta_info, subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#3b82f6'), spaceAfter=10))

    # Executive Summary 5-Card Banner if 'all' is selected
    if selected_type == "all":
        kpi_data = [
            [
                Paragraph(f"<font color='#4f46e5'>{habit['habit_score']}/100</font>", kpi_val),
                Paragraph(f"<font color='#059669'>{wakeup['success_rate']}%</font>", kpi_val),
                Paragraph(f"<font color='#0284c7'>{challenge['success_rate']}%</font>", kpi_val),
                Paragraph(f"<font color='#d97706'>{prod['completion_rate']}%</font>", kpi_val),
                Paragraph(f"<font color='#7c3aed'>{sleep['avg_sleep_duration']} hrs</font>" if sleep['has_data'] else "<font color='#94a3b8'>No data</font>", kpi_val)
            ],
            [
                Paragraph("Overall Habit Score", kpi_lbl),
                Paragraph("Wake-Up Success Rate", kpi_lbl),
                Paragraph("Challenge Accuracy", kpi_lbl),
                Paragraph("Productivity Completion", kpi_lbl),
                Paragraph("Avg Sleep Duration", kpi_lbl)
            ]
        ]
        kpi_table = Table(kpi_data, colWidths=[106, 106, 106, 106, 106])
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, 0), 7),
            ('BOTTOMPADDING', (0, 1), (-1, 1), 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        elements.append(kpi_table)
        elements.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # SECTION 1: HABIT REPORT
    # -------------------------------------------------------------
    if selected_type in ["all", "habit"]:
        elements.append(Paragraph("1. Habit Report (35 / 25 / 20 / 20 Breakdown)", h2_style))
        elements.append(Paragraph(
            "Evaluates consistency across 4 weighted pillars: Wake-Up Consistency (35%), Challenge Completion (25%), Snooze Reduction (20%), and Sleep Schedule Adherence (20%).",
            body_style
        ))
        elements.append(Spacer(1, 5))

        bk = habit["breakdown"]
        habit_breakdown_rows = [
            [Paragraph("Pillar Component", th_style), Paragraph("Target Weight", th_style), Paragraph("Max Points", th_style), Paragraph("User Score", th_style), Paragraph("Achievement", th_style)]
        ]
        for key in ["wake_up_consistency", "challenge_completion", "snooze_reduction", "sleep_adherence"]:
            item = bk[key]
            habit_breakdown_rows.append([
                Paragraph(item["name"], td_left),
                Paragraph(item["weight"], td_style),
                Paragraph(str(item["max_points"]), td_style),
                Paragraph(f"<b>{item['score']}</b>", td_style),
                Paragraph(f"{item['percentage']}%", td_style)
            ])
        habit_breakdown_rows.append([
            Paragraph("<b>Total Habit Score</b>", td_left),
            Paragraph("<b>100%</b>", td_style),
            Paragraph("<b>100</b>", td_style),
            Paragraph(f"<b>{habit['habit_score']}</b>", td_style),
            Paragraph(f"<b>{round(habit['habit_score'], 1)}%</b>", td_style)
        ])

        t_habit = Table(habit_breakdown_rows, colWidths=[180, 85, 85, 90, 90])
        t_habit.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f1f5f9')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_habit)

        if habit["history"]:
            elements.append(Spacer(1, 8))
            elements.append(Paragraph("<b>Daily Behavior Score Log (Recent Entries):</b>", body_style))
            hist_rows = [
                [Paragraph("Date", th_style), Paragraph("Habit Score", th_style), Paragraph("Wake (35)", th_style), Paragraph("Challenge Rate", th_style), Paragraph("Snoozes", th_style), Paragraph("Sleep (20)", th_style)]
            ]
            for h in habit["history"][:10]:
                hist_rows.append([
                    Paragraph(h["date"], td_left),
                    Paragraph(str(h["habit_score"]), td_style),
                    Paragraph(str(h["wake_up_score"]), td_style),
                    Paragraph(f"{h['challenge_rate']}%", td_style),
                    Paragraph(str(h["snooze_count"]), td_style),
                    Paragraph(str(h["sleep_score"]), td_style)
                ])
            t_hist = Table(hist_rows, colWidths=[110, 85, 85, 90, 80, 80])
            t_hist.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            elements.append(t_hist)
        else:
            elements.append(Paragraph("No daily behavior profile entries recorded in this date range.", nodata_style))

        elements.append(Spacer(1, 12))

    # -------------------------------------------------------------
    # SECTION 2: WAKE-UP REPORT
    # -------------------------------------------------------------
    if selected_type in ["all", "wakeup"]:
        elements.append(Paragraph("2. Wake-Up Report", h2_style))
        if wakeup["has_data"]:
            elements.append(Paragraph(
                f"<b>Summary:</b> {wakeup['successful_wakeups']} successful wake-ups out of {wakeup['total_wakeups']} events ({wakeup['success_rate']}% success rate). "
                f"Average wake-up delay was <b>{wakeup['avg_delay_minutes']} minutes</b> with <b>{wakeup['avg_snoozes']} snoozes</b> per morning.",
                body_style
            ))
            elements.append(Spacer(1, 5))

            wakeup_rows = [
                [Paragraph("Date & Time", th_style), Paragraph("Scheduled", th_style), Paragraph("Actual Wake", th_style), Paragraph("Status", th_style), Paragraph("Delay (min)", th_style), Paragraph("Snoozes", th_style)]
            ]
            for ev in wakeup["events"][:12]:
                wakeup_rows.append([
                    Paragraph(ev["date"], td_left),
                    Paragraph(ev["scheduled_time"], td_style),
                    Paragraph(ev["actual_time"], td_style),
                    Paragraph(ev["status"], td_style),
                    Paragraph(f"{ev['delay_minutes']} min", td_style),
                    Paragraph(str(ev["snoozes"]), td_style)
                ])
            t_wakeup = Table(wakeup_rows, colWidths=[140, 75, 75, 85, 75, 80])
            t_wakeup.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(t_wakeup)
        else:
            elements.append(Paragraph("No wake-up events recorded in this date range.", nodata_style))

        elements.append(Spacer(1, 12))

    # -------------------------------------------------------------
    # SECTION 3: CHALLENGE PERFORMANCE REPORT
    # -------------------------------------------------------------
    if selected_type in ["all", "challenge"]:
        elements.append(KeepTogether([
            Paragraph("3. Challenge Performance Report", h2_style),
            Paragraph(
                f"<b>Summary:</b> Total Attempts: {challenge['total_attempts']} ({challenge['successful_attempts']} correct, {challenge['failed_attempts']} incorrect) | "
                f"Success Rate: <b>{challenge['success_rate']}%</b> | Avg Solve Time: <b>{challenge['avg_solve_time']}s</b> | Avg Score: <b>{challenge['avg_score']}/100</b>.",
                body_style
            ) if challenge["has_data"] else Paragraph("No challenge attempts recorded in this date range.", nodata_style),
            Spacer(1, 5)
        ]))

        if challenge["has_data"] and challenge["types_breakdown"]:
            ch_rows = [
                [Paragraph("Challenge Category", th_style), Paragraph("Total Attempts", th_style), Paragraph("Solved Correctly", th_style), Paragraph("Success Rate", th_style), Paragraph("Avg Solve Time", th_style)]
            ]
            for item in challenge["types_breakdown"]:
                ch_rows.append([
                    Paragraph(item["type"], td_left),
                    Paragraph(str(item["total_attempts"]), td_style),
                    Paragraph(str(item["successful"]), td_style),
                    Paragraph(f"{item['success_rate']}%", td_style),
                    Paragraph(f"{item['avg_solve_time']}s", td_style)
                ])
            t_challenge = Table(ch_rows, colWidths=[170, 90, 85, 95, 90])
            t_challenge.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0284c7')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(t_challenge)

        elements.append(Spacer(1, 12))

    # -------------------------------------------------------------
    # SECTION 4: PRODUCTIVITY REPORT
    # -------------------------------------------------------------
    if selected_type in ["all", "productivity", "prod"]:
        elements.append(KeepTogether([
            Paragraph("4. Productivity Report", h2_style),
            Paragraph(
                f"<b>Productivity Goals:</b> {prod['productivity_goals_text']}<br/>"
                f"<b>Habits Completion:</b> {prod['completed_goals']} of {prod['total_goals']} goals fulfilled ({prod['completion_rate']}% progress).",
                body_style
            ) if prod["has_data"] else Paragraph("No habits or productivity goals stored for this account.", nodata_style),
            Spacer(1, 5)
        ]))

        if prod["habits"]:
            prod_rows = [
                [Paragraph("Goal / Habit Name", th_style), Paragraph("Category", th_style), Paragraph("Frequency", th_style), Paragraph("Target Duration", th_style), Paragraph("Status", th_style)]
            ]
            for h in prod["habits"]:
                prod_rows.append([
                    Paragraph(h["name"], td_left),
                    Paragraph(h["category"], td_style),
                    Paragraph(h["frequency"], td_style),
                    Paragraph(f"{h['target_duration_minutes']} min", td_style),
                    Paragraph("Completed" if h["completed"] else "Active", td_style)
                ])
            t_prod = Table(prod_rows, colWidths=[160, 110, 80, 90, 90])
            t_prod.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d97706')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(t_prod)

        elements.append(Spacer(1, 12))

    # -------------------------------------------------------------
    # SECTION 5: SLEEP ANALYTICS REPORT
    # -------------------------------------------------------------
    if selected_type in ["all", "sleep"]:
        elements.append(KeepTogether([
            Paragraph("5. Sleep Analytics Report", h2_style),
            Paragraph(
                f"<b>Average Duration:</b> {sleep['avg_sleep_duration']} hours (Target: {sleep['target_duration']} hrs) | "
                f"<b>Schedule Adherence:</b> {sleep['schedule_adherence_pct']}% | "
                f"<b>Target Window:</b> {sleep['target_sleep_start']} to {sleep['target_sleep_end']}.",
                body_style
            ) if sleep["has_data"] else Paragraph("No sleep logs recorded for this period. Sleep tracking data is unavailable for the selected date range.", nodata_style),
            Spacer(1, 5)
        ]))

        if sleep["has_data"] and sleep["logs"]:
            sleep_rows = [
                [Paragraph("Date", th_style), Paragraph("Target Window", th_style), Paragraph("Actual Sleep", th_style), Paragraph("Actual Wake", th_style), Paragraph("Duration", th_style), Paragraph("Adherence", th_style)]
            ]
            for sl in sleep["logs"]:
                sleep_rows.append([
                    Paragraph(sl["date"], td_left),
                    Paragraph(f"{sl['target_sleep']} - {sl['target_wake']}", td_style),
                    Paragraph(sl["actual_sleep"], td_style),
                    Paragraph(sl["actual_wake"], td_style),
                    Paragraph(f"{sl['duration_hours']} hrs", td_style),
                    Paragraph(f"{sl['adherence_score']}/20", td_style)
                ])
            t_sleep = Table(sleep_rows, colWidths=[100, 120, 75, 75, 75, 85])
            t_sleep.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c3aed')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(t_sleep)

    # Build document
    doc.build(elements, canvasmaker=NumberedCanvas)
    buffer.seek(0)

    clean_name = "".join(c for c in user_info['name'] if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
    type_slug_map = {
        "habit": "Habit_Report",
        "wakeup": "WakeUp_Report",
        "challenge": "Challenge_Performance_Report",
        "productivity": "Productivity_Report",
        "prod": "Productivity_Report",
        "sleep": "Sleep_Analytics_Report",
        "all": "Complete_User_Report"
    }
    slug = type_slug_map.get(selected_type, "Complete_User_Report")
    filename = f"{slug}_{clean_name}_{clean_days}days.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# -------------------------------------------------------------------------
# EXCEL BUILDER HELPER
# -------------------------------------------------------------------------
def export_coach_excel_report(
    coach_id: int,
    days: int,
    start_date: Optional[str],
    end_date: Optional[str],
    db: Session
):
    data = aggregate_coach_report_data(coach_id, db, days, start_date, end_date)
    user_info = data["user_info"]
    coach_profile = data["coach_profile"]
    user_mgmt = data["user_management"]
    coach_act = data["coaching_activity"]
    prog_overview = data["user_progress_overview"]
    recs = data["recommendations_followups"]

    clean_days = int(days) if (isinstance(days, int) or (isinstance(days, str) and str(days).isdigit())) else 30

    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default blank sheet

    # Styling
    indigo_fill = PatternFill(start_color="4338CA", end_color="4338CA", fill_type="solid")
    emerald_fill = PatternFill(start_color="047857", end_color="047857", fill_type="solid")
    sky_fill = PatternFill(start_color="0369A1", end_color="0369A1", fill_type="solid")
    amber_fill = PatternFill(start_color="B45309", end_color="B45309", fill_type="solid")
    purple_fill = PatternFill(start_color="6D28D9", end_color="6D28D9", fill_type="solid")

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="1E293B")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="64748B")
    bold_font = Font(name="Calibri", size=11, bold=True)
    regular_font = Font(name="Calibri", size=11)

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    def style_table(sheet, start_row, header_fill):
        for col in range(1, sheet.max_column + 1):
            cell = sheet.cell(row=start_row, column=col)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
        for row in range(start_row + 1, sheet.max_row + 1):
            for col in range(1, sheet.max_column + 1):
                cell = sheet.cell(row=row, column=col)
                cell.font = regular_font
                cell.border = thin_border
                cell.alignment = Alignment(vertical="center")

    def auto_fit_columns(sheet):
        for col in sheet.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or '')
                if len(val) > max_len:
                    max_len = len(val)
            sheet.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 50)

    # Sheet 1: Coach Profile
    ws1 = wb.create_sheet(title="Coach Profile")
    ws1.cell(row=1, column=1, value="Wellness Coach Profile & Account Overview").font = title_font
    ws1.cell(row=2, column=1, value=f"Coach: {coach_profile['name']} | Email: {coach_profile['email']} | Range: {user_info['date_range']}").font = subtitle_font
    ws1.cell(row=4, column=1, value="COACH PROFILE ATTRIBUTES").font = bold_font
    ws1.append(["Attribute", "Value"])
    ws1.append(["Full Name", coach_profile["name"]])
    ws1.append(["Email Address", coach_profile["email"]])
    ws1.append(["Account Status", coach_profile["status"]])
    ws1.append(["Platform Role", coach_profile["role"]])
    ws1.append(["Member Since", coach_profile["joined_at"]])
    ws1.append(["Specialization", coach_profile["specialization"]])
    ws1.append(["Active Client Assignments", user_mgmt["assigned_count"]])
    ws1.append(["Total Coaching Interactions", coach_act["total_interactions"]])
    style_table(ws1, start_row=5, header_fill=indigo_fill)
    auto_fit_columns(ws1)

    # Sheet 2: User Management
    ws2 = wb.create_sheet(title="User Management")
    ws2.cell(row=1, column=1, value="Assigned Users Management").font = title_font
    ws2.cell(row=2, column=1, value=f"Total Assigned Clients: {user_mgmt['assigned_count']}").font = subtitle_font
    ws2.cell(row=4, column=1, value="ASSIGNED CLIENT ROSTER").font = bold_font
    ws2.append(["Client ID", "Client Name", "Email", "Assigned Date", "Status"])
    if user_mgmt["assigned_users"]:
        for u in user_mgmt["assigned_users"]:
            ws2.append([u["id"], u["name"], u["email"], u["assigned_at"], u["status"]])
        style_table(ws2, start_row=5, header_fill=emerald_fill)
    else:
        ws2.append(["-", "No users currently assigned to this coach", "-", "-", "-"])
    auto_fit_columns(ws2)

    # Sheet 3: Coaching Activity
    ws3 = wb.create_sheet(title="Coaching Activity")
    ws3.cell(row=1, column=1, value="Coaching Sessions & Activity Log").font = title_font
    ws3.cell(row=2, column=1, value=f"Total Interactions: {coach_act['total_interactions']} | Last: {coach_act['last_interaction']}").font = subtitle_font
    ws3.cell(row=4, column=1, value="ACTIVITY LOGS").font = bold_font
    ws3.append(["Activity ID", "Date & Time", "Client Name", "Client Email", "Activity Type", "Details / Guidance Notes"])
    if coach_act["activities"]:
        for a in coach_act["activities"]:
            ws3.append([a["id"], a["created_at"], a["user_name"], a["user_email"], a["activity_type"], a["message"]])
        style_table(ws3, start_row=5, header_fill=sky_fill)
    else:
        ws3.append(["-", "-", "No coaching sessions or interactions recorded", "-", "-", "-"])
    auto_fit_columns(ws3)

    # Sheet 4: User Progress Overview
    ws4 = wb.create_sheet(title="User Progress Overview")
    ws4.cell(row=1, column=1, value="Managed Users Aggregate Progress").font = title_font
    sub4 = f"Managed Clients: {prog_overview['total_clients']} | Habit Progress: {prog_overview['habit_completion_rate']}% | Avg Cognitive Acc: {prog_overview['avg_cognitive_accuracy']}%" if prog_overview['has_data'] else "No assigned clients to aggregate progress"
    ws4.cell(row=2, column=1, value=sub4).font = subtitle_font
    ws4.cell(row=4, column=1, value="CLIENT PERFORMANCE PROGRESSION").font = bold_font
    ws4.append(["Client ID", "Client Name", "Email", "Habits Completed", "Total Habits", "Habit Completion Rate (%)", "Cognitive Accuracy (%)", "Wake Verification (%)", "Active Alarms"])
    if prog_overview["has_data"] and prog_overview["clients"]:
        for c in prog_overview["clients"]:
            ws4.append([c["id"], c["name"], c["email"], c["habits_completed"], c["habits_total"], c["habit_completion_rate"], c["cognitive_accuracy"], c["wake_verification_rate"], c["active_alarms"]])
        style_table(ws4, start_row=5, header_fill=amber_fill)
    else:
        ws4.append(["-", "No assigned client progress data available", "-", "-", "-", "-", "-", "-", "-"])
    auto_fit_columns(ws4)

    # Sheet 5: Recommendations & Follow-ups
    ws5 = wb.create_sheet(title="Recommendations & Follow-ups")
    ws5.cell(row=1, column=1, value="Recommendations & Follow-up Action Items").font = title_font
    ws5.cell(row=2, column=1, value=f"Total Recommendations: {recs['total_recommendations']} | Pending Follow-ups: {recs['pending_followups']}").font = subtitle_font
    ws5.cell(row=4, column=1, value="RECOMMENDATIONS AND STATUS").font = bold_font
    ws5.append(["Record ID", "Date & Time", "Client Name", "Client Email", "Recommendation Details", "Status"])
    if recs["recommendations"]:
        for r in recs["recommendations"]:
            ws5.append([r["id"], r["date"], r["client_name"], r["client_email"], r["recommendation"], r["status"]])
        style_table(ws5, start_row=5, header_fill=purple_fill)
    else:
        ws5.append(["-", "-", "No recommendations or follow-up notes recorded", "-", "-", "-"])
    auto_fit_columns(ws5)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    clean_name = "".join(c for c in coach_profile['name'] if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
    filename = f"Complete_Coach_Report_{clean_name}_{clean_days}days.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/reports/export/excel")
def export_excel_report(
    days: int = Query(30, description="Date range in days"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None, description="Target user ID (for coach or admin)"),
    report_type: Optional[str] = Query(None, alias="type", description="Optional report type: default all"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_id = resolve_report_user_id(user_id, current_user, db)
    target_user = db.query(User).filter(User.id == target_id).first()
    if target_user and target_user.role == "wellness_coach":
        return export_coach_excel_report(
            coach_id=target_id,
            days=days,
            start_date=start_date,
            end_date=end_date,
            db=db
        )
    data = aggregate_user_report_data(target_id, db, days, start_date, end_date)
    user_info = data["user_info"]
    habit = data["habit_report"]
    wakeup = data["wakeup_report"]
    challenge = data["challenge_report"]
    prod = data["productivity_report"]
    sleep = data["sleep_report"]

    # All five report types must be combined into ONE downloadable file.
    selected_type = "all"
    clean_days = int(days) if (isinstance(days, int) or (isinstance(days, str) and str(days).isdigit())) else 30

    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default blank sheet

    # Styling helpers
    navy_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    indigo_fill = PatternFill(start_color="4338CA", end_color="4338CA", fill_type="solid")
    emerald_fill = PatternFill(start_color="047857", end_color="047857", fill_type="solid")
    sky_fill = PatternFill(start_color="0369A1", end_color="0369A1", fill_type="solid")
    amber_fill = PatternFill(start_color="B45309", end_color="B45309", fill_type="solid")
    purple_fill = PatternFill(start_color="6D28D9", end_color="6D28D9", fill_type="solid")
    light_gray_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="1E293B")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="64748B")
    bold_font = Font(name="Calibri", size=11, bold=True)
    regular_font = Font(name="Calibri", size=11)
    
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    def style_table(sheet, start_row, header_fill):
        for col in range(1, sheet.max_column + 1):
            cell = sheet.cell(row=start_row, column=col)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = thin_border
            
        for row in range(start_row + 1, sheet.max_row + 1):
            for col in range(1, sheet.max_column + 1):
                c = sheet.cell(row=row, column=col)
                c.font = regular_font
                c.border = thin_border
                if row % 2 == 0:
                    c.fill = light_gray_fill
                if col == 1:
                    c.alignment = Alignment(horizontal="left", vertical="center")
                else:
                    c.alignment = Alignment(horizontal="center", vertical="center")

    def auto_fit_columns(sheet):
        for col in sheet.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or '')
                if len(val) > max_len:
                    max_len = len(val)
            sheet.column_dimensions[col_letter].width = max(max_len + 3, 14)

    # =========================================================================
    # WORKSHEET 1: Habit Report
    # =========================================================================
    if selected_type in ["all", "habit"]:
        ws1 = wb.create_sheet(title="Habit Report")
        ws1.cell(row=1, column=1, value="Intelligent Cognitive Alarm Platform — Habit Report").font = title_font
        ws1.cell(row=2, column=1, value=f"User: {user_info['name']} ({user_info['email']}) | Date Range: {user_info['date_range']}").font = subtitle_font

        ws1.cell(row=4, column=1, value="HABIT SCORE & 35/25/20/20 BREAKDOWN").font = bold_font
        breakdown_headers = ["Pillar Component", "Weight", "Max Points", "User Score", "Achievement Rate (%)"]
        ws1.append([])
        ws1.append(breakdown_headers)
        
        bk = habit["breakdown"]
        for key in ["wake_up_consistency", "challenge_completion", "snooze_reduction", "sleep_adherence"]:
            item = bk[key]
            ws1.append([item["name"], item["weight"], item["max_points"], item["score"], f"{item['percentage']}%"])
        ws1.append(["Overall Total", "100%", 100, habit["habit_score"], f"{round(habit['habit_score'], 1)}%"])
        style_table(ws1, start_row=6, header_fill=indigo_fill)

        start_hist_row = ws1.max_row + 3
        ws1.cell(row=start_hist_row - 1, column=1, value="DAILY BEHAVIOR HISTORY").font = bold_font
        ws1.cell(row=start_hist_row, column=1, value="Date")
        ws1.cell(row=start_hist_row, column=2, value="Habit Score (/100)")
        ws1.cell(row=start_hist_row, column=3, value="Wake Consistency (/35)")
        ws1.cell(row=start_hist_row, column=4, value="Challenge Rate (%)")
        ws1.cell(row=start_hist_row, column=5, value="Snoozes")
        ws1.cell(row=start_hist_row, column=6, value="Sleep Adherence (/20)")

        if habit["history"]:
            for h in habit["history"]:
                ws1.append([h["date"], h["habit_score"], h["wake_up_score"], f"{h['challenge_rate']}%", h["snooze_count"], h["sleep_score"]])
            style_table(ws1, start_row=start_hist_row, header_fill=navy_fill)
        else:
            ws1.append(["No behavior records recorded in this date range", "-", "-", "-", "-", "-"])
        auto_fit_columns(ws1)

    # =========================================================================
    # WORKSHEET 2: Wake-Up Report
    # =========================================================================
    if selected_type in ["all", "wakeup"]:
        ws2 = wb.create_sheet(title="Wake-Up Report")
        ws2.cell(row=1, column=1, value="Wake-Up Performance & Snooze Analysis").font = title_font
        ws2.cell(row=2, column=1, value=f"User: {user_info['name']} | Total Events: {wakeup['total_wakeups']} | Success Rate: {wakeup['success_rate']}%").font = subtitle_font

        ws2.cell(row=4, column=1, value="Metric").font = bold_font
        ws2.cell(row=4, column=2, value="Value").font = bold_font
        ws2.append(["Total Wake-Up Events", wakeup["total_wakeups"]])
        ws2.append(["Successful Wake-Ups", wakeup["successful_wakeups"]])
        ws2.append(["Missed Wake-Ups", wakeup["missed_wakeups"]])
        ws2.append(["Wake-Up Success Rate", f"{wakeup['success_rate']}%"])
        ws2.append(["Average Wake-Up Delay", f"{wakeup['avg_delay_minutes']} mins"])
        ws2.append(["Average Snoozes per Morning", wakeup["avg_snoozes"]])
        ws2.append(["Total Snooze Count", wakeup["total_snoozes"]])
        style_table(ws2, start_row=4, header_fill=emerald_fill)

        start_ev_row = ws2.max_row + 3
        ws2.cell(row=start_ev_row - 1, column=1, value="WAKE-UP EVENT LOGS").font = bold_font
        ev_headers = ["Date & Time", "Scheduled Time", "Actual Wake Time", "Status", "Delay (mins)", "Snoozes", "Challenges Completed", "Required Challenges"]
        ws2.append(ev_headers)
        if wakeup["events"]:
            for ev in wakeup["events"]:
                ws2.append([ev["date"], ev["scheduled_time"], ev["actual_time"], ev["status"], ev["delay_minutes"], ev["snoozes"], ev["completed_challenges"], ev["required_challenges"]])
            style_table(ws2, start_row=start_ev_row, header_fill=navy_fill)
        else:
            ws2.append(["No wake-up events recorded in this date range", "-", "-", "-", "-", "-", "-", "-"])
        auto_fit_columns(ws2)

    # =========================================================================
    # WORKSHEET 3: Challenge Performance
    # =========================================================================
    if selected_type in ["all", "challenge"]:
        ws3 = wb.create_sheet(title="Challenge Performance")
        ws3.cell(row=1, column=1, value="Cognitive Challenge Performance & Accuracy").font = title_font
        ws3.cell(row=2, column=1, value=f"User: {user_info['name']} | Overall Success Rate: {challenge['success_rate']}% | Avg Solve Time: {challenge['avg_solve_time']}s").font = subtitle_font

        ws3.cell(row=4, column=1, value="PERFORMANCE BY CHALLENGE TYPE").font = bold_font
        type_headers = ["Challenge Category", "Total Attempts", "Solved Correctly", "Failed Attempts", "Success Rate (%)", "Avg Solve Time (s)"]
        ws3.append(type_headers)
        if challenge["types_breakdown"]:
            for t in challenge["types_breakdown"]:
                ws3.append([t["type"], t["total_attempts"], t["successful"], t["failed"], f"{t['success_rate']}%", f"{t['avg_solve_time']}s"])
            style_table(ws3, start_row=5, header_fill=sky_fill)
        else:
            ws3.append(["No challenge attempts recorded in this date range", "-", "-", "-", "-", "-"])

        start_att_row = ws3.max_row + 3
        ws3.cell(row=start_att_row - 1, column=1, value="RECENT CHALLENGE ATTEMPTS").font = bold_font
        att_headers = ["Date & Time", "Challenge Type", "Difficulty", "Correct Result", "Solve Time (s)", "Cognitive Score"]
        ws3.append(att_headers)
        if challenge["recent_attempts"]:
            for a in challenge["recent_attempts"]:
                ws3.append([a["date"], a["type"], a["difficulty"], "Passed" if a["is_correct"] else "Failed", a["solve_time"], a["score"]])
            style_table(ws3, start_row=start_att_row, header_fill=navy_fill)
        else:
            ws3.append(["No challenge attempts recorded in this date range", "-", "-", "-", "-", "-"])
        auto_fit_columns(ws3)

    # =========================================================================
    # WORKSHEET 4: Productivity Report
    # =========================================================================
    if selected_type in ["all", "productivity", "prod"]:
        ws4 = wb.create_sheet(title="Productivity Report")
        ws4.cell(row=1, column=1, value="Productivity Goals & Daily Habits Tracking").font = title_font
        ws4.cell(row=2, column=1, value=f"User: {user_info['name']} | Overall Completion Rate: {prod['completion_rate']}%").font = subtitle_font

        ws4.cell(row=4, column=1, value="Summary Goals:").font = bold_font
        ws4.cell(row=4, column=2, value=prod["productivity_goals_text"]).font = regular_font

        ws4.cell(row=6, column=1, value="ACTIVE HABITS & GOALS PROGRESS").font = bold_font
        prod_headers = ["Habit / Goal Name", "Category", "Frequency", "Target Duration (mins)", "Priority", "Time of Day", "Status"]
        ws4.append(prod_headers)
        if prod["habits"]:
            for h in prod["habits"]:
                ws4.append([h["name"], h["category"], h["frequency"], h["target_duration_minutes"], h["priority"], h["time_of_day"], "Completed" if h["completed"] else "Active"])
            style_table(ws4, start_row=7, header_fill=amber_fill)
        else:
            ws4.append(["No active habits or goals configured", "-", "-", "-", "-", "-", "-"])
        auto_fit_columns(ws4)

    # =========================================================================
    # WORKSHEET 5: Sleep Analytics
    # =========================================================================
    if selected_type in ["all", "sleep"]:
        ws5 = wb.create_sheet(title="Sleep Analytics")
        ws5.cell(row=1, column=1, value="Sleep Analytics & Schedule Adherence").font = title_font
        sub_val = f"User: {user_info['name']} | Target Schedule: {sleep['target_sleep_start']} - {sleep['target_sleep_end']} | Avg Duration: {sleep['avg_sleep_duration']} hrs" if sleep['has_data'] else f"User: {user_info['name']} | Target Schedule: {sleep['target_sleep_start']} - {sleep['target_sleep_end']} | No sleep logs recorded"
        ws5.cell(row=2, column=1, value=sub_val).font = subtitle_font

        ws5.cell(row=4, column=1, value="DAILY SLEEP LOGS & ADHERENCE").font = bold_font
        sleep_headers = ["Date", "Target Sleep", "Target Wake", "Actual Sleep", "Actual Wake", "Duration (hrs)", "Adherence Score (/20)"]
        ws5.append(sleep_headers)
        if sleep["has_data"] and sleep["logs"]:
            for sl in sleep["logs"]:
                ws5.append([sl["date"], sl["target_sleep"], sl["target_wake"], sl["actual_sleep"], sl["actual_wake"], sl["duration_hours"], sl["adherence_score"]])
            style_table(ws5, start_row=5, header_fill=purple_fill)
        else:
            ws5.append(["No sleep logs recorded in this date range", "-", "-", "-", "-", "-", "-"])
        auto_fit_columns(ws5)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    clean_name = "".join(c for c in user_info['name'] if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
    type_slug_map = {
        "habit": "Habit_Report",
        "wakeup": "WakeUp_Report",
        "challenge": "Challenge_Performance_Report",
        "productivity": "Productivity_Report",
        "prod": "Productivity_Report",
        "sleep": "Sleep_Analytics_Report",
        "all": "Complete_User_Report"
    }
    slug = type_slug_map.get(selected_type, "Complete_User_Report")
    filename = f"{slug}_{clean_name}_{clean_days}days.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# Backward compatibility routes
@router.get("/reports/csv")
def legacy_export_csv_report(
    type: str = Query("all"),
    days: int = Query(30),
    user_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return export_excel_report(days=days, user_id=user_id, report_type=type, current_user=current_user, db=db)


@router.get("/reports/pdf")
def legacy_export_pdf_report(
    type: str = Query("all"),
    days: int = Query(30),
    user_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return export_pdf_report(days=days, user_id=user_id, report_type=type, current_user=current_user, db=db)
