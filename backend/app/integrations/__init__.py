# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""External integrations package.

Third-party adapters are isolated behind interfaces (see `messaging.py`).
Concrete providers are planned; none are fabricated.
"""

from . import messaging  # noqa: F401

__all__ = ["messaging"]
