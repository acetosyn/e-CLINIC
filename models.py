# ==========================================================
# EPICONSULT e-CLINIC — Database Models
# SQLAlchemy Models for Supabase Postgres
# ==========================================================
from flask_login import UserMixin
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, Numeric, Date
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime as dt

Base = declarative_base()


class User(Base, UserMixin):
    """
    NEW USER MODEL (Redo)
    - role: "staff" | "admin"
    - department: one of DEPARTMENTS (staff only); admin => NULL
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)

    # identity
    full_name = Column(String(255), nullable=False)
    username = Column(String(120), unique=True, nullable=False, index=True)

    # auth
    password_hash = Column(String, nullable=False)

    # access
    role = Column(String(50), nullable=False, default="staff")  # staff/admin
    department = Column(String(120), nullable=True)             # staff-only

    # status + timestamps
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    def get_id(self):
        return str(self.id)

    def __repr__(self):
        return f"<User {self.username} ({self.role}) dept={self.department}>"


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
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)

    def to_dict(self):
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


class Patient(Base):
    """Patient registration model for customer care."""
    __tablename__ = 'patients'

    id = Column(Integer, primary_key=True)
    file_no = Column(String(50), unique=True, nullable=False)
    patient_id = Column(String(100), unique=True, nullable=False)
    title = Column(String(20), nullable=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    age = Column(Integer, nullable=True)
    sex = Column(String(20), nullable=False)
    occupation = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    referred_by_id = Column(Integer, nullable=True)
    registered_by = Column(String(255), nullable=False)
    account_status = Column(String(50), nullable=True)
    registration_date = Column(Date, nullable=True)
    category = Column(String(100), nullable=True)
    is_test = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)

    def __repr__(self):
        return f'<Patient {self.patient_id} - {self.first_name} {self.last_name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'file_no': self.file_no,
            'patient_id': self.patient_id,
            'title': self.title,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': f"{self.first_name} {self.last_name}",
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'age': self.age,
            'sex': self.sex,
            'occupation': self.occupation,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'referred_by_id': self.referred_by_id,
            'registered_by': self.registered_by,
            'account_status': self.account_status,
            'registration_date': self.registration_date.isoformat() if self.registration_date else None,
            'category': self.category,
            'is_test': self.is_test,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Referral(Base):
    """Referral sources (doctors, hospitals, clinics)."""
    __tablename__ = 'referrals'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    contact = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)

    def __repr__(self):
        return f'<Referral {self.name} ({self.type})>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'contact': self.contact,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Service(Base):
    """Hospital services (Consultation, Laboratory, Radiology, etc.)."""
    __tablename__ = 'services'

    id = Column(Integer, primary_key=True)
    service_type = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)

    def __repr__(self):
        return f'<Service {self.name} ({self.service_type})>'

    def to_dict(self):
        return {
            'id': self.id,
            'service_type': self.service_type,
            'name': self.name,
            'description': self.description,
            'price': float(self.price) if self.price else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Drug(Base):
    """Drugs inventory - matches Excel file columns."""
    __tablename__ = 'drugs'

    id = Column(Integer, primary_key=True)
    serial_number = Column(Integer, nullable=True)
    name = Column(String(255), nullable=False)
    outsourced_price = Column(Numeric(10, 2), nullable=True)
    walkin_patient_price = Column(Numeric(10, 2), nullable=True)
    hospital_patient_price = Column(Numeric(10, 2), nullable=True)
    category = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)

    def __repr__(self):
        return f'<Drug {self.name} ({self.category})>'

    def to_dict(self):
        return {
            'id': self.id,
            'serial_number': self.serial_number,
            'name': self.name,
            'outsourced_price': float(self.outsourced_price) if self.outsourced_price else None,
            'walkin_patient_price': float(self.walkin_patient_price) if self.walkin_patient_price else None,
            'hospital_patient_price': float(self.hospital_patient_price) if self.hospital_patient_price else None,
            'category': self.category,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class DepartmentMessage(Base):
    """Inter-department direct messaging system."""
    __tablename__ = 'department_messages'

    id = Column(Integer, primary_key=True)
    sender_department = Column(String(100), nullable=False)
    receiver_department = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'sender': self.sender_department,
            'receiver': self.receiver_department,
            'message': self.message,
            'timestamp': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<DepartmentMessage {self.sender_department} → {self.receiver_department}>'
