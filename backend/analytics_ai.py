from mongodb import behavior_events
import pandas as pd
import numpy as np


def get_behavior_dataframe():
    """
    Read behavioral events from MongoDB
    and convert them into a Pandas DataFrame.
    """

    events = list(
        behavior_events.find(
            {},
            {"_id": 0}
        )
    )

    if not events:
        return pd.DataFrame()

    df = pd.DataFrame(events)

    return df


def analyze_challenge_behavior(user_id):
    """
    Analyze challenge behavior using Pandas and NumPy.
    """

    df = get_behavior_dataframe()

    if df.empty:
        return {
            "message": "No behavioral data available"
        }

    # Keep only challenge answer events
    challenge_df = df[
        (df["event_type"] == "challenge_answered") &
        (df["user_id"] == user_id)
    ].copy()

    if challenge_df.empty:
        return {
            "message": "No challenge data available for this user"
        }

    # Extract event_data fields
    event_data = pd.json_normalize(
        challenge_df["event_data"]
    )

    challenge_df = challenge_df.reset_index(drop=True)

    result_df = pd.concat(
        [
            challenge_df[
                ["user_id", "timestamp"]
            ],
            event_data
        ],
        axis=1
    )

    # Convert values to numeric
    result_df["is_correct"] = (
    result_df["is_correct"]
    .fillna(False)
    .astype(bool)
    .astype(int)
)

    result_df["attempts"] = pd.to_numeric(
        result_df["attempts"],
        errors="coerce"
    )

    result_df["time_taken"] = pd.to_numeric(
        result_df["time_taken"],
        errors="coerce"
    )

    # NumPy calculations
    accuracy = np.mean(
        result_df["is_correct"].to_numpy()
    ) * 100

    average_time = np.mean(
        result_df["time_taken"].dropna().to_numpy()
    )

    average_attempts = np.mean(
        result_df["attempts"].dropna().to_numpy()
    )

    return {
        "user_id": user_id,
        "total_challenges": len(result_df),
        "correct_answers": int(
            result_df["is_correct"].sum()
        ),
        "wrong_answers": int(
            len(result_df)
            - result_df["is_correct"].sum()
        ),
        "accuracy_percentage": round(
            float(accuracy), 2
        ),
        "average_time_taken": round(
            float(average_time), 2
        ),
        "average_attempts": round(
            float(average_attempts), 2
        )
    }