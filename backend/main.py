from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from ml_difficulty import predict_difficulty
from jose import jwt
from datetime import datetime, timedelta
import hashlib
import os
from dotenv import load_dotenv
load_dotenv()


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="Intelligent Cognitive Alarm Platform",
    version="0.6.1"
)


# =========================================================
# CORS
# =========================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:80",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:5178",
        "http://127.0.0.1",
        "http://127.0.0.1:80",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://127.0.0.1:5177",
        "http://127.0.0.1:5178",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# =========================================================
# MONGODB
# =========================================================


MONGODB_URL = os.getenv(
    "MONGODB_URL",
    "mongodb://127.0.0.1:27017/"
)

client = MongoClient(MONGODB_URL)

db = client["cognitive_alarm"]

users = db["users"]
alarms = db["alarms"]
habits = db["habits"]
challenges = db["challenges"]
challenge_history = db["challenge_history"]
wakeup_history = db["wakeup_history"]
sleep_history = db["sleep_history"]


# =========================================================
# JWT SETTINGS
# =========================================================

SECRET_KEY = "cognitive_alarm_secret_key"
ALGORITHM = "HS256"


# =========================================================
# DIFFICULTY LEVELS
# =========================================================

DIFFICULTY_LEVELS = [
    "Beginner",
    "Easy",
    "Medium",
    "Hard",
    "Expert"
]


# =========================================================
# HELPER
# =========================================================

def calculate_percentage(value, total):

    if total == 0:
        return 0

    return round(
        (value / total) * 100,
        2
    )


# =========================================================
# SLEEP HELPERS
# =========================================================

def time_to_minutes(time_string):

    try:

        hour, minute = map(
            int,
            time_string.split(":")
        )

        return hour * 60 + minute

    except Exception:

        return None


def calculate_sleep_hours(
    sleep_time,
    wake_up_time
):

    sleep_minutes = time_to_minutes(
        sleep_time
    )

    wake_minutes = time_to_minutes(
        wake_up_time
    )

    if (
        sleep_minutes is None
        or wake_minutes is None
    ):
        return None

    if wake_minutes <= sleep_minutes:

        wake_minutes += 24 * 60

    duration_minutes = (
        wake_minutes - sleep_minutes
    )

    return round(
        duration_minutes / 60,
        2
    )


def parse_target_sleep_hours(
    sleep_duration
):

    if sleep_duration is None:
        return 8.0

    value = str(
        sleep_duration
    ).lower().strip()

    try:

        number = value.split()[0]

        return float(number)

    except Exception:

        return 8.0


# =========================================================
# PASSWORD HASHING
# =========================================================

def hash_password(password: str) -> str:

    salt = os.urandom(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        100000
    )

    return (
        salt.hex()
        + ":"
        + password_hash.hex()
    )


def verify_password(
    password: str,
    stored_password: str
) -> bool:

    try:

        salt_hex, hash_hex = (
            stored_password.split(":")
        )

        salt = bytes.fromhex(
            salt_hex
        )

        password_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            100000
        )

        return (
            password_hash.hex()
            == hash_hex
        )

    except Exception:

        return False


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():

    return {
        "message":
            "Intelligent Cognitive Alarm Platform API is running",

        "version":
            "0.6.1",

        "status":
            "active"
    }


# =========================================================
# REGISTER
# =========================================================

@app.post("/register")
def register(data: dict):

    if "name" not in data:

        raise HTTPException(
            status_code=400,
            detail="Name is required"
        )

    if "email" not in data:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    if "password" not in data:

        raise HTTPException(
            status_code=400,
            detail="Password is required"
        )

    name = str(
        data["name"]
    ).strip()

    email = str(
        data["email"]
    ).strip().lower()

    password = str(
        data["password"]
    )

    if not name:

        raise HTTPException(
            status_code=400,
            detail="Name cannot be empty"
        )

    if not email:

        raise HTTPException(
            status_code=400,
            detail="Email cannot be empty"
        )

    if len(password) < 6:

        raise HTTPException(
            status_code=400,
            detail=(
                "Password must contain "
                "at least 6 characters"
            )
        )

    existing_user = users.find_one({
        "email": email
    })

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="User already exists"
        )

    hashed_password = hash_password(
        password
    )

    user = {

        "name": name,

        "email": email,

        "password": hashed_password,

        "role": "User",

        "created_at":
            datetime.utcnow()
    }

    users.insert_one(user)

    return {

        "message":
            "Registration successful",

        "email":
            email,

        "role":
            "User"
    }


# =========================================================
# LOGIN
# =========================================================

@app.post("/login")
def login(data: dict):

    if "email" not in data:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    if "password" not in data:

        raise HTTPException(
            status_code=400,
            detail="Password is required"
        )

    email = str(
        data["email"]
    ).strip().lower()

    password = str(
        data["password"]
    )

    user = users.find_one({
        "email": email
    })

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    stored_password = str(
        user.get(
            "password",
            ""
        )
    )

    password_valid = verify_password(
        password,
        stored_password
    )

    if not password_valid:

        password_valid = (
            password
            ==
            stored_password
        )

    if not password_valid:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token_data = {

        "email": email,

        "role":
            user.get(
                "role",
                "User"
            ),

        "exp":
            datetime.utcnow()
            +
            timedelta(hours=1)
    }

    token = jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {

        "message":
            "Login successful",

        "access_token":
            token,

        "token_type":
            "bearer",

        "role":
            user.get(
                "role",
                "User"
            ),

        "email":
            email,

        "name":
            user.get(
                "name",
                ""
            )
    }


# =========================================================
# PROFILE
# =========================================================

@app.get("/profile/{email}")
def get_profile(email: str):

    email = email.strip().lower()

    user = users.find_one(
        {
            "email": email
        },
        {
            "_id": 0,
            "password": 0
        }
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "profile": user
    }


# =========================================================
# CREATE ALARM
# =========================================================

@app.post("/alarms")
def create_alarm(data: dict):

    if "email" not in data:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    if "alarm_time" not in data:

        raise HTTPException(
            status_code=400,
            detail="Alarm time is required"
        )

    email = str(
        data["email"]
    ).strip().lower()

    # -----------------------------------------------------
    # IMPORTANT DIFFICULTY FIX
    # -----------------------------------------------------

    difficulty = str(
        data.get(
            "difficulty",
            "Easy"
        )
    ).strip()

    # Accept only the five actual levels

    if difficulty not in DIFFICULTY_LEVELS:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid difficulty '{difficulty}'. "
                f"Allowed values: "
                f"{', '.join(DIFFICULTY_LEVELS)}"
            )
        )

    challenge = str(
        data.get(
            "challenge",
            "Math"
        )
    ).strip()

    alarm = {

        "email":
            email,

        "alarm_time":
            data["alarm_time"],

        "alarm_type":
            data.get(
                "alarm_type",
                "Daily"
            ),

        "challenge":
            challenge,

        # IMPORTANT:
        # Store exactly what frontend selected
        "difficulty":
            difficulty,

        "active":
            True,

        "snoozed":
            False,

        "created_at":
            datetime.utcnow()
    }

    result = alarms.insert_one(
        alarm
    )

    return {

        "message":
            "Alarm created successfully",

        "alarm_id":
            str(
                result.inserted_id
            ),

        "alarm_time":
            alarm["alarm_time"],

        "alarm_type":
            alarm["alarm_type"],

        "challenge":
            alarm["challenge"],

        "difficulty":
            alarm["difficulty"],

        "active":
            True
    }


