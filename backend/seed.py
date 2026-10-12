from app.database import users, create_indexes
from app.security import hash_password
from datetime import datetime, timezone

def seed_demo_users():
    create_indexes()
    demo = [
        ("Admin", "admin", "admin@cognitivewake.com", "Admin@123", "ADMIN"),
        ("WellnessCoach", "wellness_coach", "wellness_coach@cognitivewake.com", "WellnessCoach@123", "WELLNESS_COACH"),
        ("Demo User", "user", "user@cognitivewake.com", "User@123", "USER")
    ]
    for name, username, email, password, role in demo:
        existing = users.find_one({"$or": [{"email": email.lower()}, {"username": username.lower()}]})
        if not existing:
            users.insert_one({
                "name": name,
                "username": username.lower(),
                "email": email.lower(),
                "password_hash": hash_password(password),
                "role": role,
                "timezone": "Asia/Kolkata",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            })
            print(f"Seeded demo account: {username} / {email} ({role})")
        else:
            # Ensure username field exists on existing doc
            users.update_one({"_id": existing["_id"]}, {"$set": {"username": username.lower()}})

if __name__ == "__main__":
    seed_demo_users()
