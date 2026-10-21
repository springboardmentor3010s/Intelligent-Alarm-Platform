from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from Models.user import User
from Models.habit import Habit
from Models.alarm import Alarm

def restore_data():
    sqlite_engine = create_engine('sqlite:///./cognitive_alarm.db')
    with Session(sqlite_engine) as db:
        user = db.query(User).filter(User.email == "Gagan2@gmail.com").first()
        if not user:
            print("User Gagan2@gmail.com not found!")
            return
        
        # Habits seen on dashboard
        h1 = Habit(user_id=user.id, name="complete assignment", category="Study & Education", target_duration_minutes=15, frequency="Daily")
        h2 = Habit(user_id=user.id, name="study", category="Study & Education", target_duration_minutes=15, frequency="Daily")
        h3 = Habit(user_id=user.id, name="walking", category="Health & Fitness", target_duration_minutes=15, frequency="Daily")
        
        # Alarms seen on dashboard
        a1 = Alarm(user_id=user.id, title="Morning Class", time="07:00", challenge_type="Math Problems", difficulty="Medium", is_active=True, days_of_week="Mon,Tue,Wed,Thu,Fri,Sat,Sun")
        a2 = Alarm(user_id=user.id, title="Class", time="09:00", challenge_type="Logic Puzzles", difficulty="Medium", is_active=True, days_of_week="Mon,Tue,Wed,Thu,Fri,Sat,Sun")
        a3 = Alarm(user_id=user.id, title="Evening Study", time="17:00", challenge_type="Memory Challenge", difficulty="Medium", is_active=True, days_of_week="Mon,Tue,Wed,Thu,Fri,Sat,Sun")
        
        db.add_all([h1, h2, h3, a1, a2, a3])
        db.commit()
        print("Data restored!")

if __name__ == "__main__":
    restore_data()
