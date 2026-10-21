import sys
import os
from sqlalchemy.orm import Session
from database import engine
from Models.user import User
from Models.habit import Habit
from Models.alarm import Alarm
from Models.challenge import Challenge, WakeUpEvent, ChallengeAttempt
from auth import hash_password

def seed_users():
    with Session(engine) as db:
        users_to_add = [
            {
                "email": "Gagan2@gmail.com",
                "name": "Gagan2",
                "role": "user",
                "password": "Gagan@123"
            },
            {
                "email": "coach@gmail.com",
                "name": "Wellness Coach",
                "role": "wellness_coach",
                "password": "Coach@123"
            },
            {
                "email": "Gagan@gmail.com",
                "name": "Gagan (Admin)",
                "role": "admin",
                "password": "Gagan@123"
            }
        ]

        for u in users_to_add:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if existing:
                existing.password_hash = hash_password(u["password"])
                existing.role = u["role"]
                existing.name = u["name"]
                print(f"Updated existing user: {u['email']}")
            else:
                new_user = User(
                    name=u["name"],
                    email=u["email"],
                    password_hash=hash_password(u["password"]),
                    role=u["role"]
                )
                db.add(new_user)
                print(f"Created new user: {u['email']}")
        
        db.commit()
        print("Database seeded with requested users.")

if __name__ == "__main__":
    seed_users()