# =========================================================
# GET ALARMS
# =========================================================

@app.get("/alarms/{email}")
def get_alarms(email: str):

    email = email.strip().lower()

    alarm_list = list(
        alarms.find(
            {
                "email":
                    email
            },
            {
                "_id": 0
            }
        )
    )

    return {

        "email":
            email,

        "alarms":
            alarm_list
    }


# =========================================================
# CREATE HABIT
# =========================================================

@app.post("/habits")
def create_habit(data: dict):

    if "email" not in data:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    email = str(
        data["email"]
    ).strip().lower()

    habit = {

        "email":
            email,

        "wake_up_time":
            data.get(
                "wake_up_time",
                "07:00"
            ),

        "sleep_time":
            data.get(
                "sleep_time",
                "23:00"
            ),

        "sleep_duration":
            data.get(
                "sleep_duration",
                "8 hours"
            ),

        "time_zone":
            data.get(
                "time_zone",
                "Asia/Kolkata"
            ),

        "productivity_goal":
            data.get(
                "productivity_goal",
                "Study"
            ),

        "difficulty_preference":
            data.get(
                "difficulty_preference",
                "Easy"
            ),

        "habit_preference":
            data.get(
                "habit_preference",
                "Daily"
            ),

        "created_at":
            datetime.utcnow()
    }

    habits.update_one(
        {
            "email":
                email
        },
        {
            "$set":
                habit
        },
        upsert=True
    )

    return {

        "message":
            "Habit saved successfully",

        "wake_up_time":
            habit["wake_up_time"],

        "sleep_time":
            habit["sleep_time"],

        "sleep_duration":
            habit["sleep_duration"],

        "productivity_goal":
            habit["productivity_goal"],

        "difficulty_preference":
            habit["difficulty_preference"]
    }


# =========================================================
# GET HABIT
# =========================================================

@app.get("/habits/{email}")
def get_habit(email: str):

    email = email.strip().lower()

    habit = habits.find_one(
        {
            "email":
                email
        },
        {
            "_id": 0
        }
    )

    if not habit:

        raise HTTPException(
            status_code=404,
            detail="Habit not found"
        )

    return {
        "habit":
            habit
    }


# =========================================================
# SAVE SLEEP RECORD
# =========================================================

@app.post("/sleep/record")
def save_sleep_record(data: dict):

    if "email" not in data:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    if "sleep_time" not in data:

        raise HTTPException(
            status_code=400,
            detail="Sleep time is required"
        )

    if "wake_up_time" not in data:

        raise HTTPException(
            status_code=400,
            detail="Wake-up time is required"
        )

    email = str(
        data["email"]
    ).strip().lower()

    sleep_time = str(
        data["sleep_time"]
    ).strip()

    wake_up_time = str(
        data["wake_up_time"]
    ).strip()

    actual_sleep_hours = (
        calculate_sleep_hours(
            sleep_time,
            wake_up_time
        )
    )

    if actual_sleep_hours is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid time format. "
                "Use HH:MM, for example 23:00"
            )
        )

    habit = habits.find_one({
        "email":
            email
    })

    if habit:

        target_sleep_hours = (
            parse_target_sleep_hours(
                habit.get(
                    "sleep_duration",
                    "8 hours"
                )
            )
        )

    else:

        target_sleep_hours = float(
            data.get(
                "target_sleep_hours",
                8
            )
        )

    sleep_adherence = (
        actual_sleep_hours
        /
        target_sleep_hours
    ) * 100

    sleep_adherence = min(
        round(
            sleep_adherence,
            2
        ),
        100
    )

    sleep_record = {

        "email":
            email,

        "sleep_time":
            sleep_time,

        "wake_up_time":
            wake_up_time,

        "actual_sleep_hours":
            actual_sleep_hours,

        "target_sleep_hours":
            target_sleep_hours,

        "sleep_adherence":
            sleep_adherence,

        "recorded_at":
            datetime.utcnow()
    }

    result = sleep_history.insert_one(
        sleep_record
    )

    return {

        "message":
            "Sleep record saved successfully",

        "sleep_id":
            str(
                result.inserted_id
            ),

        "email":
            email,

        "sleep_time":
            sleep_time,

        "wake_up_time":
            wake_up_time,

        "actual_sleep_hours":
            actual_sleep_hours,

        "target_sleep_hours":
            target_sleep_hours,

        "sleep_adherence":
            sleep_adherence
    }


# =========================================================
# GET SLEEP HISTORY
# =========================================================

@app.get("/sleep/history/{email}")
def get_sleep_history(email: str):

    email = email.strip().lower()

    records = list(
        sleep_history.find(
            {
                "email":
                    email
            },
            {
                "_id": 0
            }
        )
        .sort(
            "recorded_at",
            -1
        )
        .limit(30)
    )

    return {

        "email":
            email,

        "history":
            records,

        "total_records":
            len(records)
    }


# =========================================================
# SLEEP ANALYTICS
# =========================================================

