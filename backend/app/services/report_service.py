"""
report_service.py

Comprehensive PDF and Excel report generation engine for the
AI Intelligent Cognitive Alarm Platform.

Generates structured, professional reports covering:
- Habit Formation & Scoring
- Wake-Up Consistency & Snooze Patterns
- Cognitive Challenge Accuracy & Response Speed
- Sleep Schedule Adherence
- Actionable AI & Coach Recommendations
"""

from io import BytesIO
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)

from ..models.alarm import Alarm
from ..models.challenge import Challenge
from ..models.recommendation import Recommendation
from ..models.activity import Activity
from .analytics_service import get_dashboard, get_behavioral_analytics


def build_excel(db, user, report_type="comprehensive"):
    """
    Build a multi-tab, professionally formatted Excel workbook
    containing all user behavioral telemetry, habit scores, alarm configurations,
    cognitive challenge history, and recommendations.
    """
    workbook = Workbook()

    # Style presets
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
    bold_font = Font(name="Calibri", size=11, bold=True)
    regular_font = Font(name="Calibri", size=11)
    thin_border = Border(
        left=Side(style="thin", color="D1D5DB"),
        right=Side(style="thin", color="D1D5DB"),
        top=Side(style="thin", color="D1D5DB"),
        bottom=Side(style="thin", color="D1D5DB"),
    )

    dashboard = get_dashboard(db, user)
    behavior = get_behavioral_analytics(db, user)

    # ─────────────────────────────────────────────────────────────
    # TAB 1: USER PERFORMANCE & EXECUTIVE SUMMARY
    # ─────────────────────────────────────────────────────────────
    ws1 = workbook.active
    ws1.title = "User Performance"
    ws1.views.sheetView[0].showGridLines = True

    ws1.append(["User Profile"])
    ws1["A1"].font = title_font

    profile_data = [
        ["Name", user.name],
        ["Email", user.email],
        ["Role", getattr(user, "role", "user")],
        ["Preferred Wake Time", getattr(user, "preferred_wake_time", "07:00")],
        ["Sleep Duration", f"{getattr(user, 'sleep_duration', 8.0)} hours"],
        ["Difficulty Preference", (dashboard.get("current_difficulty") or "medium").title()],
        ["Productivity Goal", getattr(user, "productivity_goal", "") or "Not specified"],
    ]
    for row in profile_data:
        ws1.append(row)

    ws1.append([])
    ws1.append(["Key Performance Indicators", "Score / Metric", "Weight / Target"])
    for cell in ws1[ws1.max_row]:
        cell.font = header_font
        cell.fill = header_fill

    breakdown = dashboard.get("habit_score_breakdown", {})
    kpi_data = [
        ["Overall Habit Score", f"{dashboard['habit_score']} / 100" if dashboard.get("habit_score") is not None else "Not enough measured data", "Composite 100%"],
        ["Wake-Up Consistency", f"{dashboard.get('wake_up_consistency', 0)}%", "35% (Pillar 1)"],
        ["Challenge Completion Success", f"{dashboard.get('challenge_completion_success', 0)}%", "25% (Pillar 2)"],
        ["Snooze Reduction", f"{dashboard['snooze_reduction']}%" if dashboard.get("snooze_reduction") is not None else "Not enough data", "20% (Pillar 3)"],
        ["Sleep Schedule Adherence", "Not measured" if dashboard.get("sleep_adherence") is None else f"{dashboard['sleep_adherence']}%", "20% (Pillar 4)"],
        ["Challenge Accuracy", f"{dashboard['challenge_accuracy']}%" if dashboard.get("challenge_accuracy") is not None else "Not enough data", "Target: ≥80%"],
        ["Average Response Time", f"{dashboard['average_challenge_time']}s" if dashboard.get("average_challenge_time") is not None else "Not enough data", "Target: ≤40s"],
        ["ML Cognitive Readiness", "Not available" if dashboard.get("readiness_score") is None else f"{dashboard['readiness_score']} / 100", "Requires measured sleep adherence"],
    ]
    for row in kpi_data:
        ws1.append(row)

    # ─────────────────────────────────────────────────────────────
    # TAB 2: ALARM SCHEDULE & PERFORMANCE
    # ─────────────────────────────────────────────────────────────
    ws2 = workbook.create_sheet("Alarm Schedule")
    ws2.views.sheetView[0].showGridLines = True
    ws2.append(["Title", "Alarm Time", "Type", "Difficulty", "Challenge Type", "Smart", "Active", "Snoozes", "Completions"])
    for cell in ws2[1]:
        cell.font = header_font
        cell.fill = header_fill

    alarms = db.query(Alarm).filter(Alarm.user_id == user.id).all()
    for a in alarms:
        ws2.append([
            a.title,
            a.alarm_time,
            (a.alarm_type or "daily").title(),
            (a.difficulty or "medium").title(),
            (a.challenge_type or "math").title(),
            "Yes" if a.is_smart else "No",
            "Active" if a.is_active else "Inactive",
            a.snooze_count or 0,
            a.completed_count or 0,
        ])

    # ─────────────────────────────────────────────────────────────
    # TAB 3: COGNITIVE CHALLENGE LOG
    # ─────────────────────────────────────────────────────────────
    ws3 = workbook.create_sheet("Challenge History")
    ws3.views.sheetView[0].showGridLines = True
    ws3.append(["Session ID", "Challenge Type", "Difficulty", "Question", "User Answer", "Correct", "Response Time (s)", "Timestamp"])
    for cell in ws3[1]:
        cell.font = header_font
        cell.fill = header_fill

    challenges = (
        db.query(Challenge)
        .filter(Challenge.user_id == user.id)
        .order_by(Challenge.created_at.desc())
        .limit(200)
        .all()
    )
    for c in challenges:
        ws3.append([
            c.session_id,
            (c.challenge_type or "math").title(),
            (c.difficulty or "medium").title(),
            c.question,
            c.user_answer or "",
            "Correct" if c.is_correct else ("Incorrect" if c.is_correct is False else "Pending"),
            round(c.response_time, 2) if c.response_time else "",
            c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else "",
        ])

    # ─────────────────────────────────────────────────────────────
    # TAB 4: ACTIONABLE RECOMMENDATIONS
    # ─────────────────────────────────────────────────────────────
    ws4 = workbook.create_sheet("Recommendations")
    ws4.views.sheetView[0].showGridLines = True
    ws4.append(["Title", "Category", "Priority", "Supporting Metric", "Suggested Action"])
    for cell in ws4[1]:
        cell.font = header_font
        cell.fill = header_fill

    recs = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user.id)
        .order_by(Recommendation.created_at.desc())
        .limit(25)
        .all()
    )
    for r in recs:
        ws4.append([
            r.title,
            (r.category or "general").replace("_", " ").title(),
            (r.priority or "medium").title(),
            r.supporting_metric or "",
            r.suggested_action,
        ])

    # Auto-fit columns
    for ws in [ws1, ws2, ws3, ws4]:
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = col[0].column_letter
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 50)

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return output


