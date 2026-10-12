"""
Machine Learning & Standard Deviation Boost Engine for CognitiveWake
======================================================================

Provides dual predictive and statistical models to adaptively boost or balance
challenge difficulty based on user cognitive performance patterns.

1. MLBoostModel:
   Uses Machine Learning (GradientBoostingRegressor / Ridge with fallback) to predict
   a user's expected reaction time and wakefulness index based on historical features.

2. SDBoostModel:
   Computes statistical dispersion (Standard Deviation σ, Coefficient of Variation CV,
   and Cognitive Stability Index CSI) to award consistency boosts or apply groggy safety buffers.
"""

from typing import List, Dict, Any, Tuple, Optional
import math
from datetime import datetime, timezone

try:
    import numpy as np
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

try:
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.linear_model import Ridge
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class MLBoostModel:
    """Predictive Machine Learning model using XGBoost Regressor for user reaction time & wakefulness score."""

    def __init__(self):
        self._model = None
        self._is_trained = False
        self._model_name = "Heuristic Fallback"

        if XGBOOST_AVAILABLE:
            self._model = XGBRegressor(
                n_estimators=50,
                learning_rate=0.08,
                max_depth=4,
                subsample=0.8,
                random_state=42,
                verbosity=0
            )
            self._model_name = "Predictive Reaction Engine"
        elif SKLEARN_AVAILABLE:
            self._model = GradientBoostingRegressor(n_estimators=30, max_depth=3, random_state=42)
            self._model_name = "Predictive Reaction Engine"

    def extract_features(self, attempts: List[Dict[str, Any]], current_streak: int = 0, hour_of_day: int = 8, current_score: float = 0.5, time_limit: float = 25.0) -> List[float]:
        """
        Extract feature vector X from attempt history:
        [avg_rt, accuracy, hour_of_day, current_streak, current_score, time_limit]
        """
        if not attempts:
            return [15.0, 0.70, float(hour_of_day), float(current_streak), float(current_score), float(time_limit)]

        recent = attempts[-10:]
        rts = [float(a.get("response_time", 15.0)) for a in recent]
        corrects = [1.0 if a.get("correct", False) else 0.0 for a in recent]

        avg_rt = sum(rts) / len(rts)
        accuracy = sum(corrects) / len(corrects)

        return [avg_rt, accuracy, float(hour_of_day), float(current_streak), float(current_score), float(time_limit)]

    def train_on_history(self, attempts: List[Dict[str, Any]]) -> bool:
        """Train the XGBoost / ML model if sufficient historical data exists (>= 5 attempts)."""
        if not (XGBOOST_AVAILABLE or SKLEARN_AVAILABLE) or len(attempts) < 5:
            self._is_trained = False
            return False

        X_train = []
        y_train = []

        for i in range(1, len(attempts)):
            past_slice = attempts[:i]
            target_attempt = attempts[i]

            attempted_at = target_attempt.get("attempted_at")
            hour = attempted_at.hour if isinstance(attempted_at, datetime) else 8

            features = self.extract_features(
                past_slice,
                current_streak=target_attempt.get("current_streak", 0),
                hour_of_day=hour,
                current_score=target_attempt.get("difficulty_score", 0.5),
                time_limit=target_attempt.get("time_limit", 25.0)
            )

            actual_rt = float(target_attempt.get("response_time", 15.0))
            X_train.append(features)
            y_train.append(actual_rt)

        if len(X_train) >= 3:
            try:
                self._model.fit(X_train, y_train)
                self._is_trained = True
                return True
            except Exception:
                self._is_trained = False
                return False

        self._is_trained = False
        return False

    def predict_performance(
        self,
        attempts: List[Dict[str, Any]],
        current_streak: int = 0,
        hour_of_day: int = 8,
        current_score: float = 0.5,
        time_limit: float = 25.0
    ) -> Dict[str, Any]:
        """
        Predict expected response time using XGBoost model, calculate ML Wakefulness Index (0-100),
        and compute the ML Boost Delta (range: -0.06 to +0.06).
        """
        features = self.extract_features(attempts, current_streak, hour_of_day, current_score, time_limit)
        avg_past_rt = features[0]
        accuracy = features[1]

        predicted_rt = avg_past_rt

        if self._is_trained and (XGBOOST_AVAILABLE or SKLEARN_AVAILABLE) and self._model is not None:
            try:
                pred_arr = self._model.predict([features])
                predicted_rt = float(pred_arr[0])
            except Exception:
                predicted_rt = avg_past_rt
        else:
            # Heuristic regression fallback when data is small
            streak_discount = min(current_streak, 10) * 0.2
            predicted_rt = max(3.0, avg_past_rt * (1.1 - accuracy * 0.2) - streak_discount)

        predicted_rt = max(3.0, min(60.0, round(predicted_rt, 2)))

        # Wakefulness Index (0.0 to 100.0%)
        # Fast predicted response time relative to time limit -> Higher Wakefulness Index
        ratio = max(0.0, min(1.5, predicted_rt / max(10.0, time_limit)))
        wakefulness_index = round(max(0.0, min(100.0, (1.0 - (ratio / 1.2)) * 100.0)), 1)

        # ML Boost Delta calculation
        # High wakefulness (>50%) gives positive boost; low wakefulness gives negative adjustment
        raw_delta = 0.04 * ((wakefulness_index - 50.0) / 50.0)
        ml_boost = max(-0.06, min(0.06, round(raw_delta, 4)))

        return {
            "predicted_response_time": predicted_rt,
            "wakefulness_index": wakefulness_index,
            "ml_boost": ml_boost,
            "is_ml_trained": self._is_trained,
            "model_name": self._model_name if self._is_trained else "Predictive Engine (Initializing)",
            "features_used": features,
        }



