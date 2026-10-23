"""Adaptive Difficulty Engine.

1. DifficultyModel - a scikit-learn logistic-regression classifier that decides whether the user's
   next alarm should be easier / the same / harder, from three engagement features measured over
   recent wake sessions: accuracy, relative solve speed and snoozes.
   Cold start: there is no real behaviour data on day one, so the model is bootstrapped from
   rule-labelled synthetic examples (with label noise) and retrained on real sessions via
   `retrain` once enough exist. It is NOT trained on external human data.

2. Thompson-sampling bandit - a minimal reinforcement-learning method that picks which challenge
   TYPE to serve, learning each user's per-type success/speed from their own history.
"""
import random

import numpy as np
from sqlalchemy.orm import Session
from sklearn.linear_model import LogisticRegression

from app.models import (CHALLENGE_TYPES, LEVELS, ChallengeInstance, UserProfile, WakeSession)


def _bootstrap(n=1500, seed=7):
    rng = random.Random(seed)
    X, y = [], []
    for k in range(n):
        zone = k % 3  # balanced mixture of strong / weak / typical users so all 3 classes are learnable
        if zone == 0:
            acc, speed, snz = rng.uniform(0.7, 1), rng.uniform(0.2, 1), rng.uniform(0, 1.5)
        elif zone == 1:
            acc, speed, snz = rng.uniform(0, 0.65), rng.uniform(0, 0.8), rng.uniform(0, 3)
        else:
            acc, speed, snz = rng.random(), rng.random(), rng.uniform(0, 3)
        if acc >= 0.85 and speed >= 0.4 and snz < 0.8:
            label = 1
        elif acc <= 0.5 or snz >= 2.0:
            label = -1
        else:
            label = 0
        if rng.random() < 0.05:  # label noise so the boundary is smooth, not a memorised rule
            label = rng.choice([-1, 0, 1])
        X.append([acc, speed, snz])
        y.append(label)
    return np.array(X), np.array(y)


class DifficultyModel:
    def __init__(self):
        X, y = _bootstrap()
        self.model = LogisticRegression(max_iter=2000, class_weight="balanced").fit(X, y)
        self.source = "bootstrap"
        self.n_real = 0

    def predict_delta(self, accuracy: float, speed: float, snoozes: float) -> int:
        return int(self.model.predict(np.array([[accuracy, speed, snoozes]]))[0])

    def retrain(self, X, y) -> bool:
        if len(X) < 60 or len(set(y)) < 2:
            return False
        self.model = LogisticRegression(max_iter=2000, class_weight="balanced").fit(np.array(X), np.array(y))
        self.source, self.n_real = "live_sessions", len(X)
        return True


difficulty_model = DifficultyModel()


def session_features(db: Session, user_id, window: int = 5):
    sessions = (db.query(WakeSession)
                .filter(WakeSession.user_id == user_id, WakeSession.is_practice.is_(False),
                        WakeSession.status == "dismissed")
                .order_by(WakeSession.started_at.desc()).limit(window).all())
    if len(sessions) < 3:
        return None
    ids = [s.id for s in sessions]
    inst = db.query(ChallengeInstance).filter(ChallengeInstance.session_id.in_(ids),
                                              ChallengeInstance.answered_at.isnot(None)).all()
    if not inst:
        return None
    accuracy = sum(1 for i in inst if i.is_correct) / len(inst)
    ratios = [min(1.0, (i.time_taken_seconds or i.time_limit_seconds) / max(1, i.time_limit_seconds)) for i in inst]
    speed = 1 - sum(ratios) / len(ratios)
    snoozes = sum(s.snooze_count for s in sessions) / len(sessions)
    return accuracy, speed, snoozes


def next_difficulty(db: Session, user_id, current: str) -> str:
    """Re-evaluated after each completed (non-practice) wake session."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile and profile.difficulty_preference in LEVELS:
        return profile.difficulty_preference  # user pinned a fixed level
    feats = session_features(db, user_id)
    if not feats:
        return current
    delta = difficulty_model.predict_delta(*feats)
    idx = max(0, min(len(LEVELS) - 1, LEVELS.index(current) + delta))
    return LEVELS[idx]


def choose_type(db: Session, user_id, allowed: list[str], exclude: set[str] | None = None,
                rng: random.Random | None = None) -> str:
    """Thompson sampling over per-type Beta(success+1, failure+1); success = correct AND reasonably fast."""
    r = rng or random.Random()
    pool = [t for t in allowed if t in CHALLENGE_TYPES and t not in (exclude or set())] or \
           [t for t in allowed if t in CHALLENGE_TYPES] or list(CHALLENGE_TYPES)
    rows = (db.query(ChallengeInstance)
            .filter(ChallengeInstance.user_id == user_id, ChallengeInstance.answered_at.isnot(None),
                    ChallengeInstance.is_practice.is_(False))
            .order_by(ChallengeInstance.issued_at.desc()).limit(200).all())
    stats = {t: [1, 1] for t in pool}
    for i in rows:
        if i.challenge_type in stats:
            good = bool(i.is_correct) and (i.time_taken_seconds or 0) <= 0.6 * i.time_limit_seconds
            stats[i.challenge_type][0 if good else 1] += 1
    # Sample, but keep exploring: blend in a uniform draw so no type starves.
    scored = {t: r.betavariate(a, b) * 0.8 + r.random() * 0.2 for t, (a, b) in stats.items()}
    return max(scored, key=scored.get)