@app.get("/sleep/analytics/{email}")
def get_sleep_analytics(email: str):

    email = email.strip().lower()

    records = list(
        sleep_history.find({
            "email":
                email
        })
        .sort(
            "recorded_at",
            -1
        )
        .limit(30)
    )

    if not records:

        habit = habits.find_one({
            "email":
                email
        })

        if habit:

            target_sleep_hours = (
                parse_target_sleep_hours(
                    habit.get(
                        "sleep_duration",
                        "8 hours"
                    )
                )
            )

            return {

                "email":
                    email,

                "records_analyzed":
                    0,

                "average_sleep_hours":
                    0,

                "target_sleep_hours":
                    target_sleep_hours,

                "sleep_adherence":
                    0,

                "sleep_status":
                    "No sleep records available",

                "message":
                    (
                        "Record your sleep and "
                        "wake-up time to calculate "
                        "sleep behavior."
                    )
            }

        return {

            "email":
                email,

            "records_analyzed":
                0,

            "average_sleep_hours":
                0,

            "target_sleep_hours":
                8,

            "sleep_adherence":
                0,

            "sleep_status":
                "No sleep data",

            "message":
                (
                    "Set your sleep schedule and "
                    "record sleep sessions."
                )
        }

    valid_records = [

        record

        for record in records

        if record.get(
            "actual_sleep_hours"
        ) is not None
    ]

    if valid_records:

        average_sleep_hours = round(

            sum(

                float(
                    record.get(
                        "actual_sleep_hours",
                        0
                    )
                )

                for record in valid_records

            )
            /
            len(valid_records),

            2
        )

    else:

        average_sleep_hours = 0

    target_values = [

        float(
            record.get(
                "target_sleep_hours",
                8
            )
        )

        for record in valid_records
    ]

    if target_values:

        target_sleep_hours = round(

            sum(
                target_values
            )
            /
            len(target_values),

            2
        )

    else:

        target_sleep_hours = 8

    adherence_values = [

        float(
            record.get(
                "sleep_adherence",
                0
            )
        )

        for record in valid_records
    ]

    if adherence_values:

        sleep_adherence = round(

            sum(
                adherence_values
            )
            /
            len(adherence_values),

            2
        )

    else:

        sleep_adherence = 0

    if sleep_adherence >= 90:

        sleep_status = (
            "Good sleep schedule adherence"
        )

    elif sleep_adherence >= 75:

        sleep_status = (
            "Moderate sleep schedule adherence"
        )

    else:

        sleep_status = (
            "Sleep schedule needs improvement"
        )

    return {

        "email":
            email,

        "records_analyzed":
            len(valid_records),

        "average_sleep_hours":
            average_sleep_hours,

        "target_sleep_hours":
            target_sleep_hours,

        "sleep_adherence":
            sleep_adherence,

        "sleep_status":
            sleep_status,

        "message":
            (
                "Sleep behavior calculated "
                "from recorded sleep sessions."
            )
    }


# =========================================================
# CREATE COGNITIVE CHALLENGE
# =========================================================

@app.post("/challenges")
def create_challenge(data: dict):

    if "email" not in data:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    email = str(
        data["email"]
    ).strip().lower()

    difficulty = str(
        data.get(
            "difficulty",
            "Easy"
        )
    ).strip()

    if difficulty not in DIFFICULTY_LEVELS:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid difficulty '{difficulty}'. "
                f"Allowed values: "
                f"{', '.join(DIFFICULTY_LEVELS)}"
            )
        )

    challenge = {

        "email":
            email,

        "type":
            data.get(
                "type",
                "Math"
            ),

        "difficulty":
            difficulty,

        "question":
            data.get(
                "question",
                "What is 5 + 3?"
            ),

        "correct_answer":
            str(
                data.get(
                    "correct_answer",
                    "8"
                )
            ),

        "completed":
            False,

        "created_at":
            datetime.utcnow()
    }

    result = challenges.insert_one(
        challenge
    )

    return {

        "message":
            "Challenge created successfully",

        "challenge_id":
            str(
                result.inserted_id
            ),

        "type":
            challenge["type"],

        "difficulty":
            challenge["difficulty"],

        "question":
            challenge["question"],

        "correct_answer":
            challenge["correct_answer"]
    }


# =========================================================
# EVALUATE COGNITIVE CHALLENGE
# =========================================================

@app.post("/challenges/evaluate")
def evaluate_challenge(data: dict):

    if "email" not in data:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    if "answer" not in data:

        raise HTTPException(
            status_code=400,
            detail="Answer is required"
        )

    if "correct_answer" not in data:

        raise HTTPException(
            status_code=400,
            detail="Correct answer is required"
        )

    email = str(
        data["email"]
    ).strip().lower()

    user_answer = str(
        data["answer"]
    ).strip()

    correct_answer = str(
        data["correct_answer"]
    ).strip()

    difficulty = str(
        data.get(
            "difficulty",
            "Easy"
        )
    ).strip()

    if difficulty not in DIFFICULTY_LEVELS:

        difficulty = "Easy"

    is_correct = (
        user_answer.lower()
        ==
        correct_answer.lower()
    )

    history = {

        "email":
            email,

        "challenge_type":
            data.get(
                "challenge_type",
                "Math"
            ),

        "difficulty":
            difficulty,

        "question":
            data.get(
                "question",
                ""
            ),

        "answer":
            user_answer,

        "correct":
            is_correct,

        "status":
            (
                "Completed"
                if is_correct
                else "Incorrect"
            ),

        "completion_time_seconds":
            float(
                data.get(
                    "completion_time_seconds",
                    0
                )
            ),

        "completed_at":
            datetime.utcnow()
    }

    challenge_history.insert_one(
        history
    )

    if is_correct:

        return {

            "message":
                "Correct answer",

            "correct":
                True,

            "status":
                "Challenge completed",

            "email":
                email,

            "difficulty":
                difficulty,

            "correct_answer":
                correct_answer
        }

    return {

        "message":
            "Incorrect answer",

        "correct":
            False,

        "status":
            "Try again",

        "email":
            email,

        "difficulty":
            difficulty,

        "correct_answer":
            correct_answer
    }


# =========================================================
# WAKE-UP VERIFICATION
# =========================================================

@app.post("/wake-up/verify")
def verify_wakeup(data: dict):

    if "email" not in data:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    if "challenge_completed" not in data:

        raise HTTPException(
            status_code=400,
            detail=(
                "Challenge completion status "
                "is required"
            )
        )

    email = str(
        data["email"]
    ).strip().lower()

    completed = (
        data["challenge_completed"]
        is True
    )

    if completed:

        return {

            "verified":
                True,

            "email":
                email,

            "message":
                "Wake-up verified successfully",

            "status":
                "AWAKE"
        }

    return {

        "verified":
            False,

        "email":
            email,

        "message":
            "Wake-up verification failed",

        "status":
            "CHALLENGE_REQUIRED"
    }


# =========================================================
# SAVE CHALLENGE HISTORY
# =========================================================

@app.post("/challenges/history")
def save_challenge_history(data: dict):

    if "email" not in data:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    email = str(
        data["email"]
    ).strip().lower()

    difficulty = str(
        data.get(
            "difficulty",
            "Easy"
        )
    ).strip()

    if difficulty not in DIFFICULTY_LEVELS:

        difficulty = "Easy"

    history = {

        "email":
            email,

        "challenge_type":
            data.get(
                "challenge_type",
                "Math"
            ),

        "difficulty":
            difficulty,

        "question":
            data.get(
                "question",
                ""
            ),

        "answer":
            data.get(
                "answer",
                ""
            ),

        "correct":
            bool(
                data.get(
                    "correct",
                    False
                )
            ),

        "status":
            data.get(
                "status",
                "Completed"
            ),

        "completion_time_seconds":
            float(
                data.get(
                    "completion_time_seconds",
                    0
                )
            ),

        "completed_at":
            datetime.utcnow()
    }

    challenge_history.insert_one(
        history
    )

    return {

        "message":
            "Challenge history saved successfully"
    }


# =========================================================
# GET CHALLENGE HISTORY
# =========================================================

