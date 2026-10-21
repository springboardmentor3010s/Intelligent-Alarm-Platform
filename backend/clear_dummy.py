from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from Models.user import User
from Models.habit import Habit
from Models.alarm import Alarm

sqlite_engine = create_engine('sqlite:///./cognitive_alarm.db')
db = Session(sqlite_engine)
db.query(Habit).delete()
db.query(Alarm).delete()
db.commit()
print("Cleaned up dummy data")
