"""
Synthetic Benchmark Dataset Generator for XGBoost Wake-Up Prediction.

IMPORTANT NOTICE:
This dataset is a REPRODUCIBLE SYNTHETIC BENCHMARK intended solely for model training,
validation, and pipeline verification while real-world production data accumulates.
It is explicitly separated from real PostgreSQL database records.
Performance on this synthetic dataset does not represent real-world clinical or field accuracy.

Target Definition:
- on_time_wakeup = 1: User dismissed the alarm on the initial ring (snooze_count == 0),
  successfully solved the cognitive challenge (is_correct == True, session_status == 'completed'),
  and responded promptly within 60 seconds (response_time_seconds <= 60).
- on_time_wakeup = 0: User snoozed (snooze_count >= 1), OR challenge expired / failed,
  OR user took longer than 60 seconds to complete the dismissal.
"""

import os
import math
import random
import csv
from datetime import datetime, timedelta, time


CHALLENGE_TYPES = ["math", "word", "memory", "riddle", "logic", "pattern", "quiz"]
DIFFICULTIES = ["easy", "medium", "hard"]
DIFFICULTY_WEIGHTS = {"easy": 1, "medium": 2, "hard": 3}


def generate_benchmark_dataset(
    output_path: str = None,
    num_samples: int = 1200,
    seed: int = 42,
) -> str:
    """
    Generates a reproducible circadian benchmark dataset.
    """
    random.seed(seed)

    if output_path is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.join(base_dir, "data")
        os.makedirs(data_dir, exist_ok=True)
        output_path = os.path.join(data_dir, "synthetic_benchmark_dataset.csv")
    else:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    # 1. Generate 50 simulated user archetypes
    users = []
    for uid in range(1, 51):
        # Preferred wake time: normally distributed around 06:45
        pref_hour = int(random.gauss(6.75, 0.75))
        pref_hour = max(5, min(9, pref_hour))
        pref_min = random.choice([0, 15, 30, 45])
        preferred_wake = pref_hour * 60 + pref_min

        # Sleep duration target: 6 to 9 hours
        sleep_dur = random.choice([6, 7, 8, 8, 9])
        diff_pref = random.choices(["easy", "medium", "hard"], weights=[0.25, 0.55, 0.20])[0]

        # Base discipline / habit score: 40 to 95
        base_habit_score = max(35.0, min(98.0, random.gauss(72.0, 14.0)))

        users.append({
            "user_id": uid,
            "preferred_wake_minutes": preferred_wake,
            "sleep_duration": sleep_dur,
            "difficulty_preference": diff_pref,
            "base_habit_score": base_habit_score,
        })

    # 2. Generate longitudinal alarm events across 60 days
    start_date = datetime(2026, 1, 1, 0, 0, 0)
    records = []

    for i in range(num_samples):
        user = random.choice(users)
        day_offset = random.randint(0, 59)
        current_date = start_date + timedelta(days=day_offset)
        day_of_week = current_date.weekday()  # 0=Mon, 6=Sun
        is_weekend = 1 if day_of_week in [5, 6] else 0

        # Alarm time variation around preferred wake time
        if is_weekend:
            # On weekends, alarms often scheduled 30–90 min later
            alarm_delta = random.choice([0, 30, 60, 90, 120])
        else:
            # Weekdays: usually matches preferred wake time +/- 20 min
            alarm_delta = random.choice([-30, -15, 0, 0, 0, 15, 30])

        alarm_minutes = max(240, min(720, user["preferred_wake_minutes"] + alarm_delta))
        alarm_hour = alarm_minutes // 60
        alarm_minute = alarm_minutes % 60

        # Alarm configuration
        challenge_type = random.choice(CHALLENGE_TYPES)
        difficulty = random.choices(DIFFICULTIES, weights=[0.3, 0.5, 0.2])[0]
        difficulty_num = DIFFICULTY_WEIGHTS[difficulty]

        # Actual sleep prior night: deviates from sleep_duration
        # Short sleep on weeknights (late bedtimes)
        actual_sleep = user["sleep_duration"] + random.uniform(-2.2, 1.0)
        actual_sleep = max(4.0, min(10.5, actual_sleep))

        # Circadian alignment: discrepancy between alarm and preferred time
        schedule_diff = abs(alarm_minutes - user["preferred_wake_minutes"])

        # Prior historical aggregates for this user (with noise)
        prior_habit_score = max(20.0, min(100.0, user["base_habit_score"] + random.gauss(0, 5)))
        prior_snooze_rate = max(0.0, min(1.0, (100.0 - prior_habit_score) / 100.0 * 0.8))
        prior_avg_response_time = max(8.0, min(45.0, 12.0 + (difficulty_num * 5.0) + (100.0 - prior_habit_score) * 0.2))

        # Latent risk score (higher = more likely to snooze or groggy delay)
        # Science-based factors:
        # - Sleep deficit (<7 hours)
        # - Early morning (<06:00)
        # - Schedule discrepancy
        # - Hard difficulty cognitive demand
        # - Weekend inertia
        # - Low prior habit score
        risk = 0.0

        if actual_sleep < 6.0:
            risk += 0.35  # High sleep deficit
        elif actual_sleep < 7.0:
            risk += 0.18

        if alarm_hour < 6:
            risk += 0.25  # Waking before dawn
        elif alarm_hour > 9:
            risk += 0.10

        if schedule_diff > 45:
            risk += 0.20  # Circadian disruption

        if difficulty == "hard":
            risk += 0.15  # Mental friction on groggy brain

        if is_weekend:
            risk += 0.22  # Weekend relaxed mentality

        # Mitigation from user discipline
        discipline_factor = (prior_habit_score - 50.0) / 100.0  # -0.3 to +0.45
        risk -= discipline_factor

        # Add random human variance
        risk += random.gauss(0, 0.15)
        risk = max(0.05, min(0.95, risk))

        # Determine outcome from risk
        # Probability of on-time prompt wake-up = (1 - risk)
        p_on_time = 1.0 - risk

        is_on_time = 1 if random.random() < p_on_time else 0

        if is_on_time:
            snooze_count = 0
            session_status = "completed"
            is_correct = 1
            response_time_seconds = int(random.uniform(5, 45))
        else:
            # At-risk behavior: snooze, groggy response, or expired
            failure_mode = random.choices(["snooze", "delayed", "expired"], weights=[0.70, 0.22, 0.08])[0]
            if failure_mode == "snooze":
                snooze_count = random.choices([1, 2, 3], weights=[0.65, 0.25, 0.10])[0]
                session_status = "completed"
                is_correct = 1
                response_time_seconds = int(random.uniform(15, 60))
            elif failure_mode == "delayed":
                snooze_count = 0
                session_status = "completed"
                is_correct = 1
                # Groggy delay: took >60s to solve
                response_time_seconds = int(random.uniform(65, 180))
            else:  # expired
                snooze_count = 0
                session_status = "expired"
                is_correct = 0
                response_time_seconds = 300

        # Sine/Cosine cyclic encoding of alarm time
        time_rad = (alarm_minutes / 1440.0) * 2.0 * math.pi
        sin_alarm_time = round(math.sin(time_rad), 4)
        cos_alarm_time = round(math.cos(time_rad), 4)

        # Simulation timestamp
        event_timestamp = current_date.replace(hour=alarm_hour, minute=alarm_minute, second=0)

        # Target for Adaptive Difficulty (Multi-class: 0 = decrease, 1 = maintain, 2 = increase)
        if is_correct == 1 and response_time_seconds <= 25 and snooze_count == 0 and difficulty_num < 3:
            recommended_difficulty_action = 2  # increase
        elif is_correct == 0 or response_time_seconds > 60 or snooze_count >= 2:
            recommended_difficulty_action = 0 if difficulty_num > 1 else 1  # decrease if possible
        else:
            recommended_difficulty_action = 1  # maintain

        # Target for Behavioral Score Regressor (Continuous: 0.0 - 100.0)
        prompt_comp = 100.0 if (is_on_time and snooze_count == 0) else max(20.0, 75.0 - (snooze_count * 20.0))
        circadian_comp = max(30.0, 100.0 - min(70.0, schedule_diff * 0.8))
        challenge_comp = 100.0 if (is_correct and response_time_seconds <= 40) else (60.0 if is_correct else 30.0)
        raw_behavior_score = (
            0.40 * prior_habit_score
            + 0.30 * prompt_comp
            + 0.15 * circadian_comp
            + 0.15 * challenge_comp
        )
        target_behavior_score = round(max(15.0, min(100.0, raw_behavior_score)), 2)

        record = {
            "session_id": 1000 + i,
            "user_id": user["user_id"],
            "event_timestamp": event_timestamp.isoformat(),
            # PREDICTION-TIME FEATURES (Zero Data Leakage)
            "alarm_hour": alarm_hour,
            "alarm_minute": alarm_minute,
            "alarm_time_minutes": alarm_minutes,
            "sin_alarm_time": sin_alarm_time,
            "cos_alarm_time": cos_alarm_time,
            "day_of_week": day_of_week,
            "is_weekend": is_weekend,
            "challenge_type": challenge_type,
            "difficulty": difficulty,
            "difficulty_num": difficulty_num,
            "preferred_wake_minutes": user["preferred_wake_minutes"],
            "schedule_diff_minutes": schedule_diff,
            "sleep_duration_hours": user["sleep_duration"],
            "prior_habit_score": round(prior_habit_score, 2),
            "prior_snooze_rate": round(prior_snooze_rate, 4),
            "prior_avg_response_time": round(prior_avg_response_time, 2),
            # POST-EVENT OUTCOME FIELDS (for ground truth labeling only)
            "snooze_count": snooze_count,
            "session_status": session_status,
            "is_correct": is_correct,
            "response_time_seconds": response_time_seconds,
            # TARGET VARIABLES
            # Target 1: Binary Wakeup (1 = On-Time Prompt Wakeup, 0 = Delayed/Snooze/Expired)
            "on_time_wakeup": is_on_time,
            # Target 2: Multi-class Difficulty Adjustment (0 = decrease, 1 = maintain, 2 = increase)
            "recommended_difficulty_action": recommended_difficulty_action,
            # Target 3: Continuous Behavioral Sustainability Score (0.0 - 100.0)
            "target_behavior_score": target_behavior_score,
            # DATASET PROVENANCE MARKER
            "data_provenance": "SYNTHETIC_BENCHMARK_DATA",
        }
        records.append(record)

    # Sort chronologically by timestamp (essential for chronological train/test split)
    records.sort(key=lambda r: r["event_timestamp"])

    # Write to CSV
    fieldnames = list(records[0].keys())
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    print(f"[Dataset Generator] Successfully generated {len(records)} benchmark records.")
    print(f"[Dataset Generator] Saved to: {output_path}")
    print(f"[Dataset Generator] Class balance: On-Time = {sum(r['on_time_wakeup'] for r in records)} / {len(records)} ({sum(r['on_time_wakeup'] for r in records)/len(records):.1%})")

    return output_path


if __name__ == "__main__":
    generate_benchmark_dataset()
