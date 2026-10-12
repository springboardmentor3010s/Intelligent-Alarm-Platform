import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
db = client[os.getenv("DATABASE_NAME", "cognitivewake")]

users = db.users
alarms = db.alarms
challenges = db.challenges
alarm_sessions = db.alarm_sessions
challenge_attempts = db.challenge_attempts
performance = db.performance
notifications = db.notifications
audit_logs = db.audit_logs
difficulty_history = db.difficulty_history

snooze_logs = db.snooze_logs
recommendation_logs = db.recommendation_logs
system_settings = db.system_settings
user_activity = db.user_activity

def create_indexes():
    users.create_index("email", unique=True)
    alarms.create_index([("user_id", 1), ("alarm_time", 1)])
    challenges.create_index([("type", 1), ("difficulty", 1)])
    alarm_sessions.create_index([("user_id", 1), ("triggered_at", -1)])
    challenge_attempts.create_index([("user_id", 1), ("attempted_at", -1)])
    snooze_logs.create_index([("user_id", 1), ("snoozed_at", -1)])
    notifications.create_index([("user_id", 1), ("created_at", -1)])
    audit_logs.create_index([("timestamp", -1)])
    difficulty_history.create_index([("user_id", 1), ("timestamp", -1)])
    recommendation_logs.create_index([("user_id", 1), ("created_at", -1)])
    user_activity.create_index([("user_id", 1), ("date", -1)])
