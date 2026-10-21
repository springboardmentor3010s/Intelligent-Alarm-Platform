"""
reports.py

FastAPI router for generating and downloading structured
PDF and Excel reports for the AI Intelligent Cognitive Alarm Platform.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.report_service import build_excel, build_pdf
from ..utils.deps import get_current_user


router = APIRouter(
    prefix="/api/reports",
    tags=["Reports & Export"],
)


@router.get("/types")
def get_report_types():
    """
    Return available report types and descriptions.
    """
    return [
        {
            "id": "comprehensive",
            "name": "Comprehensive Health & Habit Report",
            "description": "Full executive overview including 4-pillar habit scoring, XGBoost readiness, alarm schedule, and recommendations.",
        },
        {
            "id": "habit",
            "name": "Habit & Consistency Report",
            "description": "Detailed breakdown of wake consistency, streaks, and schedule adherence.",
        },
        {
            "id": "challenge",
            "name": "Cognitive Challenge Analytics",
            "description": "Historical challenge accuracy, response times, and adaptive difficulty transitions.",
        },
        {
            "id": "sleep",
            "name": "Sleep & Wake Schedule Analytics",
            "description": "Target sleep adherence, bedtimes, and snooze avoidance telemetry.",
        },
    ]


@router.get("/pdf")
@router.get("/alarms.pdf")
def export_pdf(
    report_type: Optional[str] = Query("comprehensive"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Generate and stream an executive publication-grade PDF report.
    """
    stream = build_pdf(db, user, report_type=report_type)
    filename = f"cognitive_alarm_{report_type}_report.pdf"

    return StreamingResponse(
        stream,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/excel")
@router.get("/alarms.xlsx")
def export_excel(
    report_type: Optional[str] = Query("comprehensive"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Generate and stream a multi-sheet Microsoft Excel (.xlsx) workbook.
    """
    stream = build_excel(db, user, report_type=report_type)
    filename = f"cognitive_alarm_{report_type}_report.xlsx"

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )