"""Background task infrastructure for Intelligent Cognitive Alarm Platform.

Exposes worker helpers used by the report endpoints and future async jobs.
"""

from .job_queue import (  # noqa: F401
    JobHandle,
    get_job_status,
    submit_job,
    submit_to_background,
)

__all__ = [
    "JobHandle",
    "get_job_status",
    "submit_job",
    "submit_to_background",
]