@app.get("/challenges/history/{email}")
def get_challenge_history(email: str):

    email = email.strip().lower()

    history = list(
        challenge_history.find(
            {
                "email":
                    email
            },
            {
                "_id": 0
            }
        )
    )

    return {

        "email":
            email,

        "history":
            history
    }


# =========================================================
# SAVE WAKE-UP HISTORY
# =========================================================

@app.post("/wake-up/history")
def save_wakeup_history(data: dict):

    if "email" not in data:

        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    email = str(
        data["email"]
    ).strip().lower()

    wakeup = {

        "email":
            email,

        "wake_up_time":
            data.get(
                "wake_up_time",
                ""
            ),

        "scheduled_time":
            data.get(
                "scheduled_time",
                ""
            ),

        "verified":
            bool(
                data.get(
                    "verified",
                    False
                )
            ),

        "snoozed":
            bool(
                data.get(
                    "snoozed",
                    False
                )
            ),

        "snooze_count":
            int(
                data.get(
                    "snooze_count",
                    0
                )
            ),

        "verification_time_seconds":
            float(
                data.get(
                    "verification_time_seconds",
                    0
                )
            ),

        "created_at":
            datetime.utcnow()
    }

    wakeup_history.insert_one(
        wakeup
    )

    return {

        "message":
            "Wake-up history saved successfully"
    }


# =========================================================
# GET WAKE-UP HISTORY
# =========================================================

@app.get("/wake-up/history/{email}")
def get_wakeup_history(email: str):

    email = email.strip().lower()

    history = list(
        wakeup_history.find(
            {
                "email":
                    email
            },
            {
                "_id": 0
            }
        )
    )

    return {

        "email":
            email,

        "history":
            history
    }


# =========================================================
# BEHAVIORAL ANALYTICS
# =========================================================

@app.get("/behavioral-analytics/{email}")
def behavioral_analytics(email: str):

    email = email.strip().lower()

    user = users.find_one({
        "email":
            email
    })

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    challenge_list = list(
        challenge_history.find({
            "email":
                email
        })
    )

    total_challenges = len(
        challenge_list
    )

    correct_challenges = sum(

        1

        for c in challenge_list

        if c.get(
            "correct"
        ) is True
    )

    incorrect_challenges = (
        total_challenges
        -
        correct_challenges
    )

    challenge_accuracy = calculate_percentage(
        correct_challenges,
        total_challenges
    )

    wakeup_list = list(
        wakeup_history.find({
            "email":
                email
        })
    )

    total_wakeups = len(
        wakeup_list
    )

    verified_wakeups = sum(

        1

        for w in wakeup_list

        if w.get(
            "verified"
        ) is True
    )

    snoozed_wakeups = sum(

        1

        for w in wakeup_list

        if w.get(
            "snoozed"
        ) is True
    )

    wake_up_consistency = calculate_percentage(
        verified_wakeups,
        total_wakeups
    )

    if total_wakeups > 0:

        snooze_reduction = round(

            (
                1
                -
                (
                    snoozed_wakeups
                    /
                    total_wakeups
                )
            )
            * 100,

            2
        )

    else:

        snooze_reduction = 0

    sleep_data = get_sleep_analytics(
        email
    )

    sleep_schedule_adherence = (
        sleep_data.get(
            "sleep_adherence",
            0
        )
    )

    if total_challenges > 0:

        challenge_completion = 100

    else:

        challenge_completion = 0

    return {

        "email":
            email,

        "total_challenges":
            total_challenges,

        "correct_challenges":
            correct_challenges,

        "incorrect_challenges":
            incorrect_challenges,

        "challenge_accuracy":
            challenge_accuracy,

        "total_wakeups":
            total_wakeups,

        "verified_wakeups":
            verified_wakeups,

        "snoozed_wakeups":
            snoozed_wakeups,

        "wake_up_consistency":
            wake_up_consistency,

        "challenge_completion":
            challenge_completion,

        "snooze_reduction":
            snooze_reduction,

        "sleep_schedule_adherence":
            sleep_schedule_adherence,

        "average_sleep_hours":
            sleep_data.get(
                "average_sleep_hours",
                0
            ),

        "target_sleep_hours":
            sleep_data.get(
                "target_sleep_hours",
                8
            ),

        "sleep_status":
            sleep_data.get(
                "sleep_status",
                "No sleep data"
            )
    }


# =========================================================
# ML ADAPTIVE DIFFICULTY
# =========================================================

@app.get("/adaptive-difficulty/{email}")
def adaptive_difficulty(email: str):

    email = email.strip().lower()

    history = list(

        challenge_history.find({
            "email":
                email
        })
        .sort(
            "completed_at",
            -1
        )
        .limit(10)
    )

    if not history:

        return {

            "email":
                email,

            "previous_difficulty":
                "Beginner",

            "next_difficulty":
                "Beginner",

            "accuracy":
                0,

            "completion_rate":
                0,

            "snooze_count":
                0,

            "wake_consistency":
                0,

            "model":
                "Decision Tree Classifier",

            "confidence":
                0,

            "attempts_analyzed":
                0,

            "reason":
                (
                    "No behavioral history available. "
                    "Starting at Beginner level."
                )
        }

    total_challenges = len(
        history
    )

    correct_challenges = sum(

        1

        for item in history

        if item.get(
            "correct"
        ) is True
    )

    accuracy = calculate_percentage(
        correct_challenges,
        total_challenges
    )

    completed_challenges = sum(

        1

        for item in history

        if str(
            item.get(
                "status",
                ""
            )
        ).lower()
        ==
        "completed"
    )

    completion_rate = calculate_percentage(
        completed_challenges,
        total_challenges
    )

    wake_records = list(
        wakeup_history.find({
            "email":
                email
        })
    )

    total_wakeups = len(
        wake_records
    )

    successful_wakeups = sum(

        1

        for record in wake_records

        if (
            record.get(
                "verified"
            ) is True

            or

            record.get(
                "wake_up_verified"
            ) is True

            or

            record.get(
                "challenge_completed"
            ) is True
        )
    )

    wake_consistency = calculate_percentage(
        successful_wakeups,
        total_wakeups
    )

    total_snoozes = sum(

        int(
            record.get(
                "snooze_count",
                0
            )
        )

        for record in wake_records
    )

    previous_difficulty = history[0].get(
        "difficulty",
        "Easy"
    )

    if previous_difficulty not in DIFFICULTY_LEVELS:

        previous_difficulty = "Easy"

    ml_result = predict_difficulty(

        accuracy=accuracy,

        completion_rate=completion_rate,

        snooze_count=total_snoozes,

        wake_consistency=wake_consistency,

        previous_difficulty=previous_difficulty
    )

    predicted_difficulty = str(
        ml_result["difficulty"]
    )

    if predicted_difficulty not in DIFFICULTY_LEVELS:

        predicted_difficulty = "Beginner"

    confidence = ml_result["confidence"]

    if predicted_difficulty == "Expert":

        reason = (
            "ML model detected consistently high "
            "performance and recommends Expert difficulty."
        )

    elif predicted_difficulty == "Hard":

        reason = (
            "ML model detected strong challenge "
            "performance and recommends Hard difficulty."
        )

    elif predicted_difficulty == "Medium":

        reason = (
            "ML model detected moderate-to-good "
            "performance and recommends Medium difficulty."
        )

    elif predicted_difficulty == "Easy":

        reason = (
            "ML model recommends Easy difficulty "
            "for a manageable challenge."
        )

    else:

        reason = (
            "ML model recommends Beginner difficulty "
            "based on the available behavioral data."
        )

    return {

        "email":
            email,

        "previous_difficulty":
            previous_difficulty,

        "next_difficulty":
            predicted_difficulty,

        "accuracy":
            accuracy,

        "completion_rate":
            completion_rate,

        "snooze_count":
            total_snoozes,

        "wake_consistency":
            wake_consistency,

        "model":
            ml_result["model"],

        "confidence":
            confidence,

        "attempts_analyzed":
            total_challenges,

        "reason":
            reason
    }


