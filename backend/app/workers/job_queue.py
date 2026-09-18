# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Background worker interface for async report generation.

Wraps a job function so it can run either synchronously (returning the file /
JSON response directly) or via FastAPI `BackgroundTasks` (represented as a
submitted job reference). This keeps the report endpoints capable of both
`?async=0` (default, immediate) and `?async=1` (deferred) modes.
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict
from uuid import uuid4

# In-process job registry. A real queue (Celery/RQ) would replace this; the
# registry keeps the async path testable without external infrastructure.
_JOBS: Dict[str, dict] = {}


@dataclass
class JobHandle:
    """A handle for a submitted background job."""

    job_id: str = field(default_factory=lambda: uuid4().hex)
    status: str = "queued"
    result: Any = None


def register_job(job_id: str) -> None:
    """Register a job in the in-process registry."""
    _JOBS[job_id] = {"status": "queued", "result": None}


def submit_job(func: Callable, *args: Any, **kwargs: Any) -> JobHandle:
    """Run a job synchronously and record the result under a fresh job id.

    Composing a FastAPI BackgroundTasks call is the caller's responsibility;
    this helper centralizes the job-record semantics for the `async=1` path.
    """
    handle = JobHandle()
    register_job(handle.job_id)
    try:
        handle.result = func(*args, **kwargs)
        handle.status = "completed"
    except Exception as exc:  # noqa: BLE001
        handle.status = "failed"
        handle.result = {"error": str(exc)}
    _JOBS[handle.job_id] = {"status": handle.status, "result": handle.result}
    return handle


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