def build_pdf(db, user, report_type="comprehensive"):
    """
    Build a multi-page, publication-quality PDF report using ReportLab.
    Includes Executive Summary, 4-Pillar Habit Score, XGBoost Cognitive Readiness,
    Alarm schedule, and personalized recommendations.
    """
    output = BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1E3A8A"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#6B7280"),
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=10,
        spaceAfter=6,
    )
    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#1F2937"),
    )
    cell_bold_style = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1F2937"),
    )

    elements = []

    # Title & Subtitle
    elements.append(Paragraph("AI Intelligent Cognitive Alarm Platform", title_style))
    elements.append(Paragraph(
        f"Behavioral Performance & Habit Score Report | User: {user.name} ({user.email}) | "
        f"Generated: {datetime.utcnow().strftime('%B %d, %Y %H:%M UTC')}",
        subtitle_style
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1E3A8A"), spaceAfter=12))

    dashboard = get_dashboard(db, user)

    # 1. Profile Summary Table
    elements.append(Paragraph("1. User Profile & Target Settings", section_style))
    profile_table_data = [
        [
            Paragraph("<b>User Role:</b>", cell_style), Paragraph(str(user.role).title(), cell_style),
            Paragraph("<b>Target Sleep:</b>", cell_style), Paragraph(f"{user.sleep_duration} hours", cell_style),
        ],
        [
            Paragraph("<b>Preferred Wake Time:</b>", cell_style), Paragraph(str(user.preferred_wake_time), cell_style),
            Paragraph("<b>Difficulty Level:</b>", cell_style), Paragraph(str(dashboard.get("current_difficulty", "medium")).title(), cell_style),
        ],
        [
            Paragraph("<b>Timezone:</b>", cell_style), Paragraph(str(user.timezone or "Asia/Kolkata"), cell_style),
            Paragraph("<b>Productivity Goal:</b>", cell_style), Paragraph(str(user.productivity_goal or "Consistent Wakeup"), cell_style),
        ],
    ]
    t_prof = Table(profile_table_data, colWidths=[120, 140, 120, 140])
    t_prof.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_prof)
    elements.append(Spacer(1, 10))

    # 2. Executive Performance & Habit Scoring Model
    elements.append(Paragraph("2. Official Weighted Habit Score (35 / 25 / 20 / 20 Model)", section_style))
    habit_score = dashboard.get("habit_score")
    wake_cons = dashboard.get("wake_up_consistency") or 0
    chal_comp = dashboard.get("challenge_completion_success") or 0
    snooze_red = dashboard.get("snooze_reduction")
    sleep_adh = dashboard.get("sleep_adherence")

    score_table_data = [
        [Paragraph("<b>Component</b>", cell_bold_style), Paragraph("<b>Target Weight</b>", cell_bold_style), Paragraph("<b>Measured Score</b>", cell_bold_style), Paragraph("<b>Status</b>", cell_bold_style)],
        [Paragraph("Wake-Up Consistency", cell_style), Paragraph("35%", cell_style), Paragraph(f"{wake_cons}%", cell_style), Paragraph("Consistent" if wake_cons >= 70 else "Needs Focus", cell_style)],
        [Paragraph("Challenge Completion Success", cell_style), Paragraph("25%", cell_style), Paragraph(f"{chal_comp}%", cell_style), Paragraph("Optimal" if chal_comp >= 80 else "In Progress", cell_style)],
        [Paragraph("Snooze Reduction", cell_style), Paragraph("20%", cell_style), Paragraph(f"{snooze_red}%" if snooze_red is not None else "Not enough data", cell_style), Paragraph("Controlled" if snooze_red is not None and snooze_red >= 70 else "Insufficient data", cell_style)],
        [Paragraph("Sleep Schedule Adherence", cell_style), Paragraph("20%", cell_style), Paragraph(f"{sleep_adh}%" if sleep_adh is not None else "Not measured", cell_style), Paragraph("Not measured from current records", cell_style)],
        [Paragraph("<b>TOTAL HABIT SCORE</b>", cell_bold_style), Paragraph("<b>100%</b>", cell_bold_style), Paragraph(f"<b>{habit_score} / 100</b>" if habit_score is not None else "<b>Not enough measured data</b>", cell_bold_style), Paragraph("<b>Strong Habit</b>" if habit_score is not None and habit_score >= 75 else "<b>Not available</b>", cell_bold_style)],
    ]
    t_score = Table(score_table_data, colWidths=[180, 90, 110, 140])
    t_score.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#EEF2FF")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_score)
    elements.append(Spacer(1, 10))

    # 3. XGBoost Cognitive Readiness Model
    elements.append(Paragraph("3. Machine Learning Cognitive Wake-Up Readiness (XGBoost)", section_style))
    ml_table_data = [
        [
            Paragraph("<b>Readiness Score:</b>", cell_style), Paragraph("Not available" if dashboard.get("readiness_score") is None else f"{dashboard['readiness_score']} / 100", cell_bold_style),
            Paragraph("<b>Alert Status:</b>", cell_style), Paragraph("Not available", cell_style),
        ],
        [
            Paragraph("<b>Model Confidence:</b>", cell_style), Paragraph("Not available", cell_style),
            Paragraph("<b>Model Engine:</b>", cell_style), Paragraph("XGBoost 3.2.0 Classifier", cell_style),
        ],
        [
            Paragraph("<b>Model Insight:</b>", cell_style),
            Paragraph(dashboard.get("readiness_unavailable_reason", "No measured readiness estimate is available."), cell_style),
            Paragraph("", cell_style), Paragraph("", cell_style),
        ],
    ]
    t_ml = Table(ml_table_data, colWidths=[120, 140, 120, 140])
    t_ml.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#BBF7D0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#BBF7D0")),
        ("SPAN", (1, 2), (3, 2)),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_ml)
    elements.append(Spacer(1, 10))

    # 4. Alarms Schedule Summary
    elements.append(Paragraph("4. Scheduled Alarms & Difficulty Tier", section_style))
    alarms = db.query(Alarm).filter(Alarm.user_id == user.id).all()
    if alarms:
        alarm_rows = [
            [Paragraph("<b>Title</b>", cell_bold_style), Paragraph("<b>Time</b>", cell_bold_style), Paragraph("<b>Type</b>", cell_bold_style), Paragraph("<b>Difficulty</b>", cell_bold_style), Paragraph("<b>Challenge</b>", cell_bold_style), Paragraph("<b>Status</b>", cell_bold_style)]
        ]
        for a in alarms[:8]:
            alarm_rows.append([
                Paragraph(a.title[:20], cell_style),
                Paragraph(a.alarm_time, cell_style),
                Paragraph(str(a.alarm_type).title(), cell_style),
                Paragraph(str(a.difficulty).title(), cell_style),
                Paragraph(str(a.challenge_type).title(), cell_style),
                Paragraph("Active" if a.is_active else "Off", cell_style),
            ])
        t_alarm = Table(alarm_rows, colWidths=[120, 70, 80, 80, 90, 80])
        t_alarm.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_alarm)
    else:
        elements.append(Paragraph("No alarms currently scheduled.", cell_style))

    elements.append(Spacer(1, 10))

    # 5. Tailored Recommendations
    elements.append(Paragraph("5. Targeted Recommendations", section_style))
    recs = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user.id)
        .order_by(Recommendation.created_at.desc())
        .limit(4)
        .all()
    )
    if recs:
        rec_rows = [
            [Paragraph("<b>Focus Area</b>", cell_bold_style), Paragraph("<b>Guidance & Suggested Action</b>", cell_bold_style), Paragraph("<b>Priority</b>", cell_bold_style)]
        ]
        for r in recs:
            rec_rows.append([
                Paragraph(r.title, cell_bold_style),
                Paragraph(f"{r.reason} <i>Action:</i> {r.suggested_action}", cell_style),
                Paragraph(str(r.priority).title(), cell_style),
            ])
        t_rec = Table(rec_rows, colWidths=[130, 320, 70])
        t_rec.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_rec)
    else:
        elements.append(Paragraph("Complete more alarm challenge sessions to generate targeted recommendations.", cell_style))

    doc.build(elements)
    output.seek(0)
    return output


