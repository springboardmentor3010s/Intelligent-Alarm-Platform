# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Announcements API: public active feed + admin CRUD (Module 11)."""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..api.deps import require_roles
from ..database import get_db
from ..Models import Announcement, User
from ..schemas import AnnouncementCreateReq, AnnouncementOut, AnnouncementUpdateReq

router = APIRouter(prefix="/announcements", tags=["announcements"])

# Admin-only dependency for the management surface.
admin_only = require_roles("Administrator")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _active_filter(query, at: datetime):
    """Restrict a query to announcements live at ``at`` (window + active flag)."""
    return query.filter(
        Announcement.is_active.is_(True),
        (Announcement.starts_at.is_(None)) | (Announcement.starts_at <= at),
        (Announcement.ends_at.is_(None)) | (Announcement.ends_at >= at),
    )


# ---------------------------------------------------------------------------
# Public feed (no auth): what the apps show to users
# ---------------------------------------------------------------------------


@router.get("/public", response_model=List[AnnouncementOut])
def list_public_announcements(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return currently-active announcements, highest priority first."""
    query = _active_filter(db.query(Announcement), _now())
    return (
        query.order_by(Announcement.priority.desc(), Announcement.published_at.desc())
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------------------------
# Admin CRUD (Administrator role only)
# ---------------------------------------------------------------------------


@router.get("", response_model=List[AnnouncementOut])
def list_announcements(
    db: Session = Depends(get_db),
    _admin: User = Depends(admin_only),
):
    """List every announcement (including inactive/expired) for management."""
    return (
        db.query(Announcement)
        .order_by(Announcement.priority.desc(), Announcement.published_at.desc())
        .all()
    )


def _get_or_404(db: Session, announcement_id: int) -> Announcement:
    row = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
    return row


@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: AnnouncementCreateReq,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    """Create an announcement; it is published immediately."""
    row = Announcement(
        title=payload.title,
        body=payload.body,
        is_active=payload.is_active,
        priority=payload.priority,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        published_at=_now(),
        created_by=admin.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{announcement_id}", response_model=AnnouncementOut)
def get_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(admin_only),
):
    """Fetch a single announcement by id."""
    return _get_or_404(db, announcement_id)


@router.put("/{announcement_id}", response_model=AnnouncementOut)
def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdateReq,
    db: Session = Depends(get_db),
    _admin: User = Depends(admin_only),
):
    """Partially update an announcement (only provided fields change)."""
    row = _get_or_404(db, announcement_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(row, field, value)
    row.updated_at = _now()
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(admin_only),
):
    """Delete an announcement."""
    row = _get_or_404(db, announcement_id)
    db.delete(row)
    db.commit()
    return None
