"""
Adaptive Difficulty Engine for CognitiveWake
=============================================

Replaces static EASY/MEDIUM/HARD tiers with a continuous 0.0–1.0
difficulty score per user that adapts after every challenge attempt.

Score semantics:
    0.00 – 0.33  →  EASY    (simple arithmetic, generous time)
    0.34 – 0.66  →  MEDIUM  (two-step, moderate time)
    0.67 – 1.00  →  HARD    (multi-step, tight time)

The score drives a parametric question generator that smoothly
interpolates number ranges, operation complexity, step counts,
and time limits — producing questions at *exactly* the right level
instead of jumping between 3 buckets.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple

# ──────────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────────

DEFAULT_SCORE = 0.20          # New users start at EASY-equivalent

# Adaptation deltas
CORRECT_DELTA   =  0.03     # Reward for a correct answer
INCORRECT_DELTA = -0.05     # Penalty for a wrong answer (asymmetric)
SPEED_BONUS     =  0.01     # Bonus if answered under 40% of time limit
SPEED_THRESHOLD =  0.40     # Fraction of time limit to qualify for speed bonus
STREAK_BONUS    =  0.005    # Per-day streak bonus
STREAK_CAP      =  10       # Max streak days counted for bonus
INACTIVITY_DECAY = 0.01     # Score decay per inactive day
INACTIVITY_CAP  =  0.15     # Maximum total inactivity decay

# Score ↔ label boundaries
EASY_CEIL   = 0.33
MEDIUM_CEIL = 0.66

# Role difficulty floor / ceiling bounds
# Floor: the user's effective score is raised to at least this value
# Ceiling: the user's effective score is capped at this value
ROLE_DIFFICULTY_BOUNDS: Dict[str, Tuple[float, float]] = {
    "STANDARD":       (0.05, 0.33),  # Adaptive is maintained as easy
    "DRILL_SERGEANT": (0.60, 1.0),   # Never easier than 0.60
    "ZEN_GURU":       (0.0,  0.40),  # Never harder than 0.40
    "CORPORATE_EXEC": (0.30, 0.80),
    "MAD_SCIENTIST":  (0.55, 1.0),
    "FITNESS_COACH":  (0.25, 0.75),
}

# Parametric generation bounds keyed by score extremes (0.0 and 1.0).
# Values are linearly interpolated for intermediate scores.
PARAM_BOUNDS = {
    # (value_at_0.0, value_at_1.0)
    "num_low":        (1,   50),     # Smallest operand
    "num_high":       (20,  500),    # Largest operand
    "mul_low":        (1,   10),     # Multiplication operand floor
    "mul_high":       (12,  50),     # Multiplication operand ceiling
    "steps":          (1,   4),      # Number of operations in expression
    "time_limit":     (45,  12),     # Seconds (decreases with difficulty)
    "allow_negative": (0,   1),      # 0 = no negatives, 1 = allow
    "div_weight":     (0.0, 0.3),    # Probability weight for division
    "power_weight":   (0.0, 0.25),   # Probability weight for exponents
}


from .ml_sd_engine import ml_boost_model, sd_boost_model, ml_habit_model

# ──────────────────────────────────────────────────────────────
# CORE ENGINE
# ──────────────────────────────────────────────────────────────

class DifficultyEngine:
    """Stateless engine — all state lives in MongoDB."""

    def __init__(self, performance_col, difficulty_history_col, attempts_col=None):
        """
        Args:
            performance_col:        pymongo Collection for user performance docs.
            difficulty_history_col: pymongo Collection for score change log.
            attempts_col:           pymongo Collection for challenge attempts.
        """
        self._perf = performance_col
        self._hist = difficulty_history_col
        self._attempts = attempts_col

    # ── Read ──────────────────────────────────────────────────

    def get_user_difficulty(self, user_id: str) -> float:
        """Return the user's current difficulty score, initializing if absent."""
        doc = self._perf.find_one({"user_id": user_id})
        if doc and "difficulty_score" in doc:
            return float(doc["difficulty_score"])

        # First time — initialize at DEFAULT_SCORE
        self._perf.update_one(
            {"user_id": user_id},
            {"$set": {"difficulty_score": DEFAULT_SCORE}},
            upsert=True,
        )
        return DEFAULT_SCORE

    def get_difficulty_info(self, user_id: str) -> Dict[str, Any]:
        """Return full difficulty info dict for API responses including ML & SD metrics."""
        score = self.get_user_difficulty(user_id)
        label = score_to_label(score)
        params = generate_params(score)

        # Fetch recent history (last 30 data points)
        history = list(
            self._hist.find({"user_id": user_id})
            .sort("timestamp", -1)
            .limit(30)
        )
        sparkline = [
            {"score": round(h["score"], 3), "ts": h["timestamp"].isoformat()}
            for h in reversed(history)
        ]

        # Fetch recent challenge attempts for ML and SD models
        attempts = []
        if self._attempts is not None:
            attempts = list(
                self._attempts.find({"user_id": user_id})
                .sort("attempted_at", 1)
                .limit(50)
            )

        # Train ML model if possible
        if attempts:
            ml_boost_model.train_on_history(attempts)

        # Compute ML & SD metrics
        doc = self._perf.find_one({"user_id": user_id}) or {}
        current_streak = int(doc.get("current_streak", 0))
        now_hour = datetime.now(timezone.utc).hour

        ml_res = ml_boost_model.predict_performance(
            attempts,
            current_streak=current_streak,
            hour_of_day=now_hour,
            current_score=score,
            time_limit=params["time_limit"]
        )

        sd_res = sd_boost_model.compute_sd_metrics(attempts)

        # Compute ML Habit Score, Weighted Scoring Model & Recommendation Engine
        habit_res = ml_habit_model.compute_habit_score(
            attempts,
            current_streak=current_streak,
            wakefulness_index=ml_res["wakefulness_index"],
            cognitive_stability_index=sd_res["cognitive_stability_index"]
        )

        return {
            "user_id": user_id,
            "difficulty_score": round(score, 4),
            "difficulty_label": label,
            "difficulty_pct": round(score * 100, 1),
            "time_limit": params["time_limit"],
            "sparkline": sparkline,

            # ML Boost Metrics
            "ml_boost": ml_res["ml_boost"],
            "predicted_response_time": ml_res["predicted_response_time"],
            "wakefulness_index": ml_res["wakefulness_index"],
            "is_ml_trained": ml_res["is_ml_trained"],
            "model_name": ml_res.get("model_name", "Predictive Reaction Engine"),

            # SD Boost Metrics
            "sd_boost": sd_res["sd_boost"],
            "std_dev_response_time": sd_res["std_dev_response_time"],
            "mean_response_time": sd_res["mean_response_time"],
            "coeff_variation": sd_res["coeff_variation"],
            "cognitive_stability_index": sd_res["cognitive_stability_index"],
            "sd_boost_active": sd_res["sd_boost_active"],

            # ML Habit Score & Recommendation Engine Metrics
            "habit_score": habit_res["habit_score"],
            "habit_tier": habit_res["habit_tier"],
            "habit_breakdown": habit_res["breakdown"],
            "recommendations": habit_res.get("recommendations", {}),
        }

    # ── Write (adaptation) ────────────────────────────────────

    def update_difficulty(
        self,
        user_id: str,
        was_correct: bool,
        response_time: float,
        time_limit: float,
        current_streak: int = 0,
        return_dict: bool = False,
    ) -> Any:
        """
        Recalculate and persist the user's difficulty score after an attempt
        using combined base heuristic + ML Boost + SD Boost models.

        Returns the new score (or dict if return_dict=True).
        """
        old_score = self.get_user_difficulty(user_id)

        # 1. Correctness delta
        delta = CORRECT_DELTA if was_correct else INCORRECT_DELTA

        # 2. Speed bonus (only if correct AND fast)
        speed_bonus = 0.0
        if was_correct and time_limit > 0 and response_time < (time_limit * SPEED_THRESHOLD):
            speed_bonus = SPEED_BONUS

        # 3. Streak bonus (only if correct)
        streak_bonus = 0.0
        if was_correct and current_streak > 0:
            streak_bonus = STREAK_BONUS * min(current_streak, STREAK_CAP)

        # 4. Inactivity decay
        decay = self._calculate_inactivity_decay(user_id)

        # 5. Fetch attempt history for ML & SD computation
        attempts = []
        if self._attempts is not None:
            attempts = list(
                self._attempts.find({"user_id": user_id})
                .sort("attempted_at", 1)
                .limit(50)
            )

        now_hour = datetime.now(timezone.utc).hour
        if attempts:
            ml_boost_model.train_on_history(attempts)

        ml_res = ml_boost_model.predict_performance(
            attempts,
            current_streak=current_streak,
            hour_of_day=now_hour,
            current_score=old_score,
            time_limit=time_limit
        )

        sd_res = sd_boost_model.compute_sd_metrics(attempts)

        ml_boost = ml_res["ml_boost"]
        sd_boost = sd_res["sd_boost"]

        # Combine Base Delta + ML Boost + SD Boost
        net_delta = delta + speed_bonus + streak_bonus - decay + ml_boost + sd_boost
        new_score = _clamp(old_score + net_delta)

        # Persist to Mongo Performance collection
        now = datetime.now(timezone.utc)
        self._perf.update_one(
            {"user_id": user_id},
            {"$set": {
                "difficulty_score": round(new_score, 4),
                "difficulty_label": score_to_label(new_score),
                "last_attempt_at": now,
                "ml_boost": ml_boost,
                "sd_boost": sd_boost,
                "predicted_response_time": ml_res["predicted_response_time"],
                "wakefulness_index": ml_res["wakefulness_index"],
                "cognitive_stability_index": sd_res["cognitive_stability_index"],
                "std_dev_response_time": sd_res["std_dev_response_time"],
                "sd_boost_active": sd_res["sd_boost_active"],
            }},
            upsert=True,
        )

        # Log to history
        self._hist.insert_one({
            "user_id": user_id,
            "score": round(new_score, 4),
            "old_score": round(old_score, 4),
            "delta": round(new_score - old_score, 4),
            "base_delta": round(delta, 4),
            "ml_boost": ml_boost,
            "sd_boost": sd_boost,
            "was_correct": was_correct,
            "response_time": round(response_time, 2),
            "predicted_response_time": ml_res["predicted_response_time"],
            "wakefulness_index": ml_res["wakefulness_index"],
            "cognitive_stability_index": sd_res["cognitive_stability_index"],
            "timestamp": now,
        })

        if return_dict:
            return {
                "new_score": round(new_score, 4),
                "old_score": round(old_score, 4),
                "difficulty_label": score_to_label(new_score),
                "ml_boost": ml_boost,
                "sd_boost": sd_boost,
                "predicted_response_time": ml_res["predicted_response_time"],
                "wakefulness_index": ml_res["wakefulness_index"],
                "cognitive_stability_index": sd_res["cognitive_stability_index"],
                "std_dev_response_time": sd_res["std_dev_response_time"],
                "sd_boost_active": sd_res["sd_boost_active"],
            }

        return new_score


    def _calculate_inactivity_decay(self, user_id: str) -> float:
        """Decay based on days since last attempt."""
        doc = self._perf.find_one({"user_id": user_id})
        if not doc or "last_attempt_at" not in doc:
            return 0.0

        last = doc["last_attempt_at"]
        if isinstance(last, str):
            last = datetime.fromisoformat(last)
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)

        days_inactive = (datetime.now(timezone.utc) - last).days
        if days_inactive <= 0:
            return 0.0

        return min(INACTIVITY_DECAY * days_inactive, INACTIVITY_CAP)

    # ── Role-bounded score ────────────────────────────────────

    def get_effective_score(
        self,
        user_id: str,
        alarm_role: str = "STANDARD",
        explicit_difficulty: Optional[str] = None,
    ) -> float:
        """
        Get the effective difficulty score, applying role bounds.

        If explicit_difficulty is a fixed tier (EASY/MEDIUM/HARD), convert
        it to a score and return. If it's AUTO or None, use the adaptive score
        with role bounds applied.
        """
        # Explicit fixed tier overrides everything
        if explicit_difficulty and explicit_difficulty.upper() in ("EASY", "MEDIUM", "HARD"):
            return label_to_score(explicit_difficulty.upper())

        # Adaptive score
        score = self.get_user_difficulty(user_id)

        # Apply role bounds
        role_key = (alarm_role or "STANDARD").upper()
        floor, ceiling = ROLE_DIFFICULTY_BOUNDS.get(role_key, (0.0, 1.0))
        return _clamp(score, floor, ceiling)


