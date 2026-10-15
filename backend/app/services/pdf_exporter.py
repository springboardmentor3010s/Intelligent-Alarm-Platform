import io
from typing import Any, Dict
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def generate_pdf_report(data: Dict[str, Any]) -> io.BytesIO:
    """
    Generates a structured, professional PDF report from the aggregated report data.
    Returns an in-memory BytesIO buffer containing the PDF bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    header_style = ParagraphStyle(
        "ReportHeader",
        parent=styles["Heading1"],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4,
    )
    sub_header_style = ParagraphStyle(
        "ReportSubHeader",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
    )
    section_title_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1e293b"),
    )
    body_bold = ParagraphStyle(
        "BodyBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1e293b"),
    )
    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=table_cell_style,
        fontName="Helvetica-Bold",
    )
    demo_banner_style = ParagraphStyle(
        "DemoBanner",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#b45309"),
        fontName="Helvetica-Bold",
        alignment=1,  # Center
    )

    elements = []

    # Demo Banner if applicable
    if data.get("is_demo"):
        demo_table = Table(
            [[Paragraph("DEMO REPORT &mdash; SAMPLE DATA (READ-ONLY)", demo_banner_style)]],
            colWidths=[540],
        )
        demo_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef3c7")),
                ("BORDER", (0, 0), (-1, -1), 1, colors.HexColor("#f59e0b")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ])
        )
        elements.append(demo_table)
        elements.append(Spacer(1, 10))

    # Header Title & Metadata
    elements.append(Paragraph("Intelligent Cognitive Alarm", header_style))
    elements.append(
        Paragraph("Performance, Habit &amp; Cognitive Analytics Report", sub_header_style)
    )
    elements.append(Spacer(1, 6))

    meta_text = (
        f"<b>User:</b> {data.get('user_name', 'User')} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Email:</b> {data.get('user_email', 'N/A')} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Generated:</b> {data.get('generated_at', 'N/A')}"
    )
    elements.append(Paragraph(meta_text, sub_header_style))
    elements.append(Spacer(1, 8))
    elements.append(
        HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#cbd5e1"), spaceAfter=12)
    )

    # 1. Habit Report Section
    habit = data.get("habit_report", {})
    elements.append(Paragraph("1. Habit Performance &amp; Consistency", section_title_style))

    habit_table_data = [
        [
            Paragraph("Metric", table_cell_bold),
            Paragraph("Score / Value", table_cell_bold),
            Paragraph("Metric", table_cell_bold),
            Paragraph("Score / Value", table_cell_bold),
        ],
        [
            Paragraph("Overall Habit Score", table_cell_style),
            Paragraph(f"<b>{habit.get('overall_habit_score', 0):.1f} / 100</b>", table_cell_style),
            Paragraph("Wake-Up Consistency", table_cell_style),
            Paragraph(f"{habit.get('wake_up_consistency', 0):.1f}%", table_cell_style),
        ],
        [
            Paragraph("Challenge Completion", table_cell_style),
            Paragraph(f"{habit.get('challenge_completion', 0):.1f}%", table_cell_style),
            Paragraph("Snooze Reduction Score", table_cell_style),
            Paragraph(f"{habit.get('snooze_reduction', 0):.1f}%", table_cell_style),
        ],
        [
            Paragraph("Sleep Schedule Adherence", table_cell_style),
            Paragraph(f"{habit.get('sleep_schedule_adherence', 0):.1f}%", table_cell_style),
            Paragraph("Sessions Evaluated", table_cell_style),
            Paragraph(str(habit.get("sessions_evaluated", 0)), table_cell_style),
        ],
        [
            Paragraph("Average Snooze Count", table_cell_style),
            Paragraph(f"{habit.get('average_snooze_count', 0):.2f}", table_cell_style),
            Paragraph("-", table_cell_style),
            Paragraph("-", table_cell_style),
        ],
    ]

    habit_tbl = Table(habit_table_data, colWidths=[150, 120, 150, 120])
    habit_tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    elements.append(habit_tbl)
    elements.append(Spacer(1, 10))

    # 2. Wake-Up Performance Section
    wake = data.get("wake_up_report", {})
    elements.append(Paragraph("2. Wake-Up Performance", section_title_style))

    status_breakdown = wake.get("status_breakdown", {})
    status_str = ", ".join(f"{k.capitalize()}: {v}" for k, v in sorted(status_breakdown.items())) or "None"

    wake_table_data = [
        [
            Paragraph("Metric", table_cell_bold),
            Paragraph("Value", table_cell_bold),
            Paragraph("Metric", table_cell_bold),
            Paragraph("Value", table_cell_bold),
        ],
        [
            Paragraph("Total Alarm Sessions", table_cell_style),
            Paragraph(str(wake.get("total_sessions", 0)), table_cell_style),
            Paragraph("Wake-Up Consistency", table_cell_style),
            Paragraph(f"{wake.get('wake_up_consistency', 0):.1f}%", table_cell_style),
        ],
        [
            Paragraph("Successful Dismissals", table_cell_style),
            Paragraph(str(wake.get("successful_dismissals", 0)), table_cell_style),
            Paragraph("Total Snoozes Used", table_cell_style),
            Paragraph(str(wake.get("total_snoozes", 0)), table_cell_style),
        ],
        [
            Paragraph("Average Response Time", table_cell_style),
            Paragraph(f"{wake.get('average_response_time', 0):.1f} s", table_cell_style),
            Paragraph("Session Status Breakdown", table_cell_style),
            Paragraph(status_str, table_cell_style),
        ],
    ]

    wake_tbl = Table(wake_table_data, colWidths=[150, 120, 150, 120])
    wake_tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    elements.append(wake_tbl)
    elements.append(Spacer(1, 10))

    # 3. Cognitive Challenge Performance Section
    challenge = data.get("challenge_report", {})
    elements.append(Paragraph("3. Cognitive Challenge Performance", section_title_style))

    chal_overview_data = [
        [
            Paragraph("Total Challenges", table_cell_bold),
            Paragraph("Completed", table_cell_bold),
            Paragraph("Completion Rate", table_cell_bold),
            Paragraph("Correct", table_cell_bold),
            Paragraph("Incorrect", table_cell_bold),
            Paragraph("Accuracy Rate", table_cell_bold),
        ],
        [
            Paragraph(str(challenge.get("total_challenges", 0)), table_cell_style),
            Paragraph(str(challenge.get("completed_challenges", 0)), table_cell_style),
            Paragraph(f"{challenge.get('completion_percentage', 0):.1f}%", table_cell_style),
            Paragraph(str(challenge.get("correct_answers", 0)), table_cell_style),
            Paragraph(str(challenge.get("incorrect_answers", 0)), table_cell_style),
            Paragraph(f"{challenge.get('accuracy_percentage', 0):.1f}%", table_cell_style),
        ],
    ]

    chal_tbl = Table(chal_overview_data, colWidths=[90, 90, 90, 90, 90, 90])
    chal_tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    elements.append(chal_tbl)
    elements.append(Spacer(1, 6))

    # Breakdown by Challenge Type & Difficulty
    types = challenge.get("challenge_types", [])
    if types:
        elements.append(Paragraph("<b>Breakdown by Challenge Type:</b>", body_style))
        elements.append(Spacer(1, 4))
        type_tbl_data = [[
            Paragraph("Type", table_cell_bold),
            Paragraph("Total", table_cell_bold),
            Paragraph("Correct", table_cell_bold),
            Paragraph("Incorrect", table_cell_bold),
            Paragraph("Accuracy", table_cell_bold),
        ]]
        for t in types:
            type_tbl_data.append([
                Paragraph(str(t.get("challenge_type", "")), table_cell_style),
                Paragraph(str(t.get("total", 0)), table_cell_style),
                Paragraph(str(t.get("correct", 0)), table_cell_style),
                Paragraph(str(t.get("incorrect", 0)), table_cell_style),
                Paragraph(f"{t.get('accuracy', 0):.1f}%", table_cell_style),
            ])
        t_tbl = Table(type_tbl_data, colWidths=[140, 100, 100, 100, 100])
        t_tbl.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ])
        )
        elements.append(t_tbl)
        elements.append(Spacer(1, 6))

    diffs = challenge.get("difficulty_levels", [])
    if diffs:
        elements.append(Paragraph("<b>Breakdown by Difficulty Level:</b>", body_style))
        elements.append(Spacer(1, 4))
        diff_tbl_data = [[
            Paragraph("Difficulty", table_cell_bold),
            Paragraph("Total", table_cell_bold),
            Paragraph("Correct", table_cell_bold),
            Paragraph("Incorrect", table_cell_bold),
            Paragraph("Accuracy", table_cell_bold),
        ]]
        for d in diffs:
            diff_tbl_data.append([
                Paragraph(str(d.get("difficulty", "")), table_cell_style),
                Paragraph(str(d.get("total", 0)), table_cell_style),
                Paragraph(str(d.get("correct", 0)), table_cell_style),
                Paragraph(str(d.get("incorrect", 0)), table_cell_style),
                Paragraph(f"{d.get('accuracy', 0):.1f}%", table_cell_style),
            ])
        d_tbl = Table(diff_tbl_data, colWidths=[140, 100, 100, 100, 100])
        d_tbl.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ])
        )
        elements.append(d_tbl)
        elements.append(Spacer(1, 10))

    # 4. Sleep & Schedule Adherence Section
    sleep = data.get("sleep_adherence_report", {})
    elements.append(Paragraph("4. Sleep &amp; Schedule Adherence", section_title_style))

    sleep_table_data = [
        [
            Paragraph("Parameter", table_cell_bold),
            Paragraph("Value / Details", table_cell_bold),
        ],
        [
            Paragraph("Preferred Wake Time", table_cell_style),
            Paragraph(str(sleep.get("preferred_wake_time", "Not available")), table_cell_style),
        ],
        [
            Paragraph("Target Sleep Duration", table_cell_style),
            Paragraph(str(sleep.get("sleep_duration", "Not available")), table_cell_style),
        ],
        [
            Paragraph("Sleep Schedule Adherence", table_cell_style),
            Paragraph(f"{sleep.get('sleep_schedule_adherence', 0):.1f}%", table_cell_style),
        ],
        [
            Paragraph("Schedule Alignment", table_cell_style),
            Paragraph(str(sleep.get("schedule_alignment", "Not available")), table_cell_style),
        ],
    ]

    sleep_tbl = Table(sleep_table_data, colWidths=[180, 360])
    sleep_tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    elements.append(sleep_tbl)
    elements.append(Spacer(1, 10))

    # 5. Productivity Report Section
    prod = data.get("productivity_report", {})
    elements.append(Paragraph("5. Productivity Report", section_title_style))

    if prod.get("has_productivity_data"):
        prod_table_data = [
            [
                Paragraph("Productivity Goals Status", table_cell_bold),
                Paragraph(str(prod.get("status", "Configured")), table_cell_style),
            ],
            [
                Paragraph("Configured Goals", table_cell_bold),
                Paragraph(str(prod.get("productivity_goals", "")), table_cell_style),
            ],
        ]
        prod_tbl = Table(prod_table_data, colWidths=[180, 360])
        prod_tbl.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ])
        )
        elements.append(prod_tbl)
    else:
        elements.append(
            Paragraph(
                "<i>Productivity data is not available yet. "
                "Define your productivity goals in your Habit settings to generate productivity insights.</i>",
                body_style,
            )
        )

    # Footer note
    elements.append(Spacer(1, 18))
    elements.append(
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=6)
    )
    footer_text = (
        "Report generated by Intelligent Cognitive Alarm Platform. "
        "User metrics are strictly isolated and private."
    )
    elements.append(Paragraph(footer_text, sub_header_style))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
