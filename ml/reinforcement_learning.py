"""
ml/reinforcement_learning.py

Reinforcement Learning Module for Adaptive Cognitive Alarm Platform.
Implements a Q-Learning agent and Contextual Bandit for dynamic difficulty
adaptation and personalized cognitive challenge selection based on real user feedback.
"""

from pathlib import Path
import json
import random
from typing import Dict, Tuple, List, Any


RL_DIR = Path(__file__).resolve().parent / "models"
Q_TABLE_PATH = RL_DIR / "rl_q_table.json"

# State Space Dimensions:
# difficulty_bucket: ['beginner', 'easy', 'medium', 'hard', 'expert']
# accuracy_bucket: ['low', 'medium', 'high']  (e.g., <60%, 60-85%, >85%)
# snooze_bucket: ['none', 'low', 'high']       (0, 1-2, 3+)

DIFFICULTY_TIERS = ["beginner", "easy", "medium", "hard", "expert"]
ACCURACY_BUCKETS = ["low", "medium", "high"]
SNOOZE_BUCKETS = ["none", "low", "high"]

# Action Space:
# 1. Adapt difficulty tier: decrease, maintain, increase
# 2. Challenge category recommendation: math, logic, memory, pattern, quiz, word, riddle
ACTIONS = [
    "decrease_difficulty",
    "maintain_difficulty",
    "increase_difficulty",
    "recommend_math",
    "recommend_logic",
    "recommend_memory",
    "recommend_pattern",
    "recommend_quiz",
    "recommend_riddle",
    "recommend_word",
]


