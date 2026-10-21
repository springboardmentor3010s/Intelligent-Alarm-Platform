import os
import sys

# Ensure we can import from ml directory
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__))))

from ml.rl_agent import QLearningAgent
from services.adaptive_difficulty import predict_performance

# Initialize the Q-Learning Agent with persistent q_table.json
agent_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "q_table.json")
agent = QLearningAgent(model_path=agent_path)

DIFFICULTY_LEVELS = [
    "Beginner",
    "Easy",
    "Medium",
    "Hard",
    "Expert"
]


def compute_reward(state: int, action: int) -> float:
    """
    Computes RL reward signal to maintain user in optimal cognitive flow.
    Performance States: 0 = Low, 1 = Medium, 2 = High
    Actions: 0 = Easier, 1 = Same, 2 = Harder
    """
    if state == 2:  # High Performance
        return 1.0 if action == 2 else (0.2 if action == 1 else -1.0)
    elif state == 0:  # Low Performance
        return 1.0 if action == 0 else (-0.2 if action == 1 else -1.0)
    else:  # Medium Performance (Optimal Flow State)
        return 1.0 if action == 1 else (-0.5 if action == 0 else 0.0)


def get_next_difficulty(
    correctness: float,
    solve_time: float,
    attempts: int,
    current_difficulty
):
    """
    Computes the next difficulty level using the RF + XGBoost ensemble 
    followed by the Q-Learning reinforcement learning agent.

    Actions:
    0 = Easier
    1 = Same
    2 = Harder

    Boundaries:
    - Beginner (0) cannot become easier than Beginner.
    - Expert (4) cannot become harder than Expert.
    """
    # Normalize current_difficulty to 0-4 index
    if isinstance(current_difficulty, str):
        if current_difficulty in DIFFICULTY_LEVELS:
            current_idx = DIFFICULTY_LEVELS.index(current_difficulty)
        else:
            current_idx = 2  # Default to Medium
    else:
        current_idx = int(current_difficulty)

    current_idx = max(0, min(len(DIFFICULTY_LEVELS) - 1, current_idx))

    # Predict performance state using RF + XGBoost ensemble
    result = predict_performance(
        correctness=correctness,
        solve_time=solve_time,
        attempts=attempts,
        difficulty=current_idx
    )

    performance = result["performance_level"]
    state = result.get("performance_class", 0 if performance == "Low" else (1 if performance == "Medium" else 2))

    # Q-Learning Agent selects action based on performance state
    # 0 = Easier, 1 = Same, 2 = Harder
    action = agent.get_action(
        state,
        explore=False
    )

    # Online Q-Learning policy update from verified performance
    reward = compute_reward(state, int(action))
    try:
        agent.update(state, int(action), reward, next_state=1)
    except Exception as err:
        print(f"[RL] Q-table update warning: {err}")

    if action == 0:
        next_level = max(0, current_idx - 1)
    elif action == 1:
        next_level = current_idx
    elif action == 2:
        next_level = min(len(DIFFICULTY_LEVELS) - 1, current_idx + 1)
    else:
        next_level = current_idx

    return {
        "performance": performance,
        "performance_class": state,
        "action": int(action),
        "reward": reward,
        "current_difficulty": DIFFICULTY_LEVELS[current_idx],
        "current_difficulty_index": current_idx,
        "next_difficulty": DIFFICULTY_LEVELS[next_level],
        "next_difficulty_index": next_level,
        "probabilities": result["probabilities"]
    }
