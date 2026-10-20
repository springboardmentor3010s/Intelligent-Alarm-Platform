import random
import time
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, GradientBoostingRegressor
from sklearn.metrics.pairwise import cosine_similarity

try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

DIFFICULTY_LEVELS = ["Beginner", "Easy", "Medium", "Hard", "Expert"]

CHALLENGE_TYPES = [
    "Math Problems",
    "Logic Puzzles",
    "Memory Challenges",
    "Word Games",
    "Pattern Recognition",
    "Riddles",
    "Quick Quizzes"
]

VERIFICATION_METHODS = [
    "Puzzle Completion",
    "Multi-Step Challenges",
    "Consecutive Correct Answers",
    "Time-Based Challenges",
    "Cognitive Accuracy Checks"
]

QUESTION_BANK = {
    "Logic Puzzles": {
        "Beginner": [
            {"q": "If all Bloops are Razzies and all Razzies are Lazzies, are all Bloops definitely Lazzies? (yes/no)", "a": "yes"},
            {"q": "Which weighs more: 1 kg of iron or 1 kg of cotton? (iron/cotton/equal)", "a": "equal"}
        ],
        "Easy": [
            {"q": "A shepherd has 17 sheep. All but 9 run away. How many sheep are left?", "a": "9"},
            {"q": "You are running a race and overtake the person in 2nd place. What position are you in now? (1st/2nd/3rd)", "a": "2nd"}
        ],
        "Medium": [
            {"q": "Two fathers and two sons go fishing. Each catches 1 fish. Total fish caught is 3. How many people went?", "a": "3"},
            {"q": "If 3 cats catch 3 mice in 3 minutes, how many minutes does it take 100 cats to catch 100 mice?", "a": "3"}
        ],
        "Hard": [
            {"q": "A bat and a ball cost 110 in total. The bat costs 100 more than the ball. How much does the ball cost?", "a": "5"},
            {"q": "A lily pad patch doubles in size daily. If it takes 48 days to cover the lake, how many days for half the lake?", "a": "47"}
        ],
        "Expert": [
            {"q": "5 machines take 5 minutes to make 5 widgets. How many minutes would 100 machines take to make 100 widgets?", "a": "5"}
        ]
    },
    "Memory Challenges": {
        "Beginner": [{"q": "Memorize and type this sequence backwards: 4 - 9 - 2 (type: 294)", "a": "294"}],
        "Easy": [{"q": "Memorize and type this sequence backwards: 7 - 1 - 8 - 3 (type: 3817)", "a": "3817"}],
        "Medium": [{"q": "Type only the EVEN digits in order from: 9, 4, 7, 2, 5, 8 (type: 428)", "a": "428"}],
        "Hard": [{"q": "Memorize: ALPHA-7-BRAVO-3. What is 7 + 3 + length of ALPHA?", "a": "15"}],
        "Expert": [{"q": "Reverse this cognitive code: K9M2P8", "a": "8p2m9k"}]
    },
    "Word Games": {
        "Beginner": [{"q": "Unscramble the morning word: M R A L A", "a": "alarm"}],
        "Easy": [{"q": "Unscramble the wake-up word: O F E C E F", "a": "coffee"}],
        "Medium": [{"q": "Unscramble the productivity word: O C U S F", "a": "focus"}],
        "Hard": [{"q": "Unscramble the cognitive word: N E R O U N", "a": "neuron"}],
        "Expert": [{"q": "Unscramble the biological clock word: C I R C A D I A N", "a": "circadian"}]
    },
    "Pattern Recognition": {
        "Beginner": [{"q": "Next number in sequence: 2, 4, 6, 8, ?", "a": "10"}],
        "Easy": [{"q": "Next number in sequence: 3, 6, 12, 24, ?", "a": "48"}],
        "Medium": [{"q": "Next Fibonacci number: 1, 1, 2, 3, 5, 8, 13, ?", "a": "21"}],
        "Hard": [{"q": "Next number in sequence: 2, 6, 12, 20, 30, ?", "a": "42"}],
        "Expert": [{"q": "Next prime-squared number: 4, 9, 25, 49, 121, ?", "a": "169"}]
    },
    "Riddles": {
        "Beginner": [{"q": "What has hands and a face, but cannot hold anything or smile? (one word)", "a": "clock"}],
        "Easy": [{"q": "What has to be broken before you can use it? (one word)", "a": "egg"}],
        "Medium": [{"q": "I speak without a mouth and hear without ears. What am I? (one word)", "a": "echo"}],
        "Hard": [{"q": "The more of this there is, the less you see. What is it? (one word)", "a": "darkness"}],
        "Expert": [{"q": "What disappears as soon as you say its name? (one word)", "a": "silence"}]
    },
    "Quick Quizzes": {
        "Beginner": [{"q": "How many hours are in 2 full days?", "a": "48"}],
        "Easy": [{"q": "Which hormone regulates the sleep-wake cycle? (melatonin/insulin)", "a": "melatonin"}],
        "Medium": [{"q": "Which stage of sleep has vivid dreaming? (rem/nrem)", "a": "rem"}],
        "Hard": [{"q": "What is the internal 24-hour biological clock called? (circadian/ultradian)", "a": "circadian"}],
        "Expert": [{"q": "Which neurotransmitter builds up during wakefulness to create sleep pressure? (adenosine/dopamine)", "a": "adenosine"}]
    }
}

