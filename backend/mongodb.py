import os
from pymongo import MongoClient
from datetime import datetime

MONGO_URL = os.getenv("MONGO_URL", "mongodb://127.0.0.1:27017")

mongo_client = MongoClient(MONGO_URL)
mongo_db = mongo_client["cognitive_alarm_ai"]
behavior_events = mongo_db["behavior_events"]
def test_mongodb_connection():
    try:
        mongo_client.admin.command("ping")
        return True
    except Exception:
        return False


def log_behavior_event(
    user_id,
    event_type,
    event_data=None
):
    event = {
        "user_id": user_id,
        "event_type": event_type,
        "event_data": event_data or {},
        "timestamp": datetime.utcnow()
    }

    result = behavior_events.insert_one(event)

    return str(result.inserted_id)