class CognitiveQLearningAgent:
    """
    Q-Learning agent that learns the optimal difficulty adjustment and
    challenge recommendation policy based on morning alertness rewards.
    """

    def __init__(
        self,
        learning_rate: float = 0.15,
        discount_factor: float = 0.90,
        epsilon: float = 0.10,
    ):
        self.alpha = learning_rate
        self.gamma = discount_factor
        self.epsilon = epsilon
        self.q_table: Dict[str, Dict[str, float]] = {}
        self._init_or_load_q_table()

    def _state_to_key(self, difficulty: str, accuracy_bucket: str, snooze_bucket: str) -> str:
        d = difficulty if difficulty in DIFFICULTY_TIERS else "medium"
        a = accuracy_bucket if accuracy_bucket in ACCURACY_BUCKETS else "medium"
        s = snooze_bucket if snooze_bucket in SNOOZE_BUCKETS else "none"
        return f"{d}:{a}:{s}"

    def _init_or_load_q_table(self):
        if Q_TABLE_PATH.exists():
            try:
                with open(Q_TABLE_PATH, "r", encoding="utf-8") as f:
                    self.q_table = json.load(f)
                    return
            except Exception:
                pass

        # Initialize with domain-aligned prior heuristic rewards
        self.q_table = {}
        for d in DIFFICULTY_TIERS:
            for a in ACCURACY_BUCKETS:
                for s in SNOOZE_BUCKETS:
                    state_key = f"{d}:{a}:{s}"
                    self.q_table[state_key] = {act: 0.0 for act in ACTIONS}

                    # Heuristic priors
                    if a == "high" and s == "none":
                        self.q_table[state_key]["increase_difficulty"] = 1.2
                        self.q_table[state_key]["recommend_logic"] = 0.8
                    elif a == "low" or s == "high":
                        self.q_table[state_key]["decrease_difficulty"] = 1.0
                        self.q_table[state_key]["recommend_math"] = 0.7
                    else:
                        self.q_table[state_key]["maintain_difficulty"] = 0.9

        self.save()

    def save(self):
        RL_DIR.mkdir(parents=True, exist_ok=True)
        with open(Q_TABLE_PATH, "w", encoding="utf-8") as f:
            json.dump(self.q_table, f, indent=2)

    def discretize_state(
        self,
        current_difficulty: str,
        recent_accuracy: float,
        snooze_count: int,
    ) -> str:
        d = current_difficulty.lower() if current_difficulty in DIFFICULTY_TIERS else "medium"
        
        if recent_accuracy >= 0.85:
            a = "high"
        elif recent_accuracy >= 0.60:
            a = "medium"
        else:
            a = "low"

        if snooze_count <= 0:
            s = "none"
        elif snooze_count <= 2:
            s = "low"
        else:
            s = "high"

        return self._state_to_key(d, a, s)

    def select_action(self, state_key: str, explore: bool = False) -> str:
        if state_key not in self.q_table:
            self.q_table[state_key] = {act: 0.0 for act in ACTIONS}

        if explore and random.random() < self.epsilon:
            return random.choice(ACTIONS)

        state_actions = self.q_table[state_key]
        return max(state_actions, key=state_actions.get)

    def compute_reward(
        self,
        accuracy: float,
        response_time_seconds: float,
        snoozes: int,
        completed_on_time: bool,
    ) -> float:
        """
        Reward function:
        - Accuracy: +1.0 for perfect, proportional
        - Speed: up to +0.5 for fast answering (<30s)
        - Snooze penalty: -0.4 per snooze
        - On-time completion bonus: +0.6
        """
        reward = accuracy * 1.0
        if response_time_seconds <= 30.0:
            reward += 0.5 * (1.0 - (response_time_seconds / 30.0))
        reward -= min(1.2, snoozes * 0.4)
        if completed_on_time:
            reward += 0.6
        return round(reward, 3)

    def update(
        self,
        state_key: str,
        action: str,
        reward: float,
        next_state_key: str,
    ):
        """
        Q(s, a) = Q(s, a) + alpha * [reward + gamma * max_a' Q(s', a') - Q(s, a)]
        """
        if state_key not in self.q_table:
            self.q_table[state_key] = {act: 0.0 for act in ACTIONS}
        if next_state_key not in self.q_table:
            self.q_table[next_state_key] = {act: 0.0 for act in ACTIONS}

        current_q = self.q_table[state_key].get(action, 0.0)
        max_next_q = max(self.q_table[next_state_key].values()) if self.q_table[next_state_key] else 0.0

        new_q = current_q + self.alpha * (reward + self.gamma * max_next_q - current_q)
        self.q_table[state_key][action] = round(new_q, 4)
        self.save()
        return new_q

    def recommend_adaptation(
        self,
        current_difficulty: str,
        recent_accuracy: float,
        snooze_count: int,
    ) -> Dict[str, Any]:
        """
        Produce RL policy recommendation for next alarm cycle.
        """
        state_key = self.discretize_state(current_difficulty, recent_accuracy, snooze_count)
        best_action = self.select_action(state_key, explore=False)
        q_values = self.q_table.get(state_key, {})

        # Interpret action
        if best_action == "increase_difficulty":
            idx = DIFFICULTY_TIERS.index(current_difficulty.lower()) if current_difficulty.lower() in DIFFICULTY_TIERS else 2
            next_diff = DIFFICULTY_TIERS[min(len(DIFFICULTY_TIERS) - 1, idx + 1)]
            action_desc = f"Promote difficulty from {current_difficulty} to {next_diff}"
        elif best_action == "decrease_difficulty":
            idx = DIFFICULTY_TIERS.index(current_difficulty.lower()) if current_difficulty.lower() in DIFFICULTY_TIERS else 2
            next_diff = DIFFICULTY_TIERS[max(0, idx - 1)]
            action_desc = f"Ease difficulty from {current_difficulty} to {next_diff}"
        elif best_action.startswith("recommend_"):
            next_diff = current_difficulty
            rec_type = best_action.replace("recommend_", "").title()
            action_desc = f"Focus next session on {rec_type} challenges"
        else:
            next_diff = current_difficulty
            action_desc = f"Maintain stable difficulty at {current_difficulty}"

        return {
            "algorithm": "Q-Learning Reinforcement Learning Agent",
            "state": state_key,
            "selected_action": best_action,
            "action_description": action_desc,
            "suggested_difficulty": next_diff,
            "q_value": round(q_values.get(best_action, 0.0), 3),
            "state_q_distribution": {k: round(v, 3) for k, v in q_values.items()},
        }


# Global singleton agent
rl_agent = CognitiveQLearningAgent()


def get_rl_recommendation(
    current_difficulty: str = "medium",
    recent_accuracy: float = 0.75,
    snooze_count: int = 0,
) -> Dict[str, Any]:
    return rl_agent.recommend_adaptation(current_difficulty, recent_accuracy, snooze_count)