# =========================================================
# HABIT SCORE
# =========================================================

@app.get("/habit-score/{email}")
def get_habit_score(email: str):

    email = email.strip().lower()

    challenge_list = list(
        challenge_history.find({
            "email":
                email
        })
    )

    total_challenges = len(
        challenge_list
    )

    if total_challenges > 0:

        completed_challenges = sum(

            1

            for c in challenge_list

            if c.get(
                "correct"
            ) is True
        )

        challenge_completion = (

            completed_challenges
            /
            total_challenges

        ) * 100

    else:

        challenge_completion = 0

    wakeups = list(
        wakeup_history.find({
            "email":
                email
        })
    )

    total_wakeups = len(
        wakeups
    )

    if total_wakeups > 0:

        verified = sum(

            1

            for w in wakeups

            if w.get(
                "verified"
            ) is True
        )

        wake_up_consistency = (

            verified
            /
            total_wakeups

        ) * 100

    else:

        wake_up_consistency = 0

    if total_wakeups > 0:

        snoozed = sum(

            1

            for w in wakeups

            if w.get(
                "snoozed"
            ) is True
        )

        snooze_reduction = (

            1
            -
            (
                snoozed
                /
                total_wakeups
            )

        ) * 100

    else:

        snooze_reduction = 0

    sleep_data = get_sleep_analytics(
        email
    )

    sleep_schedule_adherence = (
        sleep_data.get(
            "sleep_adherence",
            0
        )
    )

    habit_score = (

        wake_up_consistency
        * 0.35

        +

        challenge_completion
        * 0.25

        +

        snooze_reduction
        * 0.20

        +

        sleep_schedule_adherence
        * 0.20
    )

    habit_score = round(
        habit_score,
        2
    )

    return {

        "email":
            email,

        "habit_score":
            habit_score,

        "components": {

            "wake_up_consistency":
                round(
                    wake_up_consistency,
                    2
                ),

            "challenge_completion":
                round(
                    challenge_completion,
                    2
                ),

            "snooze_reduction":
                round(
                    snooze_reduction,
                    2
                ),

            "sleep_schedule_adherence":
                round(
                    sleep_schedule_adherence,
                    2
                )
        },

        "sleep": {

            "average_sleep_hours":
                sleep_data.get(
                    "average_sleep_hours",
                    0
                ),

            "target_sleep_hours":
                sleep_data.get(
                    "target_sleep_hours",
                    8
                ),

            "sleep_adherence":
                sleep_schedule_adherence,

            "sleep_status":
                sleep_data.get(
                    "sleep_status",
                    "No sleep data"
                )
        },

        "weights": {

            "wake_up_consistency":
                "35%",

            "challenge_completion":
                "25%",

            "snooze_reduction":
                "20%",

            "sleep_schedule_adherence":
                "20%"
        }
    }


# =========================================================
# RECOMMENDATIONS
# =========================================================

@app.get("/recommendations/{email}")
def get_recommendations(email: str):

    email = email.strip().lower()

    recommendations = []

    ml_result = adaptive_difficulty(
        email
    )

    next_difficulty = ml_result.get(
        "next_difficulty",
        "Beginner"
    )

    confidence = ml_result.get(
        "confidence",
        0
    )

    accuracy = ml_result.get(
        "accuracy",
        0
    )

    recommendations.append(

        f"ML model recommends "
        f"{next_difficulty} difficulty challenges."
    )

    if accuracy >= 85:

        recommendations.append(

            "Your challenge performance is strong. "
            "You can try more challenging cognitive tasks."
        )

    elif accuracy >= 50:

        recommendations.append(

            "Continue practicing cognitive challenges "
            "to improve your performance."
        )

    else:

        recommendations.append(

            "Start with easier cognitive challenges "
            "and gradually improve your accuracy."
        )

    wakeup_list = list(
        wakeup_history.find({
            "email":
                email
        })
    )

    if wakeup_list:

        snoozed = sum(

            1

            for w in wakeup_list

            if w.get(
                "snoozed"
            ) is True
        )

        if snoozed > 0:

            recommendations.append(

                "Try reducing the number of snoozes "
                "before dismissing the alarm."
            )

        else:

            recommendations.append(

                "Your recorded wake-up sessions "
                "show no snooze events."
            )

    else:

        recommendations.append(

            "Complete more wake-up sessions "
            "to generate personalized recommendations."
        )

    sleep_data = get_sleep_analytics(
        email
    )

    sleep_adherence = sleep_data.get(
        "sleep_adherence",
        0
    )

    if sleep_data.get(
        "records_analyzed",
        0
    ) == 0:

        recommendations.append(

            "Record your sleep and wake-up times "
            "to generate sleep-based recommendations."
        )

    elif sleep_adherence < 75:

        recommendations.append(

            "Your recorded sleep duration is below "
            "your target. Try maintaining a more consistent "
            "sleep schedule."
        )

    elif sleep_adherence < 90:

        recommendations.append(

            "Your sleep schedule is moderately consistent. "
            "Try to stay closer to your target sleep duration."
        )

    else:

        recommendations.append(

            "Your recorded sleep schedule is close to "
            "your target. Maintain this consistency."
        )

    habit = habits.find_one({
        "email":
            email
    })

    if not habit:

        recommendations.append(

            "Set your preferred sleep and wake-up schedule."
        )

    else:

        recommendations.append(

            "Maintain a consistent sleep and wake-up schedule."
        )

    return {

        "email":
            email,

        "recommendations":
            recommendations,

        "challenge_accuracy":
            round(
                accuracy,
                2
            ),

        "recommended_difficulty":
            next_difficulty,

        "ml_confidence":
            confidence,

        "model":
            "Decision Tree Classifier",

        "sleep_adherence":
            sleep_adherence,

        "average_sleep_hours":
            sleep_data.get(
                "average_sleep_hours",
                0
            )
    }