class SDBoostModel:
    """Statistical Standard Deviation & Cognitive Stability model."""

    def compute_sd_metrics(self, attempts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Computes response time Standard Deviation (σ), Coefficient of Variation (CV),
        Cognitive Stability Index (CSI), and SD Boost Delta.
        """
        if not attempts:
            return {
                "std_dev_response_time": 0.0,
                "mean_response_time": 0.0,
                "coeff_variation": 0.0,
                "cognitive_stability_index": 70.0,
                "sd_boost": 0.0,
                "sd_boost_active": False,
                "sample_count": 0,
            }

        recent = attempts[-20:]
        rts = [float(a.get("response_time", 0.0)) for a in recent]
        n = len(rts)

        mean_rt = sum(rts) / n

        if n <= 1:
            std_dev = 0.0
        else:
            variance = sum((x - mean_rt) ** 2 for x in rts) / (n - 1)
            std_dev = math.sqrt(variance)

        cv = std_dev / (mean_rt + 0.001)

        # Cognitive Stability Index (0-100%)
        # Low CV (consistent reaction times) -> High Cognitive Stability
        csi = max(0.0, min(100.0, 100.0 / (1.0 + (cv * 1.5))))

        # Determine SD Boost Delta
        sd_boost = 0.0
        sd_boost_active = False

        accuracy = sum(1.0 if a.get("correct", False) else 0.0 for a in recent) / n

        if n >= 3:
            if std_dev < 2.5 and accuracy >= 0.8:
                # High consistency bonus: fast and very low variability
                sd_boost = 0.03
                sd_boost_active = True
            elif std_dev < 4.0 and accuracy >= 0.7:
                # Moderate consistency bonus
                sd_boost = 0.015
                sd_boost_active = True
            elif std_dev >= 5.0:
                # Groggy damper: erratic response times indicate sleep inertia
                # Small negative delta to protect user from aggressive difficulty spikes
                sd_boost = -0.01
                sd_boost_active = False

        return {
            "std_dev_response_time": round(std_dev, 2),
            "mean_response_time": round(mean_rt, 2),
            "coeff_variation": round(cv, 4),
            "cognitive_stability_index": round(csi, 1),
            "sd_boost": round(sd_boost, 4),
            "sd_boost_active": sd_boost_active,
            "sample_count": n,
        }


class MLHabitScoreModel:
    """
    Machine Learning Habit Score Engine following exact spec:
    Habit Score =
        - Wake-Up Consistency (35%)
        - Challenge Completion Success (25%)
        - Snooze Reduction (20%)
        - Sleep Schedule Adherence (20%)
    """

    def compute_habit_score(
        self,
        attempts: List[Dict[str, Any]],
        current_streak: int = 0,
        zero_snooze_compliance: float = 85.0,
        total_snoozes: int = 0,
        wakefulness_index: float = 70.0,
        cognitive_stability_index: float = 70.0,
    ) -> Dict[str, Any]:
        # 1. Wake-Up Consistency (35%)
        streak_factor = min(100.0, (current_streak / 10.0) * 100.0)
        consistency_score = round(0.6 * streak_factor + 0.4 * cognitive_stability_index, 1)

        # 2. Challenge Completion Success (25%)
        if attempts:
            recent = attempts[-20:]
            correct_count = sum(1.0 for a in recent if a.get("correct", False))
            completion_score = round((correct_count / len(recent)) * 100.0, 1)
        else:
            completion_score = 75.0

        # 3. Snooze Reduction (20%)
        snooze_reduction_score = round(max(0.0, min(100.0, zero_snooze_compliance)), 1)

        # 4. Sleep Schedule Adherence (20%)
        # Base adherence blended with wakefulness index
        adherence_score = round(max(0.0, min(100.0, 0.7 * wakefulness_index + 0.3 * (100.0 - min(30, total_snoozes * 5)))), 1)

        # Weighted Final Calculation
        raw_habit = (
            0.35 * consistency_score +
            0.25 * completion_score +
            0.20 * snooze_reduction_score +
            0.20 * adherence_score
        )
        habit_score = round(max(0.0, min(100.0, raw_habit)), 1)

        if habit_score >= 85.0:
            habit_tier = "Master Riser 🏆"
        elif habit_score >= 70.0:
            habit_tier = "Consistent Riser 🚀"
        elif habit_score >= 50.0:
            habit_tier = "Building Habit 📈"
        else:
            habit_tier = "Erratic Riser 😴"

        # Generate Recommendation Engine output across 5 categories
        recommendations = self.generate_recommendations(
            consistency_score=consistency_score,
            completion_score=completion_score,
            snooze_score=snooze_reduction_score,
            adherence_score=adherence_score,
            current_streak=current_streak,
            total_snoozes=total_snoozes
        )

        return {
            "habit_score": habit_score,
            "habit_tier": habit_tier,
            "breakdown": {
                "wakeup_consistency": consistency_score,       # 35%
                "completion_success": completion_score,         # 25%
                "snooze_reduction": snooze_reduction_score,     # 20%
                "sleep_adherence": adherence_score,             # 20%
            },
            "recommendations": recommendations
        }

    def generate_recommendations(
        self,
        consistency_score: float,
        completion_score: float,
        snooze_score: float,
        adherence_score: float,
        current_streak: int,
        total_snoozes: int
    ) -> Dict[str, List[str]]:
        recs = {
            "sleep_improvement": [],
            "wakeup_optimization": [],
            "habit_guidance": [],
            "productivity": [],
            "personalized_challenges": []
        }

        # 1. Sleep Improvement Recommendations
        if adherence_score < 75.0:
            recs["sleep_improvement"].append("Maintain a strict bedtime window (within 30 mins) to prevent circadian rhythm disruption.")
            recs["sleep_improvement"].append("Turn off high-blue light displays 45 minutes prior to sleep to elevate melatonin production.")
        else:
            recs["sleep_improvement"].append("Your sleep schedule alignment is optimal! Keep your consistent bed & wake window.")

        # 2. Wake-Up Optimization Suggestions
        if total_snoozes > 2:
            recs["wakeup_optimization"].append("Enable Drill Sergeant mode to enforce a strict Zero-Snooze policy and reduce sleep inertia.")
            recs["wakeup_optimization"].append("Position your phone across the room to compel physical standing movement.")
        else:
            recs["wakeup_optimization"].append("Excellent instant wake-up response! Your wakefulness index is in the top tier.")

        # 3. Habit Improvement Guidance
        if current_streak < 7:
            recs["habit_guidance"].append(f"You're currently on a {current_streak}-day wake streak. Complete {7 - current_streak} more consecutive days for streak bonuses.")
        else:
            recs["habit_guidance"].append(f"Outstanding {current_streak}-day wake streak! You have achieved Master Riser status.")

        # 4. Productivity Recommendations
        recs["productivity"].append("Schedule your highest cognitive workload within 90 minutes of alarm dismissal when alertness peaks.")
        recs["productivity"].append("Hydrate with 500ml water immediately after puzzle dismissal to activate metabolic baseline.")

        # 5. Personalized Challenge Recommendations
        if completion_score < 80.0:
            recs["personalized_challenges"].append("Switch to 'Math' or 'Trivia' puzzle mode to build confidence before attempting multi-step puzzles.")
        else:
            recs["personalized_challenges"].append("Your puzzle accuracy is high! Try 'Mad Scientist' or 'Color Match (Stroop)' to stretch cognitive agility.")

        return recs


# Global Singletons
ml_boost_model = MLBoostModel()
sd_boost_model = SDBoostModel()
ml_habit_model = MLHabitScoreModel()


