"""Background scheduler for reminder/notification generation (Module 11).

Runs entirely in-process via APScheduler — no external cron/worker infra needed.
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.db.database import SessionLocal
from app.services.notification_service import generate_for_all_users

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(daemon=True)


def _run_notification_sweep() -> None:
    db = SessionLocal()
    try:
        count = generate_for_all_users(db)
        if count:
            logger.info("Notification sweep created %d notification(s)", count)
    except Exception:
        logger.exception("Notification sweep failed")
    finally:
        db.close()


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.add_job(_run_notification_sweep, "interval", minutes=15, id="notification_sweep", replace_existing=True)
        scheduler.start()
        logger.info("Notification scheduler started (runs every 15 minutes)")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
