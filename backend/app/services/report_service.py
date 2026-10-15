"""Builds the five user reports and renders them as PDF or Excel files."""
from __future__ import annotations

import io
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.challenge import Challenge
from app.models.challenge_attempt import ChallengeAttempt
from app.models.profile import UserProfile
from app.models.user import User
from app.models.wake_up_verification import WakeUpVerification
from app.services import tracking_metrics as tm
from app.services.habit_score import habit_score_service
from app.services.profile_service import wake_goal_progress

REPORT_TYPES = {
    "habit": "Habit Report",
    "wake_up": "Wake-Up Report",
    "challenge": "Challenge Performance Report",
    "productivity": "Productivity Report",
    "sleep": "Sleep Analytics Report",
}

HEADER_COLOR = "123A68"  # same navy as the app sidebar


def _fmt(value) -> str:
    if value is None:
        return "-"
    if isinstance(value, float):
        return f"{value:.1f}"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    return str(value)


def _local(value: datetime, tz: ZoneInfo) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(tz)


def build_platform_report(data: dict) -> dict:
    """Administrator report built from the admin analytics result.

    Every figure comes from the same data the Admin Dashboard shows. A
    section with no recorded data says so instead of showing a made-up number.
    """
    rng = data["range"]
    now = datetime.now(timezone.utc)
    platform, users = data["platform"], data["users"]
    alarms, wake = data["alarms"], data["wake_up"]
    challenges, habit = data["challenges"], data["habit"]
    recs, system = data["recommendations"], data["system"]
    snooze = alarms.get("snooze") or {}

    summary: list[tuple] = [
        ("Total users", platform["total_users"]),
        ("Active users in period", platform["active_users_in_period"]),
        ("Active accounts", platform["enabled_accounts"]),
        ("New registrations in period", users["registrations_in_period"]),
        ("Total alarms", platform["total_alarms"]),
        ("Enabled alarms", platform["enabled_alarms"]),
        ("Alarms created in period", alarms["created_in_period"]),
        ("Wake-up verification attempts", wake["attempts"]),
        ("Wake-up verification success %", wake["verification_success_rate_percent"]),
        ("Average wake-up response (s)", wake["average_response_seconds"]),
        ("Challenge attempts", challenges.get("attempts")),
        ("Challenge accuracy %", challenges.get("accuracy_percent")),
        ("Challenge completion %", challenges.get("completion_percent")),
        ("Users with a habit score", habit["users_scored"]),
        ("Average habit score", habit["average_habit_score"]),
        ("Average habit score change", habit["average_improvement"]),
    ]

    if snooze.get("available"):
        summary += [
            ("Alarms triggered", snooze["alarms_triggered"]),
            ("Snoozes", snooze["snoozes"]),
            ("Dismissals", snooze["dismissals"]),
            ("Dismissal success %", snooze["dismissal_success_rate_percent"]),
            ("Snooze reduction vs previous period %", snooze["snooze_reduction_percent"]),
        ]
    else:
        summary.append(("Snooze analytics", "No alarm events recorded in this period"))

    trend = habit.get("adherence_trend") or {}
    if trend.get("available"):
        summary.append(("Average sleep schedule adherence %", trend["average_adherence_percent"]))
    else:
        summary.append(("Sleep schedule adherence", "No sleep logs recorded in this period"))

    if recs.get("available"):
        summary += [
            ("Recommendations viewed", recs["viewed"]),
            ("Recommendations accepted", recs["accepted"]),
            ("Recommendations dismissed", recs["dismissed"]),
            ("Recommendation acceptance %", recs["acceptance_rate_percent"]),
            ("Engagement change (points)", recs["engagement_improvement_points"]),
        ]
    else:
        summary.append(("Recommendation engagement", "No recommendation activity recorded in this period"))

    if system.get("available"):
        overall = system["overall"]
        summary += [
            ("API requests timed", overall["count"]),
            ("API average (ms)", overall["avg_ms"]),
            ("API p95 (ms)", overall["p95_ms"]),
            ("API server errors", overall["error_count"]),
        ]
        generation = system.get("challenge_generation")
        if generation:
            summary.append(("Challenge generation average (ms)", generation["avg_ms"]))
    else:
        summary.append(("API timings", "None recorded in this period"))

    registrations = {r["date"]: r["count"] for r in users["registration_trend"]}
    challenge_days = {r["date"]: r for r in challenges.get("daily", [])}
    daily_rows = []
    for day in wake["daily"]:
        c = challenge_days.get(day["date"], {})
        daily_rows.append([
            day["date"], registrations.get(day["date"], 0),
            day["attempts"], day["successful"], day["success_rate_percent"],
            c.get("attempts", 0), c.get("accuracy_percent"),
        ])

    def named(rows, *keys):
        return [[r.get("name")] + [r.get(k) for k in keys] for r in rows or []]

    tables = [
        {"title": "Daily activity",
         "columns": ["Date", "New users", "Wake-up attempts", "Successful",
                     "Success %", "Challenge attempts", "Accuracy %"],
         "rows": daily_rows},
        {"title": "Challenges by type",
         "columns": ["Type", "Attempts", "Correct", "Accuracy %", "Avg response (s)"],
         "rows": named(challenges.get("by_type"), "attempts", "correct",
                       "accuracy_percent", "average_response_seconds")},
        {"title": "Challenges by difficulty",
         "columns": ["Difficulty", "Attempts", "Correct", "Accuracy %", "Avg response (s)"],
         "rows": named(challenges.get("by_difficulty"), "attempts", "correct",
                       "accuracy_percent", "average_response_seconds")},
        {"title": "Verification methods",
         "columns": ["Method", "Count"],
         "rows": [[m["name"], m["count"]] for m in wake.get("by_method", [])]},
        {"title": "Alarms by challenge type",
         "columns": ["Type", "Alarms"],
         "rows": [[a["name"], a["count"]] for a in alarms.get("by_challenge_type", [])]},
        {"title": "Users by role",
         "columns": ["Role", "Users"],
         "rows": [[r["role"], r["count"]] for r in users.get("role_distribution", [])]},
        {"title": "Habit score distribution",
         "columns": ["Score band", "Users"],
         "rows": [[b["band"], b["count"]] for b in habit.get("distribution", [])]},
    ]
    if system.get("available"):
        tables.append({
            "title": "Slowest API routes",
            "columns": ["Route", "Requests", "Avg ms", "p95 ms", "Errors"],
            "rows": [[r["route"], r["count"], r["avg_ms"], r["p95_ms"], r["error_count"]]
                     for r in system.get("routes", [])],
        })

    return {
        "type": "platform",
        "title": "Platform Analytics Report",
        "subject_label": "Scope",
        "user": "All users",
        "period": f"{rng['start']} to {rng['end']} ({rng['days']} days)",
        "generated_at": now.strftime("%Y-%m-%d %H:%M UTC"),
        "summary": summary,
        "tables": tables,
    }


