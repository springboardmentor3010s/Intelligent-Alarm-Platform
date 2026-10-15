from app.services.reinforcement_learning import (
    reinforcement_learning_service,
)


def main():
    rl = reinforcement_learning_service

    # Simulated user state
    recommendation = rl.get_recommendation(
        accuracy=90,
        response_time=4,
        attempts=1,
        current_difficulty="easy",
    )

    print("\n=== RL Recommendation ===")
    print(recommendation)

    # Calculate reward for a successful fast answer
    reward = rl.calculate_reward(
        correct=True,
        response_time=4,
        attempts=1,
    )

    print("\n=== Reward ===")
    print(reward)

    # Create current and next states
    current_state = rl.get_state(
        accuracy=90,
        response_time=4,
        attempts=1,
        current_difficulty="easy",
    )

    next_state = rl.get_state(
        accuracy=95,
        response_time=3,
        attempts=1,
        current_difficulty="medium",
    )

    # Update Q-value
    rl.update_q_value(
        state=current_state,
        action="medium",
        reward=reward,
        next_state=next_state,
    )

    print("\n=== Updated Q-Table ===")
    print(rl.q_table)


if __name__ == "__main__":
    main()