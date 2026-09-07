"""AI/ML engine package for Intelligent Cognitive Alarm Platform.

Isolates all artificial-intelligence concerns behind module boundaries and
contracts (`interfaces`). Concrete engines:

    difficulty            implemented - PyTorch model + rule fallback
    recommendations       implemented - rule-based, 4 categories
    challenge_generation  implemented - adaptive generation, no answer leak
    behavior_analysis     implemented - real-data analytics derivations
    anomaly_detection     planned     - contract only
    performance_prediction planned     - contract only

Routers and services never import ML libraries directly; they go through this
package (or the compat facades in `services`).
"""

from .interfaces import ENGINE_REGISTRY, engine_status
from .difficulty import MLInferenceService

__all__ = ["ENGINE_REGISTRY", "MLInferenceService", "engine_status"]
