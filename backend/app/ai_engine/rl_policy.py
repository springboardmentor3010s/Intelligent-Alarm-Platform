# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Lightweight UCB1 contextual bandit for adaptive difficulty (Phase D)."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class Context:
    success_rate: float  # 0..1
    avg_time_sec: float
    attempts_recent: int
    preferred: Optional[str] = None


class ContextualBandit:
    """UCB1 bandit over difficulty arms; reward = recent success signal."""

    def __init__(self, arms: Optional[List[str]] = None, alpha: float = 1.0, decay: float = 0.99):
        self.arms = arms or ["Beginner", "Easy", "Medium", "Hard", "Expert"]
        self.alpha = alpha
        self.decay = decay
        self.count: Dict[str, float] = {a: 0.0 for a in self.arms}
        self.mean: Dict[str, float] = {a: 0.0 for a in self.arms}

    def _ucb(self, arm: str) -> float:
        c = self.count.get(arm, 0.0)
        if c == 0.0:
            return float("inf")
        total = sum(self.count.values())
        if total == 0.0:
            return self.mean.get(arm, 0.0)
        return self.mean.get(arm, 0.0) + self.alpha * math.sqrt(
            math.log(total + 1.0) / (c + 1e-6)
        )

    def choose(self, ctx: Context) -> str:
        # occasional exploit of the learner's stated preference, else explore/exploit via UCB
        if ctx.preferred in self.arms and random.random() < 0.3:
            return ctx.preferred
        return max(((self._ucb(a), a) for a in self.arms), key=lambda x: x[0])[1]

    def update(self, arm: str, reward: float) -> None:
        if arm not in self.arms:
            return
        self.count[arm] = self.count[arm] * self.decay + 1.0
        self.mean[arm] += (reward - self.mean[arm]) / (self.count[arm] + 1e-6)

    def blend(self, rule_based: str, ctx: Context, blend_ratio: float = 0.4) -> str:
        """Blend the rule-based recommendation with the bandit choice."""
        if blend_ratio <= 0.0:
            return rule_based
        if blend_ratio >= 1.0:
            return self.choose(ctx)
        return self.choose(ctx) if random.random() < blend_ratio else rule_based
