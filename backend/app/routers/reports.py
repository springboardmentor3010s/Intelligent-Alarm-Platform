"""Reports & export (PDF / Excel) for habit, wake-up, challenge, productivity and sleep analytics."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models import User
from app.services import reports

router = APIRouter(prefix="/reports", tags=["Reports & Export"])
MEDIA = {"pdf": "application/pdf",
         "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}


def _respond(fmt: str, title, summary, sections, user, days, name):
    if fmt == "excel":
        content, ext = reports.to_excel(title, summary, sections), "xlsx"
    else:
        content, ext = reports.to_pdf(title, summary, sections, user, days), "pdf"
    return Response(content, media_type=MEDIA["excel" if ext == "xlsx" else "pdf"],
                    headers={"Content-Disposition": f'attachment; filename="wakeful_{name}_report.{ext}"'})


@router.get("/system")
def system_report(format: str = "pdf", admin: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    import pandas as pd
    from app.routers.admin import overview
    o = overview(admin, db)
    summary = [("Total users", o["users"]["total"]), ("Active alarms", o["alarms"]["active"]),
               ("Wake success rate (30d)", o["wake"]["success_rate"]), ("Challenge accuracy (30d)", o["challenges"]["accuracy"]),
               ("Avg habit score", o["avg_habit_score"])]
    sections = [("Users by role", pd.DataFrame([{"role": k, "users": v} for k, v in o["users"]["by_role"].items()])),
                ("Accuracy by difficulty", pd.DataFrame(o["challenges"]["by_difficulty"])),
                ("Signups (30d)", pd.DataFrame(o["signups"]))]
    return _respond(format, "System report", summary, sections, admin, 30, "system")


@router.get("/{kind}")
def export(kind: str, format: str = "pdf", days: int = 30, user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    if kind not in reports.KINDS:
        raise HTTPException(404, "Unknown report type.")
    if format not in ("pdf", "excel"):
        raise HTTPException(422, "format must be pdf or excel")
    days = max(1, min(days, 365))
    title, summary, sections = reports.build(db, user, kind, days)
    return _respond(format, title, summary, sections, user, days, kind)