def generate_math_problem(difficulty: str):
    if difficulty == "Beginner":
        a, b = random.randint(5, 20), random.randint(5, 20)
        return {"q": f"Calculate: {a} + {b}", "a": str(a + b)}
    elif difficulty == "Easy":
        a, b, c = random.randint(15, 50), random.randint(10, 30), random.randint(1, 15)
        return {"q": f"Calculate: ({a} + {b}) - {c}", "a": str((a + b) - c)}
    elif difficulty == "Medium":
        a, b, c = random.randint(6, 15), random.randint(5, 12), random.randint(10, 40)
        return {"q": f"Calculate: ({a} * {b}) + {c}", "a": str((a * b) + c)}
    elif difficulty == "Hard":
        a, b, c = random.randint(12, 25), random.randint(8, 15), random.randint(20, 60)
        return {"q": f"Calculate: ({a} * {b}) - {c}", "a": str((a * b) - c)}
    else:
        a, b, c = random.randint(11, 19), random.randint(11, 19), random.randint(5, 12)
        return {"q": f"Calculate: ({a} * {b}) + ({c}²)", "a": str((a * b) + (c ** 2))}

def generate_cognitive_challenge(challenge_type: str, difficulty: str, verification_method: str = "Puzzle Completion"):
    t0 = time.perf_counter()
    if challenge_type not in CHALLENGE_TYPES:
        challenge_type = "Math Problems"
    if difficulty not in DIFFICULTY_LEVELS:
        difficulty = "Easy"
    if verification_method not in VERIFICATION_METHODS:
        verification_method = "Puzzle Completion"

    if challenge_type == "Math Problems":
        item = generate_math_problem(difficulty)
    else:
        bank = QUESTION_BANK.get(challenge_type, {}).get(difficulty, QUESTION_BANK["Logic Puzzles"]["Easy"])
        item = random.choice(bank)

    required_steps = 1
    time_limit_sec = 120
    if verification_method == "Multi-Step Challenges":
        required_steps = 2
    elif verification_method == "Consecutive Correct Answers":
        required_steps = 3
    elif verification_method == "Time-Based Challenges":
        time_limit_sec = 30
    elif verification_method == "Cognitive Accuracy Checks":
        required_steps = 2
        time_limit_sec = 45

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "challenge_id": f"chg_{random.randint(10000, 99999)}",
        "challenge_type": challenge_type,
        "difficulty": difficulty,
        "verification_method": verification_method,
        "required_steps": required_steps,
        "time_limit_seconds": time_limit_sec,
        "question": item["q"],
        "expected_answer": item["a"].strip().lower(),
        "generation_latency_ms": latency_ms
    }

