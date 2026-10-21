from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # 'alarm', 'challenge', 'habit', 'recommendation', 'coach_recommendation', 'announcement', 'system', 'report'
    priority = Column(String(20), default="normal")  # 'normal', 'high', 'urgent'
    is_read = Column(Boolean, default=False, index=True)
    link = Column(String(255), nullable=True)
    related_entity_type = Column(String(50), nullable=True)
    related_entity_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    recipient_type = Column(String(50), nullable=False)  # 'all', 'users', 'coaches', 'user', 'coach'
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    priority = Column(String(20), default="normal")  # 'normal', 'high', 'urgent'
    created_at = Column(DateTime, server_default=func.now(), index=True)

class CoachMessage(Base):
    __tablename__ = "coach_messages"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message_type = Column(String(50), default="recommendation")  # Strictly 'recommendation'
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)
