# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""AI/ML engine package for Intelligent Cognitive Alarm Platform.

Isolates all artificial-intelligence concerns behind module boundaries and
contracts (`interfaces`). Concrete engines:

    difficulty            implemented - PyTorch model (synthetic-trained) + rule fallback
    anomaly_detection     implemented (baseline) - gated statistical checks
    performance_prediction implemented (baseline) - gated linear trend

Routers and services never import ML libraries directly; they go through this
package (or the compat facades in `services`).
"""

from .interfaces import ENGINE_REGISTRY, engine_status
from .difficulty import MLInferenceService

__all__ = ["ENGINE_REGISTRY", "MLInferenceService", "engine_status"]
