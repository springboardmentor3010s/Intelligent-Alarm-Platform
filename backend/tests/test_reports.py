import io

import openpyxl

from app.services import report_service

SAMPLE = {
    "type": "habit", "title": "Habit Report", "user": "Asha",
    "period": "2026-09-11 to 2026-10-11 (30 days)", "generated_at": "now",
    "summary": [("Habit score", 72.5), ("Sleep", None)],
    "tables": [
        {"title": "Daily wake-up results", "columns": ["Date", "Attempts"], "rows": [["2026-10-01", 2]]},
        {"title": "Empty", "columns": ["a"], "rows": []},
    ],
}


def test_pdf_and_excel_render():
    assert report_service.render_pdf(SAMPLE)[:4] == b"%PDF"
    workbook = openpyxl.load_workbook(io.BytesIO(report_service.render_xlsx(SAMPLE)))
    assert workbook.sheetnames == ["Summary", "Daily wake-up results", "Empty"]
    assert workbook["Summary"]["B7"].value == 72.5
