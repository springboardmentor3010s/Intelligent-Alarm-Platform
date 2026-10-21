def calculate_habit_score(
    wake_up_consistency_score,
    challenge_completion_rate,
    snooze_count,
    sleep_adherence_score
):

    # -----------------------------------------
    # Wake-up Consistency: 35 points
    # -----------------------------------------

    wake_score = max(
        0,
        min(35, wake_up_consistency_score)
    )

    # -----------------------------------------
    # Challenge Completion: 25 points
    # -----------------------------------------

    challenge_score = (
        max(
            0,
            min(1, challenge_completion_rate)
        ) * 25
    )

    # -----------------------------------------
    # Snooze Reduction: 20 points
    #
    # 5 points deduction per snooze
    # -----------------------------------------

    snooze_score = max(
        0,
        20 - (snooze_count * 5)
    )

    # -----------------------------------------
    # Sleep Adherence: 20 points
    # -----------------------------------------

    sleep_score = max(
        0,
        min(20, sleep_adherence_score)
    )

    # -----------------------------------------
    # Final score
    # -----------------------------------------

    total = (
        wake_score
        + challenge_score
        + snooze_score
        + sleep_score
    )

    return round(
        max(0, min(100, total)),
        2
    )