def adapt_user_difficulty(current_difficulty: str, logs: list) -> dict:
    if current_difficulty not in DIFFICULTY_LEVELS:
        current_difficulty = "Easy"
    idx = DIFFICULTY_LEVELS.index(current_difficulty)

    if not logs:
        q_table = {lvl: round(0.50 + i * 0.08, 2) for i, lvl in enumerate(DIFFICULTY_LEVELS)}
        q_table[current_difficulty] = 0.91
        return {
            "new_difficulty": current_difficulty,
            "reward_signal": 0.85,
            "q_table": q_table,
            "learning_pattern": "Baseline Initialized",
            "engagement_optimization": "Balanced Cognitive Load",
            "action": f"Current Stage: {current_difficulty}"
        }

    recent = logs[-5:]
    accuracy = np.mean([1.0 if l.get("is_successful") else 0.0 for l in recent])
    avg_time = np.mean([float(l.get("completion_time_seconds", 20.0)) for l in recent])
    snooze_rate = np.mean([1.0 if l.get("snoozed") else 0.0 for l in recent])

    time_penalty = min(avg_time / 60.0, 1.0) * 0.45
    reward = round((accuracy * 1.5) - (snooze_rate * 1.0) - time_penalty, 2)

    action = f"Maintained {DIFFICULTY_LEVELS[idx]} Stage"
    if reward >= 0.85 and len(recent) >= 2 and idx < len(DIFFICULTY_LEVELS) - 1:
        idx += 1
        action = f"Upgraded Difficulty Stage to {DIFFICULTY_LEVELS[idx]}"
    elif reward < 0.25 and idx > 0:
        idx -= 1
        action = f"Adjusted Difficulty Stage to {DIFFICULTY_LEVELS[idx]}"

    q_table = {}
    for i, lvl in enumerate(DIFFICULTY_LEVELS):
        q_table[lvl] = round(0.94 if i == idx else max(0.35, 0.78 - abs(i - idx) * 0.14), 2)

    return {
        "new_difficulty": DIFFICULTY_LEVELS[idx],
        "reward_signal": reward,
        "q_table": q_table,
        "recent_accuracy": round(accuracy * 100, 1),
        "avg_completion_time": round(avg_time, 1),
        "learning_pattern": "Fast Recall" if avg_time < 16 else "Steady Analytical Solving",
        "engagement_optimization": "High Engagement" if snooze_rate == 0 else "Anti-Snooze Mode Active",
        "action": action
    }

def compute_weighted_habit_score(logs: list, preferred_sleep_hours: float = 8.0, active_alarms_count: int = 1) -> dict:
    if not logs:
        base_consistency = 31.5 if active_alarms_count > 0 else 24.0
        adherence_factor = min(preferred_sleep_hours / 8.0, 1.0) if preferred_sleep_hours > 0 else 0.85
        sleep_score = round(adherence_factor * 20.0, 2)
        total = round(base_consistency + 21.0 + 18.0 + sleep_score, 2)
        return {
            "wake_up_consistency_score": base_consistency,
            "challenge_completion_score": 21.0,
            "snooze_reduction_score": 18.0,
            "sleep_adherence_score": sleep_score,
            "total_habit_score": min(total, 100.0),
            "habit_adherence_rating": 89.5,
            "productivity_score": 87.0,
            "sleep_routine_score": round(adherence_factor * 100, 1)
        }

    df = pd.DataFrame(logs)
    success_ratio = float(df["is_successful"].mean()) if "is_successful" in df else 0.0
    challenge_score = round(success_ratio * 25.0, 2)

    snooze_ratio = float(df["snoozed"].mean()) if "snoozed" in df else 0.0
    snooze_score = round((1.0 - snooze_ratio) * 20.0, 2)

    recent_streak = min(len(df), 10) / 10.0
    alarm_bonus = min(active_alarms_count * 0.04, 0.12)
    wake_consistency_score = round(min(1.0, 0.65 + (0.25 * recent_streak) + alarm_bonus) * 35.0, 2)

    adherence_factor = min(preferred_sleep_hours / 8.0, 1.0) if preferred_sleep_hours > 0 else 0.85
    sleep_adherence_score = round(adherence_factor * 20.0, 2)

    total_score = min(round(wake_consistency_score + challenge_score + snooze_score + sleep_adherence_score, 2), 100.0)

    return {
        "wake_up_consistency_score": wake_consistency_score,
        "challenge_completion_score": challenge_score,
        "snooze_reduction_score": snooze_score,
        "sleep_adherence_score": sleep_adherence_score,
        "total_habit_score": total_score,
        "habit_adherence_rating": round((wake_consistency_score / 35.0) * 100, 1),
        "productivity_score": round(success_ratio * 60 + (1.0 - snooze_ratio) * 40, 1),
        "sleep_routine_score": round(adherence_factor * 100, 1)
    }

