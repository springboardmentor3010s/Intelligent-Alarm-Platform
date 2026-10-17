# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Announcements API: user feed (active) and admin CRUD."""

from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..api.deps import require_roles
from ..schemas import AnnouncementOut

router = APIRouter(prefix="/announcements", tags=["announcements"])
admin_only = require_roles("Administrator")


def _now():
    return datetime.now(timezone.utc)


@router.get("/public", response_model=List[AnnouncementOut])
def list_public_announcements(db: Session = Depends(get_db), limit: int = Query(50, ge=1, le=200)): ...