# ──────────────────────────────────────────────────────────────
# PURE FUNCTIONS (usable without engine instance)
# ──────────────────────────────────────────────────────────────

def score_to_label(score: float) -> str:
    """Map a continuous score to a discrete label."""
    if score <= EASY_CEIL:
        return "EASY"
    elif score <= MEDIUM_CEIL:
        return "MEDIUM"
    return "HARD"


def label_to_score(label: str) -> float:
    """Map a discrete label to the midpoint of its score range."""
    label = label.upper()
    if label == "EASY":
        return 0.17   # midpoint of 0.00–0.33
    elif label == "MEDIUM":
        return 0.50   # midpoint of 0.34–0.66
    elif label == "HARD":
        return 0.83   # midpoint of 0.67–1.00
    return DEFAULT_SCORE  # fallback


def generate_params(score: float) -> Dict[str, Any]:
    """
    Convert a difficulty score into concrete question generation parameters.

    All parameters are linearly interpolated between their low/high bounds.
    """
    score = _clamp(score)
    params = {}
    for key, (low, high) in PARAM_BOUNDS.items():
        raw = low + (high - low) * score
        # Integer params
        if key in ("num_low", "num_high", "mul_low", "mul_high", "steps", "time_limit"):
            params[key] = int(round(raw))
        elif key == "allow_negative":
            params[key] = score >= 0.6   # negatives only above 0.6
        else:
            params[key] = round(raw, 3)
    # Enforce sane bounds
    params["num_low"] = max(1, params["num_low"])
    params["num_high"] = max(params["num_low"] + 5, params["num_high"])
    params["mul_low"] = max(1, params["mul_low"])
    params["mul_high"] = max(params["mul_low"] + 2, params["mul_high"])
    params["steps"] = max(1, min(4, params["steps"]))
    params["time_limit"] = max(10, min(60, params["time_limit"]))
    return params


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    """Clamp value between lo and hi."""
    return max(lo, min(hi, value))