def analyze_behavior_and_anomalies(logs: list, preferred_sleep_hours: float = 8.0) -> dict:
    if not logs:
        return {
            "snooze_pattern_analysis": "0.0% Snooze Rate (Healthy Baseline)",
            "snooze_rate_percent": 0.0,
            "wake_up_behavior_tracking": "Consistent first-alarm wakefulness",
            "wake_up_accuracy_percent": 100.0,
            "avg_response_time_sec": 10.4,
            "productivity_correlation_analysis": 0.91,
            "habit_consistency_monitoring": "Steady morning routine",
            "sleep_pattern_analytics": f"Target {preferred_sleep_hours}h sleep schedule active",
            "anomaly_detected": False,
            "behavioral_status": "Consistent Morning Routine",
            "sessions_count": 0,
            "preferred_sleep_hours": preferred_sleep_hours,
            "last_snoozed": False,
            "last_difficulty": "Easy",
            "last_challenge_type": "Math Problems",
            "last_time_sec": 10.4
        }

    df = pd.DataFrame(logs)
    snooze_rate = round(float(df["snoozed"].mean()) * 100, 1)
    accuracy = round(float(df["is_successful"].mean()) * 100, 1)
    avg_time = round(float(df["completion_time_seconds"].mean()), 1)

    anomaly_detected = False
    if len(df) >= 4:
        features = df[["completion_time_seconds"]].copy()
        features["snooze_num"] = df["snoozed"].astype(int)
        clf = IsolationForest(contamination=0.2, random_state=42)
        preds = clf.fit_predict(features)
        anomaly_detected = bool(preds[-1] == -1)

    productivity_corr = round(min(0.98, max(0.45, (accuracy / 100.0) * 0.75 + (1 - snooze_rate / 100.0) * 0.25)), 2)
    last_entry = logs[-1]

    return {
        "snooze_pattern_analysis": f"Snooze frequency {snooze_rate}% ({'Frequent snoozing' if snooze_rate > 25 else 'Low snooze frequency'})",
        "snooze_rate_percent": snooze_rate,
        "wake_up_behavior_tracking": f"{accuracy}% puzzle accuracy | {avg_time}s average speed",
        "wake_up_accuracy_percent": accuracy,
        "avg_response_time_sec": avg_time,
        "productivity_correlation_analysis": productivity_corr,
        "habit_consistency_monitoring": f"{len(df)} wake-up sessions completed",
        "sleep_pattern_analytics": f"{preferred_sleep_hours}h target sleep | Routine efficiency {min(100, int((preferred_sleep_hours/8.0)*100))}%",
        "anomaly_detected": anomaly_detected,
        "behavioral_status": "Irregular Snooze Pattern" if anomaly_detected else "Consistent Morning Routine",
        "sessions_count": len(df),
        "preferred_sleep_hours": preferred_sleep_hours,
        "last_snoozed": bool(last_entry.get("snoozed", False)),
        "last_difficulty": str(last_entry.get("difficulty", "Easy")),
        "last_challenge_type": str(last_entry.get("challenge_type", "Math Problems")),
        "last_time_sec": float(last_entry.get("completion_time_seconds", avg_time))
    }

# ==============================================================================
# PER-USER & PER-ALARM DYNAMIC AI RECOMMENDATION ENGINE
# Reacts immediately to every alarm created/toggled/edited and every puzzle attempt!
# ==============================================================================
def generate_personalized_recommendations(
    score_breakdown: dict,
    behavior: dict,
    preferred_challenge: str,
    alarms: list = None,
    user_name: str = "User",
    wake_goal: str = "06:30"
) -> dict:
    alarms = alarms or []
    active_alarms = [a for a in alarms if a.get("is_active", True)]
    total_alarms = len(alarms)
    active_count = len(active_alarms)

    total = score_breakdown.get("total_habit_score", 88.0)
    snooze_rate = behavior.get("snooze_rate_percent", 0.0)
    accuracy = behavior.get("wake_up_accuracy_percent", 100.0)
    avg_time = behavior.get("avg_response_time_sec", 10.4)
    sessions = behavior.get("sessions_count", 0)
    sleep_hrs = behavior.get("preferred_sleep_hours", 8.0)
    last_snoozed = behavior.get("last_snoozed", False)
    last_diff = behavior.get("last_difficulty", "Easy")
    last_type = behavior.get("last_challenge_type", preferred_challenge)
    last_time = behavior.get("last_time_sec", avg_time)

    # Identify the user's primary active alarm details
    if active_alarms:
        sorted_alarms = sorted(active_alarms, key=lambda x: x.get("time", "06:30"))
        next_alarm = sorted_alarms[0]
        next_time = next_alarm.get("time", wake_goal)
        next_label = next_alarm.get("custom_label", "Morning Wake-Up")
        next_puzzle = next_alarm.get("challenge_type", preferred_challenge)
        next_diff = next_alarm.get("difficulty", "Easy")
        next_verif = next_alarm.get("verification_method", "Puzzle Completion")
    else:
        next_time = wake_goal
        next_label = "No Active Alarm"
        next_puzzle = preferred_challenge
        next_diff = last_diff
        next_verif = "Puzzle Completion"

    # Calculate recommended bedtime from next_time and sleep_hrs
    try:
        hh, mm = map(int, next_time.split(":"))
        wake_mins = hh * 60 + mm
        bed_mins = (wake_mins - int(sleep_hrs * 60)) % (24 * 60)
        ideal_bedtime = f"{bed_mins // 60:02d}:{bed_mins % 60:02d}"
    except Exception:
        ideal_bedtime = "22:30"

    # Silent Backend ML Alertness Prediction
    X_train = np.array([
        [8.0, 0.0, 95.0], [7.5, 10.0, 88.0], [6.0, 35.0, 65.0],
        [6.5, 25.0, 72.0], [8.5, 5.0, 92.0], [7.0, 15.0, 80.0]
    ])
    y_train = np.array([96.5, 89.2, 61.5, 74.0, 94.8, 83.5])
    if XGBOOST_AVAILABLE:
        xgb_model = XGBRegressor(n_estimators=20, max_depth=3, learning_rate=0.1, verbosity=0)
    else:
        xgb_model = GradientBoostingRegressor(n_estimators=20, max_depth=3, random_state=42)
    xgb_model.fit(X_train, y_train)
    pred_alertness = round(float(np.clip(xgb_model.predict(np.array([[sleep_hrs, snooze_rate, accuracy]]))[0], 52.0, 99.4)), 1)

    # 1. Sleep Schedule Insight (Impacted by user's next alarm time & sleep target)
    if active_count == 0:
        sleep_rec = f"Hi {user_name}, you currently have 0 active alarms enabled. Turn on at least one alarm for {wake_goal} and aim for bedtime by {ideal_bedtime}."
    elif sleep_hrs < 7.0:
        sleep_rec = f"For your '{next_label}' alarm at {next_time}, a {sleep_hrs}h sleep target leaves a recovery gap. Go to bed 45 mins earlier than {ideal_bedtime} tonight."
    elif last_snoozed:
        sleep_rec = f"Because your last alarm was snoozed, shift your bedtime to {ideal_bedtime} tonight so you complete a full {sleep_hrs}h sleep cycle before your {next_time} alarm."
    else:
        sleep_rec = f"To wake up refreshed for '{next_label}' at {next_time}, lock in your bedtime at {ideal_bedtime} tonight ({sleep_hrs}h target across {active_count} active alarm(s))."

    # 2. Wake-Up Strategy (Impacted by alarm verification mode, difficulty, and snooze history)
    if active_count == 0:
        wakeup_rec = f"You have {total_alarms} saved alarm(s), but none are switched ON. Enable an alarm in 'Smart Alarms' to keep your wake-up consistency score high."
    elif last_snoozed:
        wakeup_rec = f"Your last '{last_type}' alarm was snoozed. Upgrade your {next_time} alarm from '{next_verif}' to 'Consecutive Correct Answers' at {next_diff} stage."
    elif snooze_rate > 20:
        wakeup_rec = f"Your snooze rate is {snooze_rate}% across {sessions} attempts. For your {next_time} '{next_label}' alarm, use 'Multi-Step Challenges' to prevent snoozing."
    else:
        wakeup_rec = f"Your {next_time} alarm ('{next_label}') is set to {next_diff} '{next_puzzle}' ({next_verif}). With {accuracy}% accuracy, you are ready to test the next difficulty stage!"

    # 3. Morning Habit Routine (Impacted by session streak, last solve speed, and active alarms)
    if sessions == 0:
        habit_rec = f"Welcome {user_name}! Trigger your {next_time} '{next_puzzle}' alarm once to record your baseline cognitive speed and start your morning habit streak."
    elif behavior.get("anomaly_detected") or last_time > 18.0:
        habit_rec = f"Your last '{last_type}' puzzle took {last_time}s. Right after dismissing your {next_time} alarm tomorrow, drink 300ml water and get 5 minutes of sunlight."
    else:
        habit_rec = f"Great momentum across {sessions} puzzle sessions (Habit Score: {total}/100)! Chain a 10-minute morning planning session right after your {next_time} alarm."

    # 4. Peak Focus Window (Impacted by reaction speed & wake-up time)
    try:
        hh, mm = map(int, next_time.split(":"))
        focus_start = f"{(hh + 1) % 24:02d}:{mm:02d}"
        focus_end = f"{(hh + 3) % 24:02d}:{mm:02d}"
    except Exception:
        focus_start, focus_end = "07:30", "09:30"

    if last_time <= 9.0 and not last_snoozed and sessions > 0:
        prod_rec = f"Fast {last_time}s solve on '{last_type}'! Your peak analytical window tomorrow is {focus_start}–{focus_end} (1 hour after your {next_time} alarm)."
    else:
        prod_rec = f"Based on your {avg_time}s average solve speed and {next_time} wake-up schedule, reserve {focus_start}–{focus_end} for your highest-priority study or coding tasks."

    # 5. Recommended Next Puzzle (Impacted by current alarm's challenge_type)
    complementary_map = {
        "Math Problems": ("Memory Challenges", "Pattern Recognition", "numerical speed and working memory"),
        "Logic Puzzles": ("Quick Quizzes", "Math Problems", "deductive reasoning and rapid calculation"),
        "Memory Challenges": ("Pattern Recognition", "Word Games", "visual recall and verbal fluency"),
        "Word Games": ("Riddles", "Logic Puzzles", "vocabulary retrieval and lateral thinking"),
        "Pattern Recognition": ("Math Problems", "Memory Challenges", "sequence detection and mental math"),
        "Riddles": ("Word Games", "Logic Puzzles", "creative association and analytical focus"),
        "Quick Quizzes": ("Memory Challenges", "Math Problems", "fact recall and quantitative speed")
    }
    pair1, pair2, brain_benefit = complementary_map.get(
        next_puzzle, ("Memory Challenges", "Pattern Recognition", "complete morning brain activation")
    )
    user_vec = np.array([[accuracy / 100.0, max(0.1, 1.0 - avg_time / 40.0), 1.0 - snooze_rate / 100.0]])
    ref_vec = np.array([[0.92, 0.84, 0.95]])
    sim_pct = round(float(cosine_similarity(user_vec, ref_vec)[0][0]) * 100, 1)

    challenge_rec = (
        f"Your {next_time} alarm uses '{next_puzzle}' ({next_diff}). Try pairing it with '{pair1}' or '{pair2}' to boost {brain_benefit}."
    )

    return {
        "sleep_improvement_recommendations": sleep_rec,
        "wakeup_optimization_suggestions": wakeup_rec,
        "habit_improvement_guidance": habit_rec,
        "productivity_recommendations": prod_rec,
        "personalized_challenge_recommendations": challenge_rec,
        "ai_telemetry_cards": [
            {
                "id": "xgb_sleep",
                "title": "Sleep & Bedtime Window",
                "model": "Sleep Coach",
                "confidence": f"Alertness: {pred_alertness}%",
                "trigger": f"Next Alarm: {next_time} | Bedtime: {ideal_bedtime}",
                "badge_color": "#4F46E5",
                "text": sleep_rec
            },
            {
                "id": "rl_wakeup",
                "title": "Alarm & Wake-Up Strategy",
                "model": "Anti-Snooze Advisor",
                "confidence": f"Active Alarms: {active_count}/{total_alarms}",
                "trigger": f"Alarm: {next_label} ({next_diff}) | Snooze: {snooze_rate}%",
                "badge_color": "#06B6D4",
                "text": wakeup_rec
            },
            {
                "id": "if_habit",
                "title": "Morning Habit Routine",
                "model": "Habit Tracker",
                "confidence": f"Sessions: {sessions}",
                "trigger": f"Last Puzzle: {last_type} ({last_time}s)",
                "badge_color": "#9333EA",
                "text": habit_rec
            },
            {
                "id": "rf_prod",
                "title": "Peak Focus Window",
                "model": "Productivity Guide",
                "confidence": f"Avg Speed: {avg_time}s",
                "trigger": f"Peak Hours: {focus_start} – {focus_end}",
                "badge_color": "#F59E0B",
                "text": prod_rec
            },
            {
                "id": "vec_puzzle",
                "title": "Next Puzzle Pairing",
                "model": "Brain Training",
                "confidence": f"{sim_pct}% Match",
                "trigger": f"Current Alarm Puzzle: {next_puzzle}",
                "badge_color": "#EC4899",
                "text": challenge_rec
            }
        ]
    }