# =========================================================
# GENERAL ANALYTICS
# =========================================================

# =========================================================
# GENERAL ANALYTICS
# =========================================================

@app.get("/analytics/{email}")
def get_analytics(email: str):

    email = email.strip().lower()

    try:

        # -------------------------------------------------
        # ALARMS
        # -------------------------------------------------

        alarms_data = list(
            alarms.find(
                {"email": email},
                {"_id": 0}
            )
        )

        total_alarms = len(alarms_data)

        active_alarms = sum(
            1
            for alarm in alarms_data
            if (
                alarm.get("active") is True
                or alarm.get("enabled") is True
                or str(
                    alarm.get("status", "")
                ).lower() == "active"
            )
        )

        # -------------------------------------------------
        # CHALLENGES
        # -------------------------------------------------

        challenge_data = list(
            challenge_history.find(
                {"email": email},
                {"_id": 0}
            )
        )

        total_challenges = len(
            challenge_data
        )

        correct_challenges = sum(
            1
            for item in challenge_data
            if (
                item.get("correct") is True
                or item.get("is_correct") is True
                or str(
                    item.get("result", "")
                ).lower() == "correct"
            )
        )

        incorrect_challenges = (
            total_challenges
            - correct_challenges
        )

        if total_challenges > 0:

            challenge_accuracy = round(
                (
                    correct_challenges
                    / total_challenges
                ) * 100,
                2
            )

        else:

            challenge_accuracy = 0

        # -------------------------------------------------
        # WAKE-UP
        # -------------------------------------------------

        wakeup_data = list(
            wakeup_history.find(
                {"email": email},
                {"_id": 0}
            )
        )

        total_wakeups = len(
            wakeup_data
        )

        successful_wakeups = sum(
            1
            for item in wakeup_data
            if (
                item.get("verified") is True
                or item.get("success") is True
                or item.get("completed") is True
            )
        )

        if total_wakeups > 0:

            wakeup_success_rate = round(
                (
                    successful_wakeups
                    / total_wakeups
                ) * 100,
                2
            )

        else:

            wakeup_success_rate = 0

        # -------------------------------------------------
        # SNOOZE
        # -------------------------------------------------

        snooze_count = sum(
            int(
                item.get(
                    "snooze_count",
                    0
                ) or 0
            )
            for item in wakeup_data
        )

        snooze_score = max(
            0,
            100 - (
                snooze_count * 10
            )
        )

        # -------------------------------------------------
        # HABIT SCORE
        # -------------------------------------------------

        habit_data = get_habit_score(
            email
        )

        habit_score = float(
            habit_data.get(
                "habit_score",
                0
            )
        )

        habit_components = habit_data.get(
            "components",
            {}
        )

        # -------------------------------------------------
        # OVERALL SCORE
        # Same formula used by Milestone 4
        # -------------------------------------------------

        overall_score = round(

            (
                wakeup_success_rate * 0.35
                +
                challenge_accuracy * 0.25
                +
                snooze_score * 0.20
                +
                habit_score * 0.20
            ),

            2
        )

        # -------------------------------------------------
        # RETURN
        # -------------------------------------------------

        return {

            "success": True,

            "email": email,

            "total_alarms":
                total_alarms,

            "active_alarms":
                active_alarms,

            "total_challenges":
                total_challenges,

            "correct":
                correct_challenges,

            "incorrect":
                incorrect_challenges,

            "accuracy":
                challenge_accuracy,

            "correct_challenges":
                correct_challenges,

            "incorrect_challenges":
                incorrect_challenges,

            "challenge_accuracy":
                challenge_accuracy,

            "total_wakeups":
                total_wakeups,

            "wake_up_success_rate":
                wakeup_success_rate,

            "snooze_count":
                snooze_count,

            "snooze_score":
                snooze_score,

            "habit_score":
                round(
                    habit_score,
                    2
                ),

            "overall_score":
                overall_score,

            "habit_components":
                habit_components,

            "summary": {

                "overall_score":
                    overall_score,

                "habit_score":
                    round(
                        habit_score,
                        2
                    ),

                "challenge_accuracy":
                    challenge_accuracy,

                "wake_up_success_rate":
                    wakeup_success_rate,

                "total_alarms":
                    total_alarms,

                "active_alarms":
                    active_alarms,

                "total_challenges":
                    total_challenges,

                "correct_challenges":
                    correct_challenges,

                "incorrect_challenges":
                    incorrect_challenges,

                "total_wakeups":
                    total_wakeups,

                "snooze_count":
                    snooze_count
            }

        }

    except Exception as e:

        return {

            "success": False,

            "error":
                str(e)
        }


# =========================================================
# DASHBOARD
# =========================================================
# =========================================================
# DASHBOARD
# =========================================================

@app.get("/dashboard/{email}")
def get_dashboard(email: str):

    email = email.strip().lower()

    user = users.find_one({
        "email":
            email
    })

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    total_challenges = (
        challenge_history.count_documents({
            "email":
                email
        })
    )

    correct_challenges = (
        challenge_history.count_documents({
            "email":
                email,

            "correct":
                True
        })
    )

    if total_challenges > 0:

        accuracy = round(

            (
                correct_challenges
                /
                total_challenges
            )
            * 100,

            2
        )

    else:

        accuracy = 0

    total_alarms = (
        alarms.count_documents({
            "email":
                email
        })
    )

    total_wakeups = (
        wakeup_history.count_documents({
            "email":
                email
        })
    )

    verified_wakeups = (
        wakeup_history.count_documents({
            "email":
                email,

            "verified":
                True
        })
    )

    if total_wakeups > 0:

        wake_up_consistency = round(

            (
                verified_wakeups
                /
                total_wakeups
            )
            * 100,

            2
        )

    else:

        wake_up_consistency = 0

    habit_score_data = get_habit_score(
        email
    )

    habit_score = habit_score_data[
        "habit_score"
    ]

    ml_difficulty_data = adaptive_difficulty(
        email
    )

    sleep_data = get_sleep_analytics(
        email
    )

    return {

        "user": {

            "name":
                user.get(
                    "name",
                    ""
                ),

            "email":
                email,

            "role":
                user.get(
                    "role",
                    "User"
                )
        },

        "statistics": {

            "total_alarms":
                total_alarms,

            "total_challenges":
                total_challenges,

            "challenge_accuracy":
                accuracy,

            "total_wakeups":
                total_wakeups,

            "wake_up_consistency":
                wake_up_consistency,

            "habit_score":
                habit_score,

            "recommended_difficulty":
                ml_difficulty_data.get(
                    "next_difficulty",
                    "Beginner"
                ),

            "ml_confidence":
                ml_difficulty_data.get(
                    "confidence",
                    0
                ),

            "average_sleep_hours":
                sleep_data.get(
                    "average_sleep_hours",
                    0
                ),

            "target_sleep_hours":
                sleep_data.get(
                    "target_sleep_hours",
                    8
                ),

            "sleep_adherence":
                sleep_data.get(
                    "sleep_adherence",
                    0
                ),

            "sleep_status":
                sleep_data.get(
                    "sleep_status",
                    "No sleep data"
                )
        }
    }
   # ============================================================
