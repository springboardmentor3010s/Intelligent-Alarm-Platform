
import csv
import io
import math
from datetime import datetime, timedelta, timezone
from xml.sax.saxutils import escape

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import user_scope
from app.db.database import get_db
from app.models.coach_assignment import CoachAssignment
from app.models.user import User
from app.routes.admin import (
    bearer_scheme,
    password_hash,
    require_admin,
)
from app.services import dashboard_metrics as metrics
from app.services import report_service
from app.services import request_metrics

router = APIRouter(tags=["Dashboards"])
settings = get_settings()

COACH_ROLE = "coach"
ALLOWED_ROLES = {"user", COACH_ROLE, "admin"}


def _range(start, end, default_days=30):
    return metrics.resolve_range(start, end, default_days)


def _csv_response(rows: list[list], filename: str) -> StreamingResponse:
    buffer = io.StringIO()
    csv.writer(buffer).writerows(rows)

    return StreamingResponse(
        iter(["\ufeff" + buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


def _blank(value):
    return "" if value is None else value


# ---------------------------------------------------------
# USER DASHBOARD
# ---------------------------------------------------------

@router.get(
    "/dashboards/user/{user_id}",
    dependencies=[Depends(user_scope)],
)
def user_dashboard(
    user_id: int,
    start: str | None = None,
    end: str | None = None,
    window: int = Query(
        metrics.DEFAULT_TARGET_WINDOW_MINUTES,
        ge=1,
        le=180,
    ),
    db: Session = Depends(get_db),
):
    return metrics.user_dashboard(
        db,
        user_id,
        _range(start, end),
        window,
    )


# ---------------------------------------------------------
# COACH AUTHENTICATION
# ---------------------------------------------------------

class CoachLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


@router.post("/coach/login")
def coach_login(
    body: CoachLoginRequest,
    db: Session = Depends(get_db),
):
    if not settings.admin_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured.",
        )

    user = db.execute(
        select(User).where(
            func.lower(User.email)
            == str(body.email).strip().lower()
        )
    ).scalar_one_or_none()

    valid = False

    if (
        user is not None
        and user.role == COACH_ROLE
        and user.is_active
    ):
        try:
            valid = password_hash.verify(
                body.password,
                user.password_hash,
            )
        except Exception:
            valid = False

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    now = datetime.now(timezone.utc)
    minutes = settings.admin_token_expire_minutes

    token = jwt.encode(
        {
            "sub": str(user.id),
            "role": COACH_ROLE,
            "iat": now,
            "exp": now + timedelta(minutes=minutes),
        },
        settings.admin_jwt_secret,
        algorithm="HS256",
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": minutes * 60,
        "coach": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        },
    }


def require_coach(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not settings.admin_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured.",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.admin_jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )

        coach_id = int(payload["sub"])

    except (
        jwt.InvalidTokenError,
        ValueError,
        TypeError,
        KeyError,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    coach = db.get(User, coach_id)

    if (
        coach is None
        or coach.role != COACH_ROLE
        or not coach.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active wellness coach account is required.",
        )

    return coach


def _assigned_user_ids(
    db: Session,
    coach: User,
) -> list[int]:
    return list(
        db.execute(
            select(CoachAssignment.user_id).where(
                CoachAssignment.coach_id == coach.id
            )
        ).scalars()
    )


# ---------------------------------------------------------
# COACH DASHBOARD
# ---------------------------------------------------------

@router.get("/coach/me")
def coach_me(
    coach: User = Depends(require_coach),
):
    return {
        "id": coach.id,
        "full_name": coach.full_name,
        "email": coach.email,
        "role": coach.role,
    }


@router.get("/coach/dashboard")
def coach_dashboard(
    start: str | None = None,
    end: str | None = None,
    window: int = Query(
        metrics.DEFAULT_TARGET_WINDOW_MINUTES,
        ge=1,
        le=180,
    ),
    coach: User = Depends(require_coach),
    db: Session = Depends(get_db),
):
    return metrics.coach_overview(
        db,
        _assigned_user_ids(db, coach),
        _range(start, end),
        window,
    )


@router.get("/coach/users/{user_id}")
def coach_user_detail(
    user_id: int,
    start: str | None = None,
    end: str | None = None,
    window: int = Query(
        metrics.DEFAULT_TARGET_WINDOW_MINUTES,
        ge=1,
        le=180,
    ),
    coach: User = Depends(require_coach),
    db: Session = Depends(get_db),
):
    if user_id not in _assigned_user_ids(db, coach):
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    return metrics.user_dashboard(
        db,
        user_id,
        _range(start, end),
        window,
    )


# ---------------------------------------------------------
# COACH CSV REPORT
# ---------------------------------------------------------

@router.get("/coach/reports/export.csv")
def coach_report_csv(
    start: str | None = None,
    end: str | None = None,
    coach: User = Depends(require_coach),
    db: Session = Depends(get_db),
):
    rng = _range(start, end)

    data = metrics.coach_overview(
        db,
        _assigned_user_ids(db, coach),
        rng,
    )

    rows = [[
        "user_id",
        "name",
        "email",
        "habit_score",
        "habit_improvement",
        "wake_up_attempts",
        "wake_up_success_percent",
        "consistency_percent",
        "challenge_accuracy_percent",
        "challenge_completion_percent",
        "avg_response_seconds",
        "last_activity",
        "at_risk",
        "risk_reasons",
        "suggested_interventions",
    ]]

    for user in data["users"]:
        rows.append([
            user["user_id"],
            user["full_name"],
            user["email"],
            _blank(user["habit_score"]),
            _blank(user["habit_improvement"]),
            user["wake_up_attempts"],
            _blank(user["wake_up_success_rate_percent"]),
            _blank(user["consistency_percent"]),
            _blank(user["challenge_accuracy_percent"]),
            _blank(user["challenge_completion_percent"]),
            _blank(user["average_response_seconds"]),
            _blank(user["last_activity"]),
            "yes" if user["at_risk"] else "no",
            "; ".join(user["risk_reasons"]),
            "; ".join(user["interventions"]),
        ])

    return _csv_response(
        rows,
        f"coach_report_{rng.start_date}_{rng.end_date}.csv",
    )


# ---------------------------------------------------------
# COACH WELLNESS PDF REPORT WITH CHARTS
# ---------------------------------------------------------

@router.get("/coach/reports/export.pdf")
def coach_report_pdf(
    start: str | None = None,
    end: str | None = None,
    coach: User = Depends(require_coach),
    db: Session = Depends(get_db),
):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.lib.styles import (
        getSampleStyleSheet,
        ParagraphStyle,
    )
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
        PageBreak,
    )
    from reportlab.graphics.shapes import Drawing, String
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.charts.piecharts import Pie

    rng = _range(start, end)

    data = metrics.coach_overview(
        db,
        _assigned_user_ids(db, coach),
        rng,
    )

    overview = data.get("overview", {})
    users = data.get("users", [])
    at_risk_users = data.get("at_risk", [])
    sleep = data.get("sleep", {})
    sleep_trend = data.get("sleep_trend", [])
    guidance = data.get("guidance", [])

    buffer = io.BytesIO()

    page_width, page_height = landscape(A4)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=(page_width, page_height),
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title="Wellness Coach Report",
        author="Cognitive Alarm Platform",
    )

    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="CoachReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=23,
        leading=28,
        textColor=colors.HexColor("#174EA6"),
        alignment=TA_LEFT,
        spaceAfter=8,
    ))

    styles.add(ParagraphStyle(
        name="CoachReportSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#5B6472"),
        spaceAfter=10,
    ))

    styles.add(ParagraphStyle(
        name="CoachReportSection",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#174EA6"),
        spaceBefore=10,
        spaceAfter=8,
    ))

    styles.add(ParagraphStyle(
        name="CoachReportCell",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        wordWrap="CJK",
    ))

    styles.add(ParagraphStyle(
        name="CoachReportNote",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#596579"),
    ))

    story = []

    def safe_text(value, fallback="—"):
        if value is None or value == "":
            return fallback
        return escape(str(value))

    def numeric(value):
        if value is None:
            return None

        try:
            result = float(value)

            if not math.isfinite(result):
                return None

            return result

        except (TypeError, ValueError):
            return None

    def display_number(value, digits=1):
        result = numeric(value)

        if result is None:
            return "N/A"

        return f"{result:.{digits}f}"

    def display_percent(value):
        result = numeric(value)

        if result is None:
            return "N/A"

        return f"{result:.1f}%"

    def cell(value):
        return Paragraph(
            safe_text(value),
            styles["CoachReportCell"],
        )

    def make_table(rows, widths):
        table = Table(
            rows,
            colWidths=widths,
            repeatRows=1,
            hAlign="LEFT",
        )

        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0),
             colors.HexColor("#EAF1FC")),
            ("TEXTCOLOR", (0, 0), (-1, 0),
             colors.HexColor("#174EA6")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.35,
             colors.HexColor("#DCE3EE")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [
                colors.white,
                colors.HexColor("#F7F9FC"),
            ]),
        ]))

        return table

    # -----------------------------------------------------
    # 1. REPORT HEADER
    # -----------------------------------------------------

    story.append(Paragraph(
        "Wellness Coach Report",
        styles["CoachReportTitle"],
    ))

    story.append(Paragraph(
        f"Reporting period: {rng.start_date.isoformat()} "
        f"to {rng.end_date.isoformat()}<br/>"
        f"Prepared for: {safe_text(coach.full_name)}<br/>"
        "Cognitive Alarm Platform | Habit, wake-up and wellness analytics",
        styles["CoachReportSubtitle"],
    ))

    # -----------------------------------------------------
    # 2. EXECUTIVE SUMMARY
    # -----------------------------------------------------

    story.append(Paragraph(
        "Executive Summary",
        styles["CoachReportSection"],
    ))

    summary_rows = [
        [
            cell("Metric"),
            cell("Result"),
            cell("Metric"),
            cell("Result"),
        ],
        [
            cell("Users monitored"),
            cell(overview.get("users_monitored", len(users))),
            cell("Users at risk"),
            cell(overview.get("at_risk_count", len(at_risk_users))),
        ],
        [
            cell("Average habit score"),
            cell(display_percent(overview.get("average_habit_score"))),
            cell("Average wake-up success"),
            cell(display_percent(
                overview.get("average_wake_up_success_percent")
            )),
        ],
        [
            cell("Average consistency"),
            cell(display_percent(
                overview.get("overall_consistency_percent")
            )),
            cell("Challenge accuracy"),
            cell(display_percent(
                overview.get("average_challenge_accuracy_percent")
            )),
        ],
        [
            cell("Challenge completion"),
            cell(display_percent(
                overview.get("average_challenge_completion_percent")
            )),
            cell("Average response time"),
            cell(
                (
                    f"{display_number(overview.get('average_response_seconds'))} seconds"
                    if numeric(overview.get("average_response_seconds")) is not None
                    else "N/A"
                )
            ),
        ],
    ]

    story.append(make_table(
        summary_rows,
        [50 * mm, 40 * mm, 50 * mm, 40 * mm],
    ))

    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph(
        "Metrics reflect available records in the selected date range. "
        "N/A indicates unavailable data, not a score of zero.",
        styles["CoachReportNote"],
    ))

    # -----------------------------------------------------
    # 3. PERFORMANCE BAR CHART
    # -----------------------------------------------------

    story.append(Paragraph(
        "User Performance Comparison",
        styles["CoachReportSection"],
    ))

    if users:
        chart_users = sorted(
            users,
            key=lambda user: (
                numeric(user.get("habit_score"))
                if numeric(user.get("habit_score")) is not None
                else -1
            ),
            reverse=True,
        )[:10]

        def chart_value(user, key):
            value = numeric(user.get(key))

            if value is None:
                return 0

            return max(0, min(100, value))

        chart = VerticalBarChart()

        chart.x = 18 * mm
        chart.y = 16 * mm
        chart.width = 235 * mm
        chart.height = 60 * mm

        chart.data = [
            tuple(
                chart_value(user, "habit_score")
                for user in chart_users
            ),
            tuple(
                chart_value(user, "wake_up_success_rate_percent")
                for user in chart_users
            ),
            tuple(
                chart_value(user, "challenge_accuracy_percent")
                for user in chart_users
            ),
        ]

        chart.categoryAxis.categoryNames = [
            str(user.get("full_name") or "User")[:16]
            for user in chart_users
        ]

        chart.categoryAxis.labels.fontName = "Helvetica"
        chart.categoryAxis.labels.fontSize = 7
        chart.categoryAxis.labels.angle = 25
        chart.categoryAxis.labels.boxAnchor = "ne"

        chart.valueAxis.valueMin = 0
        chart.valueAxis.valueMax = 100
        chart.valueAxis.valueStep = 20
        chart.valueAxis.labels.fontSize = 7

        chart.groupSpacing = 8
        chart.barSpacing = 2

        chart.bars[0].fillColor = colors.HexColor("#3578E5")
        chart.bars[1].fillColor = colors.HexColor("#22A699")
        chart.bars[2].fillColor = colors.HexColor("#F2A541")

        chart_drawing = Drawing(260 * mm, 90 * mm)
        chart_drawing.add(chart)

        story.append(chart_drawing)

        story.append(Paragraph(
            "Legend: Habit score, wake-up success and challenge accuracy. "
            "The chart shows up to ten users with the highest available "
            "habit scores. Missing chart values are plotted as zero; "
            "the detailed table identifies unavailable values as N/A.",
            styles["CoachReportNote"],
        ))

    else:
        story.append(Paragraph(
            "No assigned users were found for this reporting period.",
            styles["Normal"],
        ))

    # -----------------------------------------------------
    # 4. RISK DISTRIBUTION PIE CHART
    # -----------------------------------------------------

    story.append(Paragraph(
        "Wellness Status Distribution",
        styles["CoachReportSection"],
    ))

    if users:
        risk_count = sum(
            1 for user in users if user.get("at_risk")
        )
        on_track_count = len(users) - risk_count

        drawing = Drawing(230 * mm, 65 * mm)

        pie = Pie()
        pie.x = 15 * mm
        pie.y = 3 * mm
        pie.width = 48 * mm
        pie.height = 48 * mm
        pie.data = [on_track_count, risk_count]
        pie.labels = []

        pie.slices[0].fillColor = colors.HexColor("#22A699")
        pie.slices[1].fillColor = colors.HexColor("#E05260")
        pie.slices.strokeColor = colors.white
        pie.slices.strokeWidth = 1

        drawing.add(pie)

        drawing.add(String(
            80 * mm,
            38 * mm,
            f"On track: {on_track_count}",
            fontName="Helvetica-Bold",
            fontSize=12,
            fillColor=colors.HexColor("#168A7C"),
        ))

        drawing.add(String(
            80 * mm,
            23 * mm,
            f"At risk: {risk_count}",
            fontName="Helvetica-Bold",
            fontSize=12,
            fillColor=colors.HexColor("#D33F49"),
        ))

        drawing.add(String(
            80 * mm,
            8 * mm,
            f"Total users: {len(users)}",
            fontName="Helvetica",
            fontSize=10,
        ))

        story.append(drawing)

    else:
        story.append(Paragraph(
            "No user records are available for this chart.",
            styles["Normal"],
        ))

    # -----------------------------------------------------
    # 5. HABIT SCORE DISTRIBUTION PIE CHART
    # -----------------------------------------------------

    story.append(Paragraph(
        "Habit Score Distribution",
        styles["CoachReportSection"],
    ))

    habit_bands = [
        ("0–39", 0, 40),
        ("40–59", 40, 60),
        ("60–79", 60, 80),
        ("80–100", 80, 101),
    ]

    band_counts = []

    for label, lower, upper in habit_bands:
        count = 0

        for user in users:
            score = numeric(user.get("habit_score"))

            if score is not None and lower <= score < upper:
                count += 1

        band_counts.append((label, count))

    if users:
        drawing = Drawing(230 * mm, 65 * mm)

        pie = Pie()
        pie.x = 15 * mm
        pie.y = 3 * mm
        pie.width = 48 * mm
        pie.height = 48 * mm
        pie.data = [
            count for _, count in band_counts
        ]
        pie.labels = []

        band_colors = [
            "#E05260",
            "#F2A541",
            "#3578E5",
            "#22A699",
        ]

        for index, color in enumerate(band_colors):
            pie.slices[index].fillColor = colors.HexColor(color)

        pie.slices.strokeColor = colors.white
        pie.slices.strokeWidth = 1

        drawing.add(pie)

        for index, (label, count) in enumerate(band_counts):
            drawing.add(String(
                80 * mm,
                (42 - index * 12) * mm,
                f"Habit score {label}: {count} users",
                fontName="Helvetica",
                fontSize=9,
                fillColor=colors.HexColor(band_colors[index]),
            ))

        story.append(drawing)

        story.append(Paragraph(
            "Users without an available habit score are excluded from "
            "the distribution.",
            styles["CoachReportNote"],
        ))

    else:
        story.append(Paragraph(
            "No habit scores are available.",
            styles["Normal"],
        ))

    # -----------------------------------------------------
    # 6. DETAILED USER TABLE
    # -----------------------------------------------------

    story.append(PageBreak())

    story.append(Paragraph(
        "Detailed User Performance",
        styles["CoachReportSection"],
    ))

    user_rows = [[
        cell("Name"),
        cell("Habit"),
        cell("Change"),
        cell("Wake attempts"),
        cell("Wake success"),
        cell("Consistency"),
        cell("Challenge accuracy"),
        cell("Last activity"),
        cell("Status"),
    ]]

    for user in users:
        change = numeric(user.get("habit_improvement"))

        change_text = (
            "N/A"
            if change is None
            else f"{change:+.1f}"
        )

        user_rows.append([
            cell(user.get("full_name")),
            cell(display_percent(user.get("habit_score"))),
            cell(change_text),
            cell(user.get("wake_up_attempts", 0)),
            cell(display_percent(
                user.get("wake_up_success_rate_percent")
            )),
            cell(display_percent(
                user.get("consistency_percent")
            )),
            cell(display_percent(
                user.get("challenge_accuracy_percent")
            )),
            cell(user.get("last_activity")),
            cell(
                "At risk"
                if user.get("at_risk")
                else "On track"
            ),
        ])

    if len(user_rows) == 1:
        story.append(Paragraph(
            "No assigned users were found for this reporting period.",
            styles["Normal"],
        ))
    else:
        story.append(make_table(
            user_rows,
            [
                36 * mm,
                17 * mm,
                16 * mm,
                19 * mm,
                21 * mm,
                21 * mm,
                25 * mm,
                33 * mm,
                18 * mm,
            ],
        ))

    # -----------------------------------------------------
    # 7. USERS REQUIRING ATTENTION
    # -----------------------------------------------------

    story.append(Paragraph(
        "Users Requiring Attention",
        styles["CoachReportSection"],
    ))

    if at_risk_users:
        risk_rows = [[
            cell("User"),
            cell("Risk factors"),
            cell("Suggested interventions"),
        ]]

        for user in at_risk_users:
            reasons = user.get("risk_reasons") or []
            interventions = user.get("interventions") or []

            risk_rows.append([
                cell(user.get("full_name")),
                Paragraph(
                    "<br/>".join(
                        safe_text(reason) for reason in reasons
                    ) if reasons else "No risk details provided",
                    styles["CoachReportCell"],
                ),
                Paragraph(
                    "<br/>".join(
                        safe_text(item) for item in interventions
                    ) if interventions else
                    "No intervention suggestions available",
                    styles["CoachReportCell"],
                ),
            ])

        story.append(make_table(
            risk_rows,
            [48 * mm, 90 * mm, 90 * mm],
        ))

    else:
        story.append(Paragraph(
            "No users are currently flagged as at risk in the available data.",
            styles["Normal"],
        ))

    # -----------------------------------------------------
    # 8. SLEEP AND WELLNESS SUMMARY
    # -----------------------------------------------------

    story.append(Paragraph(
        "Sleep and Wellness Summary",
        styles["CoachReportSection"],
    ))

    if sleep.get("available"):
        sleep_rows = [
            [
                cell("Metric"),
                cell("Value"),
            ],
            [
                cell("Users with sleep logs"),
                cell(sleep.get("users_with_sleep_logs", "N/A")),
            ],
            [
                cell("Average sleep adherence"),
                cell(display_percent(
                    sleep.get("average_adherence_percent")
                )),
            ],
            [
                cell("Average sleep duration (minutes)"),
                cell(display_number(
                    sleep.get("average_duration_minutes"), 0
                )),
            ],
        ]

        story.append(make_table(
            sleep_rows,
            [85 * mm, 55 * mm],
        ))

    else:
        story.append(Paragraph(
            "Sleep analytics are unavailable for this reporting period. "
            + safe_text(
                sleep.get(
                    "reason",
                    "No sleep records were provided.",
                )
            ),
            styles["Normal"],
        ))

    # -----------------------------------------------------
    # 9. SLEEP TREND REPORT
    # -----------------------------------------------------

    logged_nights = [d for d in sleep_trend if d.get("nights_logged")]

    if logged_nights:
        story.append(Spacer(1, 5 * mm))
        story.append(Paragraph(
            "Sleep Trend Report",
            styles["CoachReportSection"],
        ))

        trend_rows = [[
            cell("Date"),
            cell("Nights logged"),
            cell("Avg sleep (min)"),
            cell("On schedule %"),
        ]]

        for day in logged_nights:
            trend_rows.append([
                cell(day.get("date")),
                cell(day.get("nights_logged")),
                cell(display_number(day.get("average_duration_minutes"), 0)),
                cell(display_percent(day.get("on_schedule_percent"))),
            ])

        story.append(make_table(
            trend_rows,
            [45 * mm, 40 * mm, 45 * mm, 45 * mm],
        ))

    # -----------------------------------------------------
    # 10. RECOMMENDATIONS
    # -----------------------------------------------------

    if guidance:
        story.append(Spacer(1, 5 * mm))
        story.append(Paragraph(
            "Recommendations",
            styles["CoachReportSection"],
        ))

        guidance_rows = [[
            cell("Category"),
            cell("Recommendation"),
            cell("Detail"),
        ]]

        for item in guidance:
            guidance_rows.append([
                cell(str(item.get("category", "general")).replace("_", " ").title()),
                cell(item.get("title")),
                cell(item.get("detail")),
            ])

        story.append(make_table(
            guidance_rows,
            [30 * mm, 70 * mm, 155 * mm],
        ))

    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph(
        "Methodology: Metrics are calculated from the platform's available "
        "records for the selected date range. Only users assigned to the "
        "authenticated coach are included. This report supports wellness "
        "monitoring and is not a medical diagnosis.",
        styles["CoachReportNote"],
    ))

    # -----------------------------------------------------
    # PAGE FOOTERS
    # -----------------------------------------------------

    def add_page_number(canvas, document):
        canvas.saveState()

        canvas.setStrokeColor(
            colors.HexColor("#DCE3EE")
        )

        canvas.line(
            12 * mm,
            10 * mm,
            page_width - 12 * mm,
            10 * mm,
        )

        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(
            colors.HexColor("#687386")
        )

        canvas.drawString(
            12 * mm,
            6 * mm,
            "Cognitive Alarm Platform | Wellness Report",
        )

        canvas.drawRightString(
            page_width - 12 * mm,
            6 * mm,
            f"Page {document.page}",
        )

        canvas.restoreState()

    doc.build(
        story,
        onFirstPage=add_page_number,
        onLaterPages=add_page_number,
    )

    filename = (
        f"wellness_coach_report_"
        f"{rng.start_date}_{rng.end_date}.pdf"
    )

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )


# ---------------------------------------------------------
# ADMIN ANALYTICS
# ---------------------------------------------------------

@router.get("/admin/dashboard-analytics")
def admin_dashboard_analytics(
    start: str | None = None,
    end: str | None = None,
    window: int = Query(
        metrics.DEFAULT_TARGET_WINDOW_MINUTES,
        ge=1,
        le=180,
    ),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rng = _range(start, end)

    snapshot = request_metrics.snapshot(
        rng.start,
        rng.end,
    )

    return metrics.admin_analytics(
        db,
        rng,
        snapshot,
        window,
    )


@router.get("/admin/dashboard-analytics/export.csv")
def admin_export_csv(
    start: str | None = None,
    end: str | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rng = _range(start, end)

    data = metrics.admin_analytics(
        db,
        rng,
        request_metrics.snapshot(rng.start, rng.end),
    )

    rows: list[list] = [
        ["Cognitive Alarm platform report"],
        [
            "period_start",
            rng.start_date.isoformat(),
            "period_end",
            rng.end_date.isoformat(),
        ],
        [],
        ["section", "metric", "value"],
    ]

    def add(section, pairs):
        for name, value in pairs:
            rows.append([
                section,
                name,
                _blank(value),
            ])

    add("platform", data["platform"].items())

    add("users", [
        (
            "registrations_in_period",
            data["users"]["registrations_in_period"],
        )
    ])

    add("alarms", [
        (key, data["alarms"][key])
        for key in (
            "created_in_period",
            "enabled",
            "disabled",
            "successful_dismissals",
        )
    ])

    add("wake_up", [
        (key, data["wake_up"][key])
        for key in (
            "attempts",
            "successful",
            "verification_success_rate_percent",
            "average_response_seconds",
        )
    ])

    add("challenges", [
        (key, data["challenges"][key])
        for key in (
            "attempts",
            "correct",
            "accuracy_percent",
            "completion_percent",
            "average_response_seconds",
        )
    ])

    add("habit", [
        (key, data["habit"][key])
        for key in (
            "users_scored",
            "average_habit_score",
            "average_improvement",
        )
    ])

    if data["system"].get("available"):
        add("system", [
            (
                "api_avg_ms",
                data["system"]["overall"]["avg_ms"],
            ),
            (
                "api_p95_ms",
                data["system"]["overall"]["p95_ms"],
            ),
        ])

    rows += [
        [],
        [
            "date",
            "new_users",
            "wake_attempts",
            "wake_successful",
            "challenge_attempts",
        ],
    ]

    registrations = {
        row["date"]: row["count"]
        for row in data["users"]["registration_trend"]
    }

    challenges = {
        row["date"]: row["attempts"]
        for row in data["challenges"]["daily"]
    }

    for wake in data["wake_up"]["daily"]:
        rows.append([
            wake["date"],
            registrations.get(wake["date"], 0),
            wake["attempts"],
            wake["successful"],
            challenges.get(wake["date"], 0),
        ])

    return _csv_response(
        rows,
        f"platform_report_{rng.start_date}_{rng.end_date}.csv",
    )


def _platform_report(
    db: Session,
    start: str | None,
    end: str | None,
) -> tuple[dict, str]:
    rng = _range(start, end)

    data = metrics.admin_analytics(
        db,
        rng,
        request_metrics.snapshot(rng.start, rng.end),
    )

    return (
        report_service.build_platform_report(data),
        f"platform_report_{rng.start_date}_{rng.end_date}",
    )


@router.get("/admin/dashboard-analytics/export.pdf")
def admin_export_pdf(
    start: str | None = None,
    end: str | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    report, name = _platform_report(
        db,
        start,
        end,
    )

    return Response(
        content=report_service.render_pdf(report),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{name}.pdf"'
        },
    )


@router.get("/admin/dashboard-analytics/export.xlsx")
def admin_export_xlsx(
    start: str | None = None,
    end: str | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    report, name = _platform_report(
        db,
        start,
        end,
    )

    return Response(
        content=report_service.render_xlsx(report),
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": f'attachment; filename="{name}.xlsx"'
        },
    )


# ---------------------------------------------------------
# ADMIN: ROLES AND COACH ASSIGNMENTS
# ---------------------------------------------------------

class RoleUpdate(BaseModel):
    role: str


class AssignmentCreate(BaseModel):
    coach_id: int
    user_id: int


@router.patch("/admin/users/{user_id}/role")
def update_user_role(
    user_id: int,
    body: RoleUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    role = body.role.strip().lower()

    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Role must be one of: "
                f"{', '.join(sorted(ALLOWED_ROLES))}."
            ),
        )

    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    if user.id == admin.id and role != "admin":
        raise HTTPException(
            status_code=400,
            detail="You cannot remove your own admin role.",
        )

    user.role = role
    db.commit()

    return {
        "id": user.id,
        "role": user.role,
        "message": "User role updated.",
    }


@router.get("/admin/coach-assignments")
def list_assignments(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(CoachAssignment).order_by(
            CoachAssignment.coach_id,
            CoachAssignment.user_id,
        )
    ).scalars().all()

    names = {
        user.id: user
        for user in db.execute(select(User)).scalars()
    }

    def label(user_id):
        user = names.get(user_id)

        return {
            "id": user_id,
            "full_name": user.full_name if user else "Unknown",
            "email": user.email if user else "",
        }

    return {
        "items": [
            {
                "id": row.id,
                "coach": label(row.coach_id),
                "user": label(row.user_id),
            }
            for row in rows
        ]
    }


@router.post(
    "/admin/coach-assignments",
    status_code=201,
)
def create_assignment(
    body: AssignmentCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coach = db.get(User, body.coach_id)
    user = db.get(User, body.user_id)

    if coach is None or coach.role != COACH_ROLE:
        raise HTTPException(
            status_code=400,
            detail=(
                "coach_id must belong to a user "
                "with the coach role."
            ),
        )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    if coach.id == user.id:
        raise HTTPException(
            status_code=400,
            detail="A coach cannot monitor their own account.",
        )

    db.add(
        CoachAssignment(
            coach_id=coach.id,
            user_id=user.id,
        )
    )

    try:
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="This assignment already exists.",
        )

    return {
        "message": "Assignment created."
    }


@router.delete("/admin/coach-assignments/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.get(CoachAssignment, assignment_id)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found.",
        )

    db.delete(row)
    db.commit()

    return {
        "message": "Assignment removed."
    }
