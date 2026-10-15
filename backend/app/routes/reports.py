from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import User
from app.schemas.reports import ReportSummaryResponse
from app.services.csv_exporter import generate_csv_report
from app.services.excel_exporter import generate_excel_report
from app.services.pdf_exporter import generate_pdf_report
from app.services.report_generator import get_demo_report_data, get_user_report_data
from app.utils.dependencies import get_current_user

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"],
)


# =====================================================================
# REAL USER REPORT ENDPOINTS (AUTHENTICATED & ISOLATED)
# =====================================================================

@router.get(
    "/data",
    response_model=ReportSummaryResponse,
    summary="Get aggregated performance report data for authenticated user",
)
def get_report_data_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns aggregated report data strictly isolated to the authenticated user.
    Never exposes other users' data, passwords, or raw challenge solutions.
    """
    data = get_user_report_data(current_user, db)
    return ReportSummaryResponse(**data)


@router.get(
    "/export/pdf",
    summary="Export authenticated user's report as PDF",
)
def export_pdf_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_user_report_data(current_user, db)
    pdf_buffer = generate_pdf_report(data)
    filename = f"Cognitive_Alarm_Report_{current_user.id}.pdf"
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/export/excel",
    summary="Export authenticated user's report as Excel (.xlsx)",
)
def export_excel_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_user_report_data(current_user, db)
    excel_buffer = generate_excel_report(data)
    filename = f"Cognitive_Alarm_Report_{current_user.id}.xlsx"
    return Response(
        content=excel_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/export/csv",
    summary="Export authenticated user's report as CSV (.csv)",
)
def export_csv_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_user_report_data(current_user, db)
    csv_buffer = generate_csv_report(data)
    filename = f"Cognitive_Alarm_Report_{current_user.id}.csv"
    return Response(
        content=csv_buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =====================================================================
# DEMO MODE REPORT ENDPOINTS (PREDEFINED SAMPLE DATA ONLY)
# =====================================================================

@router.get(
    "/demo/data",
    response_model=ReportSummaryResponse,
    summary="Get demo report data without database query",
)
def get_demo_report_data_endpoint():
    data = get_demo_report_data()
    return ReportSummaryResponse(**data)


@router.get(
    "/demo/export-pdf",
    summary="Export demo report as PDF with sample data banner",
)
def export_demo_pdf_endpoint():
    data = get_demo_report_data()
    pdf_buffer = generate_pdf_report(data)
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="Demo_Cognitive_Alarm_Report.pdf"'},
    )


@router.get(
    "/demo/export-excel",
    summary="Export demo report as Excel (.xlsx) with sample data banner",
)
def export_demo_excel_endpoint():
    data = get_demo_report_data()
    excel_buffer = generate_excel_report(data)
    return Response(
        content=excel_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Demo_Cognitive_Alarm_Report.xlsx"'},
    )


@router.get(
    "/demo/export-csv",
    summary="Export demo report as CSV (.csv) with sample data banner",
)
def export_demo_csv_endpoint():
    data = get_demo_report_data()
    csv_buffer = generate_csv_report(data)
    return Response(
        content=csv_buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="Demo_Cognitive_Alarm_Report.csv"'},
    )