# MILESTONE 4 - ANALYTICS DASHBOARD API
# ============================================================

@app.get("/analytics/dashboard/{email}")
def dashboard_analytics(email: str):

    email = email.strip().lower()

    try:

        # ----------------------------------------------------
        # GET DATA
        # ----------------------------------------------------

        alarms_data = list(
            alarms.find(
                {"email": email},
                {"_id": 0}
            )
        )

        challenge_data = list(
            challenge_history.find(
                {"email": email},
                {"_id": 0}
            )
        )

        wakeup_data = list(
            wakeup_history.find(
                {"email": email},
                {"_id": 0}
            )
        )

        # ----------------------------------------------------
        # CHALLENGE ANALYTICS
        # ----------------------------------------------------

        total_challenges = len(challenge_data)

        correct_challenges = sum(
            1
            for item in challenge_data
            if (
                item.get("correct") is True
                or item.get("is_correct") is True
                or str(
                    item.get("result", "")
                ).lower() == "correct"
            )
        )

        incorrect_challenges = (
            total_challenges
            - correct_challenges
        )

        if total_challenges > 0:

            challenge_accuracy = round(
                (
                    correct_challenges
                    /
                    total_challenges
                ) * 100,
                2
            )

        else:

            challenge_accuracy = 0

        # ----------------------------------------------------
        # WAKE-UP ANALYTICS
        # ----------------------------------------------------

        total_wakeups = len(
            wakeup_data
        )

        successful_wakeups = sum(
            1
            for item in wakeup_data
            if (
                item.get("verified") is True
                or item.get("success") is True
                or item.get("completed") is True
            )
        )

        if total_wakeups > 0:

            wakeup_success_rate = round(
                (
                    successful_wakeups
                    /
                    total_wakeups
                ) * 100,
                2
            )

        else:

            wakeup_success_rate = 0

        # ----------------------------------------------------
        # SNOOZE ANALYTICS
        # ----------------------------------------------------

        snooze_count = sum(
            int(
                item.get(
                    "snooze_count",
                    0
                ) or 0
            )
            for item in wakeup_data
        )

        # ----------------------------------------------------
        # ALARM ANALYTICS
        # ----------------------------------------------------

        total_alarms = len(
            alarms_data
        )

        active_alarms = sum(
            1
            for alarm in alarms_data
            if (
                alarm.get("active") is True
                or alarm.get("enabled") is True
                or str(
                    alarm.get("status", "")
                ).lower() == "active"
            )
        )

        # ----------------------------------------------------
        # REAL HABIT SCORE
        # IMPORTANT:
        # Use existing /habit-score API
        # ----------------------------------------------------

        habit_data = get_habit_score(
            email
        )

        habit_score = float(
            habit_data.get(
                "habit_score",
                0
            )
        )

        habit_components = habit_data.get(
            "components",
            {}
        )

        # ----------------------------------------------------
        # OVERALL SCORE
        # ----------------------------------------------------

        snooze_score = max(
            0,
            100 - (
                snooze_count * 10
            )
        )

        overall_score = round(

            (
                wakeup_success_rate * 0.35
                +
                challenge_accuracy * 0.25
                +
                snooze_score * 0.20
                +
                habit_score * 0.20
            ),

            2
        )

        # ----------------------------------------------------
        # RETURN ANALYTICS
        # ----------------------------------------------------

        return {

            "success": True,

            "email": email,

            "summary": {

                "overall_score":
                    overall_score,

                "habit_score":
                    round(
                        habit_score,
                        2
                    ),

                "challenge_accuracy":
                    challenge_accuracy,

                "wake_up_success_rate":
                    wakeup_success_rate,

                "total_alarms":
                    total_alarms,

                "active_alarms":
                    active_alarms,

                "total_challenges":
                    total_challenges,

                "correct_challenges":
                    correct_challenges,

                "incorrect_challenges":
                    incorrect_challenges,

                "total_wakeups":
                    total_wakeups,

                "snooze_count":
                    snooze_count
            },

            "charts": {

                "challenge_accuracy":
                    challenge_accuracy,

                "wake_up_success":
                    wakeup_success_rate,

                "habit_score":
                    round(
                        habit_score,
                        2
                    ),

                "snooze_score":
                    snooze_score
            },

            "habit_components":
                habit_components,

            "generated_at":
                datetime.now().isoformat()
        }

    except Exception as e:

        return {

            "success": False,

            "error":
                str(e)
        }
        # ============================================================
# MILESTONE 4 - ANALYTICS REPORT
# ============================================================

from fastapi.responses import PlainTextResponse