def build_report(db: Session, user_id: int, report_type: str, days: int = 30) -> dict:
    if report_type not in REPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="report must be one of: " + ", ".join(REPORT_TYPES),
        )
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    days = max(1, min(days, 365))
    try:
        tz = ZoneInfo(user.timezone or "UTC")
    except Exception:
        tz = ZoneInfo("UTC")
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    profile = db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    ).scalar_one_or_none()

    verifs = list(db.execute(
        select(WakeUpVerification).where(
            WakeUpVerification.user_id == user_id,
            WakeUpVerification.created_at >= since,
        ).order_by(WakeUpVerification.created_at)
    ).scalars())

    report = {
        "type": report_type,
        "title": REPORT_TYPES[report_type],
        "user": user.full_name,
        "period": f"{since.date().isoformat()} to {now.date().isoformat()} ({days} days)",
        "generated_at": now.strftime("%Y-%m-%d %H:%M UTC"),
        "summary": [],
        "tables": [],
    }

    ok = sum(1 for v in verifs if v.successful)
    times = [v.response_time for v in verifs if v.response_time is not None]

    if report_type == "habit":
        try:
            habit = habit_score_service.calculate_habit_score(db=db, user_id=user_id)
        except Exception:
            habit = {"habit_score": None, "components": {}}
        report["summary"] = [("Habit score", habit["habit_score"])] + [
            (name.replace("_", " ").capitalize(), value)
            for name, value in habit["components"].items()
        ]
        if profile:
            goal = wake_goal_progress(db, user, profile)
            report["summary"] += [
                ("Wake-up goal (days per week)", goal["goal_days_per_week"]),
                ("Days achieved in last 7", goal["days_achieved"]),
            ]
        per_day: dict = defaultdict(lambda: [0, 0])
        for v in verifs:
            key = _local(v.created_at, tz).date().isoformat()
            per_day[key][0] += 1
            per_day[key][1] += int(bool(v.successful))
        report["tables"].append({
            "title": "Daily wake-up results",
            "columns": ["Date", "Attempts", "Successful", "Success rate %"],
            "rows": [
                [d, a, s, round(100 * s / a, 1)] for d, (a, s) in sorted(per_day.items())
            ],
        })

    elif report_type == "wake_up":
        report["summary"] = [
            ("Verification attempts", len(verifs)),
            ("Successful", ok),
            ("Success rate %", round(100 * ok / len(verifs), 1) if verifs else None),
            ("Average response (seconds)", round(sum(times) / len(times), 1) if times else None),
        ]
        report["tables"].append({
            "title": "Wake-up verifications",
            "columns": ["Date and time", "Method", "Status", "Attempt", "Response (s)"],
            "rows": [
                [_local(v.created_at, tz).strftime("%Y-%m-%d %H:%M"), v.verification_method,
                 "successful" if v.successful else v.status, v.attempt_number, v.response_time]
                for v in reversed(verifs)
            ],
        })

    elif report_type == "challenge":
        naive_since = since.replace(tzinfo=None)  # attempts are stored as naive UTC
        rows = db.execute(
            select(ChallengeAttempt, Challenge.challenge_type, Challenge.difficulty)
            .join(Challenge, Challenge.id == ChallengeAttempt.challenge_id)
            .where(ChallengeAttempt.user_id == user_id,
                   ChallengeAttempt.created_at >= naive_since)
            .order_by(ChallengeAttempt.created_at)
        ).all()
        correct = sum(1 for a, _, _ in rows if a.is_correct)
        rts = [a.response_time for a, _, _ in rows if a.response_time is not None]
        report["summary"] = [
            ("Attempts", len(rows)), ("Correct", correct),
            ("Accuracy %", round(100 * correct / len(rows), 1) if rows else None),
            ("Average response (seconds)", round(sum(rts) / len(rts), 1) if rts else None),
        ]
        groups: dict = defaultdict(lambda: [0, 0])
        for a, ctype, diff in rows:
            groups[(ctype, diff)][0] += 1
            groups[(ctype, diff)][1] += int(bool(a.is_correct))
        report["tables"].append({
            "title": "Accuracy by type and difficulty",
            "columns": ["Type", "Difficulty", "Attempts", "Correct", "Accuracy %"],
            "rows": [[t, d, n, c, round(100 * c / n, 1)] for (t, d), (n, c) in sorted(groups.items())],
        })
        report["tables"].append({
            "title": "Recent attempts",
            "columns": ["Date and time", "Type", "Difficulty", "Result", "Response (s)"],
            "rows": [
                [_local(a.created_at, tz).strftime("%Y-%m-%d %H:%M"), t, d,
                 "correct" if a.is_correct else "incorrect", a.response_time]
                for a, t, d in reversed(rows[-100:])
            ],
        })

    elif report_type == "productivity":
        logs = tm.load_productivity_logs(db, [user_id], since.date(), now.date())
        summary = tm.productivity_summary(logs, tm.wake_success_by_local_day(verifs, tz))
        if summary:
            corr = summary["correlation"]
            report["summary"] = [
                ("Days logged", summary["days_logged"]),
                ("Average rating (1-10)", summary["average_rating"]),
                ("Task completion %", summary["task_completion_percent"]),
                ("Average focus (minutes)", summary["average_focus_minutes"]),
                ("Rating after successful wake-up", corr["rating_after_successful_wakeup"]),
                ("Rating after unsuccessful wake-up", corr["rating_after_unsuccessful_wakeup"]),
                ("Correlation (r)", corr["pearson_r"]),
            ]
        else:
            report["summary"] = [("Note", "No productivity check-ins in this period")]
        report["tables"].append({
            "title": "Daily check-ins",
            "columns": ["Date", "Rating", "Tasks planned", "Tasks completed", "Focus (min)"],
            "rows": [[l.log_date.isoformat(), l.rating, l.tasks_planned, l.tasks_completed,
                      l.focus_minutes] for l in logs],
        })

    else:  # sleep
        goal = profile.daily_sleep_goal_minutes if profile else 480
        target = profile.sleep_target if profile else None
        logs = tm.load_sleep_logs(db, [user_id], since.date(), now.date())
        summary = tm.sleep_summary(logs, goal, target, profile.wake_target if profile else None, tz)
        if summary:
            report["summary"] = [
                ("Nights logged", summary["nights_logged"]),
                ("Average sleep (minutes)", summary["average_duration_minutes"]),
                ("Sleep goal (minutes)", goal),
                ("Average quality (1-5)", summary["average_quality"]),
                ("Schedule adherence %", summary["adherence_percent"]),
            ]
        else:
            report["summary"] = [("Note", "No sleep logs in this period")]
        report["tables"].append({
            "title": "Nightly sleep",
            "columns": ["Date", "Bedtime", "Wake time", "Minutes", "Quality", "On schedule"],
            "rows": [
                [l.sleep_date.isoformat(), _local(l.bed_time, tz).strftime("%H:%M"),
                 _local(l.wake_time, tz).strftime("%H:%M"), l.duration_minutes, l.quality,
                 "yes" if tm.night_is_on_schedule(l, goal, target, tz) else "no"]
                for l in logs
            ],
        })
    return report


