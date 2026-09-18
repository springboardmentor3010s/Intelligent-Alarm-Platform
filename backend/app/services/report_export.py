# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Report export helpers: CSV, PDF, and Excel (XLSX) streaming responses.

Used by the dashboard report endpoints. CSV output mirrors the previous
behavior exactly (empty record sets produce an empty body with no header).
"""

import csv
import io
from typing import List, Dict, Any, Optional

from fastapi.responses import StreamingResponse


def _media_and_ext(file_format: str):
    mapping = {
        "csv": ("text/csv", ".csv"),
        "pdf": ("application/pdf", ".pdf"),
        "excel": (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xlsx",
        ),
    }
    return mapping.get(file_format)


def export_report(
    records: List[Dict[str, Any]],
    file_format: str,
    base_name: str,
    title: Optional[str] = None,
) -> StreamingResponse:
    """Return a streaming file response for the requested format.

    Supported formats: csv, pdf, excel. Unknown formats raise ValueError so the
    endpoint can render its 422/400 error.
    """
    ext = _media_and_ext(file_format)

    if ext is None:
        raise ValueError(f"Unsupported export format: {file_format}")

    media_type, extension = ext
    filename = f"{base_name}{extension}"

    if file_format == "csv":
        output = io.StringIO()
        if records:
            writer = csv.DictWriter(output, fieldnames=list(records[0].keys()))
            writer.writeheader()
            writer.writerows(records)
        output.seek(0)
        content = output.getvalue().encode("utf-8")

    elif file_format == "pdf":
        content = _build_pdf(records, title or base_name)

    else:  # excel
        content = _build_xlsx(records)

    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _build_pdf(records: List[Dict[str, Any]], title: str) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.units import inch

    buf = io.BytesIO()

    header = list(records[0].keys()) if records else []
    rows = [
        [str(r.get(k, "")) for k in header]
        for r in records
    ]

    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
        title=title,
    )

    elements = [Paragraph(title, styles["Heading2"]), Spacer(1, 0.15 * inch)]

    if header:
        data = [header] + rows
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#22233a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9cbe3")),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f3fb")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No records in the selected range.", styles["BodyText"]))

    doc.build(elements)
    return buf.getvalue()


def _build_xlsx(records: List[Dict[str, Any]]) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "report"

    header = list(records[0].keys()) if records else []
    if header:
        ws.append(header)
    for r in records:
        ws.append([r.get(k, "") for k in header])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
