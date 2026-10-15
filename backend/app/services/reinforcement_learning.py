from typing import Dict, Tuple
import random

from sqlalchemy.orm import Session

from app.models.rl_q_value import RLQValue


class ReinforcementLearningService:
    """
    Lightweight Q-learning based reinforcement learning service.

    Q-values are stored in PostgreSQL so that the agent
    remembers what it learns across requests and restarts.
    """

    ACTIONS = ["beginner", "easy", "medium", "hard", "expert"]

    def __init__(self):
        self.learning_rate = 0.1
        self.discount_factor = 0.9
        self.exploration_rate = 0.1

    def get_state(
        self,
        accuracy: float,
        response_time: float,
        attempts: float,
        current_difficulty: str,
    ) -> Tuple:
        """
        Convert user performance into an RL state.
        """

        if accuracy >= 80:
            performance = "high"
        elif accuracy >= 50:
            performance = "medium"
        else:
            performance = "low"

        if response_time <= 5:
            speed = "fast"
        elif response_time <= 10:
            speed = "normal"
        else:
            speed = "slow"

        if attempts <= 1:
            attempt_level = "low"
        elif attempts <= 2:
            attempt_level = "medium"
        else:
            attempt_level = "high"

        return (
            performance,
            speed,
            attempt_level,
            current_difficulty.lower(),
        )

    def state_to_string(self, state: Tuple) -> str:
        """
        Convert the tuple state into a database-friendly string.
        """

        return "|".join(state)

    def string_to_state(self, state: str) -> Tuple:
        """
        Convert database state string back into a tuple.
        """

        return tuple(state.split("|"))

    def get_q_values(
        self,
        db: Session,
        user_id: int,
        state: Tuple,
    ) -> Dict[str, float]:
        """
        Load Q-values for a user and state.

        Missing actions automatically start at 0.
        """

        state_string = self.state_to_string(state)

        records = (
            db.query(RLQValue)
            .filter(
                RLQValue.user_id == user_id,
                RLQValue.state == state_string,
            )
            .all()
        )

        q_values = {
            action: 0.0
            for action in self.ACTIONS
        }

        for record in records:
            if record.action in self.ACTIONS:
                q_values[record.action] = record.q_value

        return q_values

    def choose_action(
        self,
        db: Session,
        user_id: int,
        state: Tuple,
    ) -> str:
        """
        Choose an action using epsilon-greedy strategy.
        """

        q_values = self.get_q_values(
            db=db,
            user_id=user_id,
            state=state,
        )

        # Exploration
        if random.random() < self.exploration_rate:
            return random.choice(self.ACTIONS)

        # Exploitation
        return max(
            q_values,
            key=q_values.get,
        )

    def calculate_reward(
        self,
        correct: bool,
        response_time: float,
        attempts: int,
    ) -> float:
        """
        Calculate reward from the user's challenge result.
        """

        if not correct:
            return -10.0

        if response_time <= 5 and attempts <= 1:
            return 10.0

        if response_time <= 10:
            return 5.0

        if attempts <= 2:
            return 3.0

        return 1.0

    def update_q_value(
        self,
        db: Session,
        user_id: int,
        state: Tuple,
        action: str,
        reward: float,
        next_state: Tuple,
    ):
        """
        Update and persist a Q-value using the Q-learning formula.
        """

        state_string = self.state_to_string(state)

        next_q_values = self.get_q_values(
            db=db,
            user_id=user_id,
            state=next_state,
        )

        best_next_q = max(
            next_q_values.values()
        )

        record = (
            db.query(RLQValue)
            .filter(
                RLQValue.user_id == user_id,
                RLQValue.state == state_string,
                RLQValue.action == action,
            )
            .first()
        )

        if record is None:
            current_q = 0.0

            record = RLQValue(
                user_id=user_id,
                state=state_string,
                action=action,
                q_value=0.0,
            )

            db.add(record)
        else:
            current_q = record.q_value

        new_q = current_q + self.learning_rate * (
            reward
            + self.discount_factor * best_next_q
            - current_q
        )

        record.q_value = new_q

        db.commit()
        db.refresh(record)

        return new_q

    def get_recommendation(
        self,
        db: Session,
        user_id: int,
        accuracy: float,
        response_time: float,
        attempts: float,
        current_difficulty: str,
    ) -> dict:
        """
        Generate an RL-based difficulty recommendation
        using persistent Q-values.
        """

        state = self.get_state(
            accuracy=accuracy,
            response_time=response_time,
            attempts=attempts,
            current_difficulty=current_difficulty,
        )

        q_values = self.get_q_values(
            db=db,
            user_id=user_id,
            state=state,
        )

        action = self.choose_action(
            db=db,
            user_id=user_id,
            state=state,
        )

        return {
            "state": {
                "performance": state[0],
                "speed": state[1],
                "attempt_level": state[2],
                "current_difficulty": state[3],
            },
            "q_values": q_values,
            "recommended_difficulty": action,
            "method": "q_learning",
        }


reinforcement_learning_service = ReinforcementLearningService()