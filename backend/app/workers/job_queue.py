# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Background worker interface for async report generation.

Wraps a job function so it can run either synchronously (returning the file /
JSON response directly) or via FastAPI `BackgroundTasks` (represented as a
submitted job reference). This keeps the report endpoints capable of both
`?async=0` (default, immediate) and `?async=1` (deferred) modes.
"""

from typing import Any, Callable, Dict

# In-process job registry. A real queue (Celery/RQ) would replace this; the
# registry keeps the async path testable without external infrastructure.
_JOBS: Dict[str, dict] = {}


def register_job(job_id: str) -> None:
    """Register a job in the in-process registry."""
    _JOBS[job_id] = {"status": "queued", "result": None}


def submit_to_background(
    background_tasks, func: Callable, job_id: str, *args: Any, **kwargs: Any
) -> None:
    """Queue `func` to run via FastAPI BackgroundTasks after response."""
    register_job(job_id)
    background_tasks.add_task(_run_and_record, job_id, func, *args, **kwargs)


def _run_and_record(job_id: str, func: Callable, *args: Any, **kwargs: Any) -> None:
    try:
        result = func(*args, **kwargs)
        _JOBS[job_id] = {"status": "completed", "result": result}
    except Exception as exc:  # noqa: BLE001
        _JOBS[job_id] = {"status": "failed", "result": {"error": str(exc)}}


def get_job_status(job_id: str) -> dict:
    """Return the current status of a job, or 404-style payload if unknown."""
    record = _JOBS.get(job_id)
    if record is None:
        return {"job_id": job_id, "status": "not_found"}
    return {"job_id": job_id, "status": record["status"]}