@app.get(
    "/analytics/report/{email}",
    response_class=PlainTextResponse
)
def generate_analytics_report(email: str):

    email = email.strip().lower()

    try:

        # ----------------------------------------------------
        # GET THE SAME DATA USED BY ANALYTICS DASHBOARD
        # ----------------------------------------------------

        alarms_data = list(
            alarms.find(
                {"email": email},
                {"_id": 0}
            )
        )

        challenge_data = list(
            challenge_history.find(
                {"email": email},
                {"_id": 0}
            )
        )

        wakeup_data = list(
            wakeup_history.find(
                {"email": email},
                {"_id": 0}
            )
        )

        # ----------------------------------------------------
        # CHALLENGE ANALYTICS
        # ----------------------------------------------------

        total_challenges = len(
            challenge_data
        )

        correct_challenges = sum(
            1
            for item in challenge_data
            if (
                item.get("correct") is True
                or item.get("is_correct") is True
                or str(
                    item.get("result", "")
                ).lower() == "correct"
            )
        )

        incorrect_challenges = (
            total_challenges
            - correct_challenges
        )

        if total_challenges > 0:
            challenge_accuracy = round(
                (
                    correct_challenges
                    / total_challenges
                ) * 100,
                2
            )
        else:
            challenge_accuracy = 0

        # ----------------------------------------------------
        # WAKE-UP ANALYTICS
        # ----------------------------------------------------

        total_wakeups = len(
            wakeup_data
        )

        successful_wakeups = sum(
            1
            for item in wakeup_data
            if (
                item.get("verified") is True
                or item.get("success") is True
                or item.get("completed") is True
            )
        )

        if total_wakeups > 0:
            wakeup_success_rate = round(
                (
                    successful_wakeups
                    / total_wakeups
                ) * 100,
                2
            )
        else:
            wakeup_success_rate = 0

        # ----------------------------------------------------
        # SNOOZE ANALYTICS
        # ----------------------------------------------------

        snooze_count = sum(
            int(
                item.get(
                    "snooze_count",
                    0
                ) or 0
            )
            for item in wakeup_data
        )

        snooze_score = max(
            0,
            100 - (
                snooze_count * 10
            )
        )

        # ----------------------------------------------------
        # ALARM ANALYTICS
        # ----------------------------------------------------

        total_alarms = len(
            alarms_data
        )

        active_alarms = sum(
            1
            for alarm in alarms_data
            if (
                alarm.get("active") is True
                or alarm.get("enabled") is True
                or str(
                    alarm.get("status", "")
                ).lower() == "active"
            )
        )

        # ----------------------------------------------------
        # HABIT SCORE
        # ----------------------------------------------------

        habit_data = get_habit_score(
            email
        )

        habit_score = float(
            habit_data.get(
                "habit_score",
                0
            )
        )

        # ----------------------------------------------------
        # OVERALL SCORE
        # ----------------------------------------------------

        overall_score = round(
            (
                wakeup_success_rate * 0.35
                +
                challenge_accuracy * 0.25
                +
                snooze_score * 0.20
                +
                habit_score * 0.20
            ),
            2
        )

        # ----------------------------------------------------
        # REPORT
        # ----------------------------------------------------

        report = f"""
============================================================
                         COGNIA
              INTELLIGENT COGNITIVE
                  ALARM PLATFORM
============================================================

              ANALYTICS & INTELLIGENCE REPORT

User: {email}

Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

------------------------------------------------------------
EXECUTIVE SUMMARY
------------------------------------------------------------

Overall Score          : {overall_score}%
Habit Score            : {habit_score:.2f}%
Challenge Accuracy     : {challenge_accuracy}%
Wake-up Success        : {wakeup_success_rate}%

------------------------------------------------------------
ALARM PERFORMANCE
------------------------------------------------------------

Total Alarms           : {total_alarms}
Active Alarms          : {active_alarms}
Total Wake-ups         : {total_wakeups}
Snooze Count           : {snooze_count}

------------------------------------------------------------
COGNITIVE CHALLENGES
------------------------------------------------------------

Total Challenges       : {total_challenges}
Correct Challenges     : {correct_challenges}
Incorrect Challenges   : {incorrect_challenges}
Challenge Accuracy     : {challenge_accuracy}%

------------------------------------------------------------
BEHAVIORAL INTELLIGENCE
------------------------------------------------------------

Wake-up Consistency    : {
    habit_data.get("components", {}).get(
        "wake_up_consistency", 0
    )
}%

Challenge Completion   : {
    habit_data.get("components", {}).get(
        "challenge_completion", 0
    )
}%

Snooze Reduction       : {
    habit_data.get("components", {}).get(
        "snooze_reduction", 0
    )
}%

Sleep Adherence        : {
    habit_data.get("components", {}).get(
        "sleep_schedule_adherence", 0
    )
}%

------------------------------------------------------------
COGNIA AI INTELLIGENCE
------------------------------------------------------------

COGNIA analyzes user behavior including:

• Wake-up consistency
• Cognitive challenge performance
• Snooze behavior
• Sleep schedule adherence
• Habit formation
• Overall performance

These behavioral signals are used to
adapt future cognitive challenge difficulty.

------------------------------------------------------------
RECOMMENDATIONS
------------------------------------------------------------

Maintain a consistent sleep schedule.

Complete cognitive challenges regularly.

Avoid unnecessary snoozing.

Continue building a consistent morning routine.

COGNIA will continuously adapt the
cognitive challenge experience according
to your performance.

------------------------------------------------------------
REPORT STATUS
------------------------------------------------------------

SUCCESS

Analytics report generated successfully.

COGNIA
Wake your mind. Not just your alarm.

============================================================
"""

        return report

    except Exception as e:

        return f"""
COGNIA ANALYTICS REPORT

Unable to generate report.

Error:
{str(e)}
"""
# =========================================================
# NOTIFICATION & REMINDER SYSTEM
# =========================================================

@app.post("/notifications")
def create_notification(data: dict):
    email = str(data.get("email", "")).strip().lower()

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    notification = {
        "email": email,
        "title": data.get(
            "title",
            "COGNIA Reminder"
        ),
        "message": data.get(
            "message",
            "You have a reminder from COGNIA."
        ),
        "type": data.get(
            "type",
            "general"
        ),
        "read": False,
        "created_at": datetime.utcnow()
    }

    result = db.notifications.insert_one(notification)

    return {
        "message": "Notification created successfully",
        "notification_id": str(result.inserted_id)
    }


@app.get("/notifications/{email}")
def get_notifications(email: str):

    email = email.strip().lower()

    notifications = []

    for item in db.notifications.find(
        {"email": email}
    ).sort("created_at", -1).limit(20):

        notifications.append({
            "id": str(item["_id"]),
            "title": item.get(
                "title",
                "COGNIA Reminder"
            ),
            "message": item.get(
                "message",
                ""
            ),
            "type": item.get(
                "type",
                "general"
            ),
            "read": item.get(
                "read",
                False
            ),
            "created_at": str(
                item.get("created_at", "")
            )
        })

    return {
        "notifications": notifications
    }


@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str):

    from bson import ObjectId

    result = db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"read": True}}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    return {
        "message": "Notification marked as read"
    }


@app.post("/notifications/reminder")
def create_reminder(data: dict):

    email = str(data.get("email", "")).strip().lower()

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required"
        )

    reminder_type = data.get(
        "type",
        "general"
    )

    messages = {
        "bedtime":
            "Time to prepare for sleep and maintain your sleep routine.",
        "wakeup":
            "Your wake-up routine is ready. Complete your cognitive challenge.",
        "habit":
            "Keep your habit streak going today!",
        "challenge":
            "A new cognitive challenge is waiting for you.",
        "progress":
            "Check your COGNIA progress and habit score."
    }

    title = data.get(
        "title",
        "COGNIA Reminder"
    )

    message = data.get(
        "message",
        messages.get(
            reminder_type,
            "You have a new COGNIA reminder."
        )
    )

    notification = {
        "email": email,
        "title": title,
        "message": message,
        "type": reminder_type,
        "read": False,
        "created_at": datetime.utcnow()
    }

    result = db.notifications.insert_one(notification)

    return {
        "message": "Reminder created successfully",
        "notification_id": str(result.inserted_id),
        "type": reminder_type
    }
    # =========================================================
# WELLNESS COACH
# =========================================================

@app.get("/coach/users")
def get_coach_users():

    coach_users = list(
        users.find(
            {"role": "User"},
            {
                "_id": 0,
                "name": 1,
                "email": 1,
                "role": 1,
                "created_at": 1
            }
        )
    )

    return {
        "users": coach_users,
        "total_users": len(coach_users)
    }


@app.get("/coach/user/{email}")
def get_coach_user_details(email: str):

    email = email.strip().lower()

    user = users.find_one(
        {"email": email},
        {"_id": 0, "password": 0}
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return user