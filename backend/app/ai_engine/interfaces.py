# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Domain interfaces for the AI/ML engine.

Each interface documents the contract a concrete engine must satisfy. Status
legend (used by the engine registry):
    implemented - production code exists in this package
    scaffold    - interface + adapter defined; delegate target is wired
    planned     - declared; not implemented yet (no fabrication per §25)
"""

from typing import Any, Dict, List, Optional, Protocol, Tuple

from sqlalchemy.orm import Session


class DifficultyPredictor(Protocol):
    """Predict the next challenge difficulty from performance signals."""

    def predict_difficulty(
        self,
        success_rate: float,
        avg_time_seconds: float,
        snooze_count: int,
        streak_length: int,
        current_difficulty: str = "Medium",
    ) -> Tuple[str, str]:
        """Return (predicted_difficulty, method_used: "ml" | "rule_based")."""


class RecommendationEngine(Protocol):
    """Generate personalized recommendations across sleep/wake/habit/challenge."""

    def recommend(self, db: Session, user_id: int) -> List[Any]:
        """Return a priority-sorted list of RecommendationRes."""


class ChallengeGenerator(Protocol):
    """Generate adaptive challenges and verify server-side submissions."""

    async def generate(self, db: Session, user_id: int, **kwargs: Any) -> Tuple[Any, Any]:
        """Return (challenge, pending_attempt); no answer leakage."""

    def build_payload(self, attempt: Any) -> Dict[str, Any]:
        """Build the client puzzle payload (prompts/options only)."""

    def verify(self, db: Session, user_id: int, **kwargs: Any) -> Any:
        """Verify a submission against the stored attempt."""


class BehaviorAnalyzer(Protocol):
    """Derive behavioral signals from real alarm/attempt data."""

    def analyze(self, db: Session, user_id: int, **kwargs: Any) -> Dict[str, Any]:
        """Return an analytics summary (backward-compatible keys)."""


class AnomalyDetector(Protocol):
    """Flag unusual user behavior (e.g. erratic wake times, snooze spikes)."""

    def detect(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """Return anomaly descriptors."""


class PerformanceForecaster(Protocol):
    """Forecast near-term engagement/performance trend."""

    def forecast(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Return {trend, confidence, horizon_days}."""


# Runtime fallback for difficulty adaptation when no AI engine is configured.
DEFAULT_DIFFICULTY = "Medium"

# Map of logical engine -> (status, module). Modules are imported lazily.
ENGINE_REGISTRY: Dict[str, Dict[str, str]] = {
    "difficulty": {"status": "implemented", "module": "app.ai_engine.difficulty"},
    "recommendations": {"status": "implemented", "module": "app.services.recommendation_service"},
    "challenge_generation": {"status": "implemented", "module": "app.services.challenge_service"},
    "behavior_analysis": {"status": "implemented", "module": "app.services.behavior_analytics_service"},
    "anomaly_detection": {"status": "implemented (baseline)", "module": "app.ai_engine.anomaly"},
    "performance_prediction": {"status": "implemented (baseline)", "module": "app.ai_engine.performance_prediction"},
}


def engine_status(name: str) -> Optional[Dict[str, str]]:
    """Return the registry entry for a logical engine, or None."""
    return ENGINE_REGISTRY.get(name)
