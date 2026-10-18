import json
import os
import random


# =========================================================
# Reinforcement Learning - Adaptive Difficulty
# =========================================================

class AdaptiveDifficultyRL:

    def __init__(self):

        self.difficulties = [
            "easy",
            "medium",
            "hard"
        ]

        # Q-table:
        # state -> difficulty -> Q-value
        self.q_table = {}

        self.learning_rate = 0.1
        self.discount_factor = 0.9
        self.exploration_rate = 0.1

        self.model_path = os.path.join(
            os.path.dirname(__file__),
            "rl_q_table.json"
        )

        self.load_q_table()

    # =====================================================
    # Convert performance into RL state
    # =====================================================

    def get_state(self, performance):

        if performance < 60:
            return "low"

        elif performance < 80:
            return "moderate"

        elif performance < 90:
            return "good"

        else:
            return "excellent"

    # =====================================================
    # Initialize Q-table with sensible starting policy
    # =====================================================

    def initialize_state(self, state):

        if state in self.q_table:
            return

        if state == "low":

            self.q_table[state] = {
                "easy": 1.0,
                "medium": 0.0,
                "hard": -1.0
            }

        elif state == "moderate":

            self.q_table[state] = {
                "easy": 0.2,
                "medium": 1.0,
                "hard": 0.2
            }

        elif state == "good":

            self.q_table[state] = {
                "easy": 0.0,
                "medium": 0.7,
                "hard": 1.0
            }

        else:  # excellent

            self.q_table[state] = {
                "easy": -0.5,
                "medium": 0.5,
                "hard": 1.5
            }

    # =====================================================
    # Choose difficulty
    # =====================================================

    def choose_difficulty(self, performance):

        state = self.get_state(performance)

        self.initialize_state(state)

        # Exploration
        if random.random() < self.exploration_rate:

            return random.choice(
                self.difficulties
            )

        # Exploitation
        q_values = self.q_table[state]

        return max(
            q_values,
            key=q_values.get
        )

    # =====================================================
    # Calculate reward
    # =====================================================

    def calculate_reward(
        self,
        performance,
        difficulty
    ):

        # Low performance
        if performance < 60:

            if difficulty == "easy":
                return 2.0

            elif difficulty == "medium":
                return -1.0

            else:
                return -2.0

        # Moderate performance
        elif performance < 80:

            if difficulty == "medium":
                return 2.0

            elif difficulty == "easy":
                return 0.5

            else:
                return -0.5

        # Good performance
        elif performance < 90:

            if difficulty == "hard":
                return 2.0

            elif difficulty == "medium":
                return 1.0

            else:
                return 0.2

        # Excellent performance
        else:

            if difficulty == "hard":
                return 3.0

            elif difficulty == "medium":
                return 1.0

            else:
                return -0.5

    # =====================================================
    # Update Q-value
    # =====================================================

    def update(
        self,
        performance,
        difficulty,
        reward
    ):

        state = self.get_state(
            performance
        )

        self.initialize_state(
            state
        )

        current_q = self.q_table[
            state
        ][difficulty]

        max_future_q = max(
            self.q_table[state].values()
        )

        new_q = (
            current_q
            + self.learning_rate
            * (
                reward
                + self.discount_factor
                * max_future_q
                - current_q
            )
        )

        self.q_table[
            state
        ][difficulty] = round(
            new_q,
            4
        )

        self.save_q_table()

    # =====================================================
    # Adaptive difficulty decision
    # =====================================================

    def adapt_difficulty(
        self,
        performance
    ):

        state = self.get_state(
            performance
        )

        self.initialize_state(
            state
        )

        difficulty = self.choose_difficulty(
            performance
        )

        reward = self.calculate_reward(
            performance,
            difficulty
        )

        self.update(
            performance,
            difficulty,
            reward
        )

        return {
            "state": state,
            "selected_difficulty": difficulty,
            "reward": reward,
            "q_values": self.q_table[state]
        }

    # =====================================================
    # Save Q-table
    # =====================================================

    def save_q_table(self):

        with open(
            self.model_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                self.q_table,
                file,
                indent=4
            )

    # =====================================================
    # Load Q-table
    # =====================================================

    def load_q_table(self):

        if not os.path.exists(
            self.model_path
        ):
            return

        try:

            with open(
                self.model_path,
                "r",
                encoding="utf-8"
            ) as file:

                self.q_table = json.load(file)

        except (
            json.JSONDecodeError,
            OSError
        ):

            self.q_table = {}


# =========================================================
# Standalone Test
# =========================================================

if __name__ == "__main__":

    # Start with a fresh Q-table for demonstration.
    # This prevents an old test file from affecting the result.
    rl_agent = AdaptiveDifficultyRL()

    rl_agent.q_table = {}

    test_performances = [
        45,
        68,
        82,
        94
    ]

    print("\n========================================")
    print("Reinforcement Learning Test")
    print("========================================")

    for performance in test_performances:

        result = rl_agent.adapt_difficulty(
            performance
        )

        print(
            f"\nPerformance: {performance}%"
        )

        print(
            f"RL State: {result['state']}"
        )

        print(
            f"Selected Difficulty: "
            f"{result['selected_difficulty']}"
        )

        print(
            f"Reward: {result['reward']}"
        )

        print(
            f"Q-values: {result['q_values']}"
        )

    print("\n========================================")
    print("RL Test Completed")
    print("========================================")