# ---------------------------------------------------------------------
# Renderers
# ---------------------------------------------------------------------

def render_pdf(report: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    navy = colors.HexColor("#" + HEADER_COLOR)
    styles = getSampleStyleSheet()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm, title=report["title"])

    def table(data, widths=None):
        t = Table(data, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), navy),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F7FB")]),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D5DAE3")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        return t

    story = [
        Paragraph(f"Cognitive Alarm - {report['title']}", styles["Title"]),
        Paragraph(f"{report.get('subject_label', 'User')}: {report['user']}<br/>Period: {report['period']}<br/>"
                  f"Generated: {report['generated_at']}", styles["Normal"]),
        Spacer(1, 8 * mm),
        Paragraph("Summary", styles["Heading2"]),
        table([["Measure", "Value"]] + [[k, _fmt(v)] for k, v in report["summary"]], [90 * mm, 60 * mm]),
    ]
    for item in report["tables"]:
        story += [Spacer(1, 7 * mm), Paragraph(item["title"], styles["Heading2"])]
        if item["rows"]:
            story.append(table([item["columns"]] + [[_fmt(c) for c in r] for r in item["rows"]]))
        else:
            story.append(Paragraph("No records in this period.", styles["Normal"]))
    doc.build(story)
    return buffer.getvalue()