def build_platform_excel(metrics):
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Platform Summary"
    summary.append(["Platform Analytics Report"])
    summary.append(["Generated at (UTC)", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")])
    summary.append(["Reporting period", f"{metrics['period']['start_date']} to {metrics['period']['end_date']}"])
    summary.append([])
    summary.append(["Metric", "Value"])
    activity = metrics["activity_summary"]
    summary_rows = [
        ("Registered users", metrics["total_users"]),
        ("Active users in period", metrics["active_users"]),
        ("Successful logins in period", metrics["successful_logins"]),
        ("Users logged in during period", metrics["users_logged_in"]),
        ("Users without an assigned coach", metrics["users_without_coach"]),
        ("Total alarms", metrics["total_alarms"]),
        ("Active alarms", metrics["active_alarms"]),
        ("Challenge sessions generated", metrics["total_challenges"]),
        ("Challenge sessions completed", metrics["completed_challenges"]),
        ("Challenge completion rate (%)", metrics["challenge_completion_rate"]),
        ("Challenge answer accuracy (%)", metrics["platform_accuracy"]),
        ("Average habit score", metrics["platform_avg_habit_score"]),
        ("Habit score sample size", metrics["habit_score_sample_size"]),
        ("Snooze events in period", activity["total_snoozes"]),
        ("Wake completion events in period", activity["total_completions"]),
        ("Recommendation outcomes recorded", metrics["recommendation_activity"]["generated"]),
    ]
    for row in summary_rows:
        summary.append(list(row))
    for sheet in workbook.worksheets:
        sheet.freeze_panes = "A5"
        sheet.column_dimensions["A"].width = 38
        sheet.column_dimensions["B"].width = 28
        for cell in sheet[1]:
            cell.font = Font(bold=True, size=14, color="1E3A8A")
        for cell in sheet[4]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")

    activity_sheet = workbook.create_sheet("Daily Activity")
    activity_sheet.append(["Date", "Triggers", "Completions", "Snoozes", "All activity events"])
    for item in metrics["activity_trend"]:
        activity_sheet.append([
            item["date"], item["triggers"], item["completions"], item["snoozes"], item["events"],
        ])
    login_sheet = workbook.create_sheet("Daily Logins")
    login_sheet.append(["Date", "Successful logins", "Distinct users"])
    for item in metrics["login_trend"]:
        login_sheet.append([item["date"], item["logins"], item["users"]])
    difficulty_sheet = workbook.create_sheet("Challenge Difficulty")
    difficulty_sheet.append(["Difficulty", "Generated challenge questions"])
    for item in metrics["difficulty_distribution"]:
        difficulty_sheet.append([item["difficulty"], item["count"]])
    challenge_sheet = workbook.create_sheet("Challenge Performance")
    challenge_sheet.append(["Date", "Generated questions", "Answered", "Correct", "Accuracy (%)"])
    for item in metrics["challenge_trend"]:
        challenge_sheet.append([
            item["date"], item["generated"], item["answered"], item["correct"], item["accuracy"],
        ])
    recommendation_sheet = workbook.create_sheet("Recommendations")
    recommendation_sheet.append(["Generated", "Acted upon", "Dismissed"])
    recommendation = metrics["recommendation_activity"]
    recommendation_sheet.append([
        recommendation["generated"], recommendation["acted_upon"], recommendation["dismissed"],
    ])
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return output


def build_platform_pdf(metrics):
    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph("Cognitive Alarm Platform Analytics", styles["Title"]),
        Paragraph(
            f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} · "
            f"Period: {metrics['period']['start_date']} to {metrics['period']['end_date']}",
            styles["Normal"],
        ),
        Spacer(1, 16),
    ]
    activity = metrics["activity_summary"]
    values = [
        ["Metric", "Value"],
        ["Registered users", str(metrics["total_users"])],
        ["Active users in period", str(metrics["active_users"])],
        ["Successful logins in period", str(metrics["successful_logins"])],
        ["Users logged in during period", str(metrics["users_logged_in"])],
        ["Users without an assigned coach", str(metrics["users_without_coach"])],
        ["Total / active alarms", f"{metrics['total_alarms']} / {metrics['active_alarms']}"],
        ["Challenge sessions generated", str(metrics["total_challenges"])],
        ["Challenge sessions completed", str(metrics["completed_challenges"])],
        ["Challenge completion rate", f"{metrics['challenge_completion_rate']}%" if metrics["challenge_completion_rate"] is not None else "Not enough data yet"],
        ["Challenge accuracy", f"{metrics['platform_accuracy']}%" if metrics["platform_accuracy"] is not None else "Not enough data yet"],
        ["Average habit score", str(metrics["platform_avg_habit_score"]) if metrics["platform_avg_habit_score"] is not None else "Not enough data yet"],
        ["Habit score sample size", str(metrics["habit_score_sample_size"])],
        ["Snoozes / completions", f"{activity['total_snoozes']} / {activity['total_completions']}"],
        ["Recommendation generated / acted", f"{metrics['recommendation_activity']['generated']} / {metrics['recommendation_activity']['acted_upon']}"],
    ]
    table = Table(values, colWidths=[300, 180], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    elements.append(table)
    document.build(elements)
    output.seek(0)
    return output