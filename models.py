# ==========================================================
# EPICONSULT e-CLINIC — Database Models
# SQLAlchemy Models for Supabase Postgres
# ==========================================================
from flask_login import UserMixin
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime as dt

Base = declarative_base()


class User(Base, UserMixin):
    """User model matching Supabase users table."""
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=dt.now)
    updated_at = Column(DateTime, default=dt.now, onupdate=dt.now)
    last_login = Column(DateTime, nullable=True)

    def get_id(self):
        return str(self.id)

    def __repr__(self):
        return f'<User {self.username} ({self.role})>'


class Activity(Base):
    """Activity log for real-time updates across all departments."""
    __tablename__ = 'activities'

    id = Column(Integer, primary_key=True)
    department = Column(String(100), nullable=False)
    activity_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    patient_name = Column(String(255), nullable=True)
    patient_id = Column(String(100), nullable=True)
    performed_by = Column(String(255), nullable=False)
    activity_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=dt.now, nullable=False)

    def to_dict(self):
        """Convert activity to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'department': self.department,
            'activity_type': self.activity_type,
            'description': self.description,
            'patient_name': self.patient_name,
            'patient_id': self.patient_id,
            'performed_by': self.performed_by,
            'metadata': self.activity_metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<Activity {self.department} - {self.activity_type}>'