def render_xlsx(report: dict) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill

    header_fill = PatternFill("solid", fgColor=HEADER_COLOR)
    header_font = Font(bold=True, color="FFFFFF")
    wb = Workbook()

    def fill_header(ws, row, columns):
        for i, name in enumerate(columns, start=1):
            cell = ws.cell(row=row, column=i, value=name)
            cell.fill, cell.font = header_fill, header_font
            cell.alignment = Alignment(horizontal="center")

    def autosize(ws):
        for column in ws.columns:
            width = max((len(str(c.value)) for c in column if c.value is not None), default=8)
            ws.column_dimensions[column[0].column_letter].width = min(48, width + 3)

    ws = wb.active
    ws.title = "Summary"
    ws["A1"], ws["A1"].font = f"Cognitive Alarm - {report['title']}", Font(bold=True, size=14)
    ws["A2"], ws["A3"], ws["A4"] = f"{report.get('subject_label', 'User')}: {report['user']}", f"Period: {report['period']}", f"Generated: {report['generated_at']}"
    fill_header(ws, 6, ["Measure", "Value"])
    for i, (k, v) in enumerate(report["summary"], start=7):
        ws.cell(row=i, column=1, value=k)
        ws.cell(row=i, column=2, value=v)
    autosize(ws)

    for item in report["tables"]:
        sheet = wb.create_sheet(title=item["title"][:31])
        fill_header(sheet, 1, item["columns"])
        for r, row in enumerate(item["rows"], start=2):
            for c, value in enumerate(row, start=1):
                sheet.cell(row=r, column=c, value=value)
        sheet.freeze_panes = "A2"
        autosize(sheet)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
