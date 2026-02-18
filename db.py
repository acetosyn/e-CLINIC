# ==========================================================
# EPICONSULT e-CLINIC — Database Utility (db.py)
# Supabase Postgres Connection + User Admin CRUD
# ==========================================================
import os
import logging
import time
from datetime import datetime
from dotenv import load_dotenv

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import NullPool
from sqlalchemy.exc import OperationalError, DisconnectionError
from werkzeug.security import check_password_hash, generate_password_hash

from models import Base, User  # keep other models import later if needed
from constants import DEPARTMENTS, is_valid_department
 # you created this ✅

load_dotenv()
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    logger.error("DATABASE_URL not found in environment variables")
    raise ValueError("DATABASE_URL must be set in .env file")

engine = None
db_session = None

# ==========================================================
# ENGINE / SESSION
# ==========================================================
try:
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,          # good for Supabase
        echo=False,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={
            "connect_timeout": 15,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5
        } if "postgresql" in DATABASE_URL.lower() else {}
    )
    db_session = scoped_session(sessionmaker(bind=engine, autoflush=False, autocommit=False))
    Base.metadata.bind = engine
    logger.info("✅ Database connection established")
except Exception as e:
    logger.error(f"❌ Failed to establish database connection: {str(e)}", exc_info=True)
    raise


def init_db():
    """
    Create tables if they don't exist.
    Safe for SQLite and fresh Postgres setups.
    If you're using Alembic migrations, you can skip calling this.
    """
    Base.metadata.create_all(bind=engine)


# ==========================================================
# AUTH HELPERS
# ==========================================================
def verify_user(username: str, password: str):
    """
    Verifies user using username + password only.
    Role/department come from DB.
    """
    if not db_session:
        logger.error("Database session not available")
        return None

    username = (username or "").strip()
    password = (password or "").strip()
    if not username or not password:
        return None

    max_retries = 3
    retry_delay = 1.0

    for attempt in range(max_retries):
        try:
            from sqlalchemy import func

            user = db_session.query(User).filter(
                func.lower(User.username) == func.lower(username)
            ).first()

            if not user:
                logger.warning(f"User not found: username={username}")
                return None

            if not user.is_active:
                logger.warning(f"Inactive user attempted login: {username}")
                return None

            if not user.password_hash:
                logger.error(f"Missing password hash for user: {username}")
                return None

            if not check_password_hash(user.password_hash, password):
                logger.warning(f"Invalid password for user: {username}")
                return None

            # success: update last login
            user.last_login = datetime.utcnow()
            user.updated_at = datetime.utcnow()
            db_session.commit()

            logger.info(f"✅ Login OK: {username} (role={user.role}, dept={user.department})")
            return user

        except OperationalError as e:
            db_session.rollback()
            err = str(e).lower()

            is_temp = any(k in err for k in [
                "could not translate host name",
                "could not connect",
                "connection refused",
                "temporary failure",
                "name resolution",
                "dns",
                "timeout",
                "network"
            ])

            if is_temp and attempt < max_retries - 1:
                logger.warning(f"DB temp error (attempt {attempt+1}/{max_retries}) retrying in {retry_delay}s: {str(e)[:120]}")
                time.sleep(retry_delay)
                retry_delay *= 2
                try:
                    db_session.remove()
                except:
                    pass
                continue

            logger.error(f"DB error verifying user: {str(e)[:200]}", exc_info=True)
            return None

        except Exception as e:
            logger.error(f"Unexpected error verifying user: {str(e)}", exc_info=True)
            db_session.rollback()
            return None

    return None


def get_user_by_id(user_id: int, retries: int = 3):
    """Get user by ID for Flask-Login with retry logic."""
    if not db_session:
        return None

    for attempt in range(retries):
        try:
            return db_session.query(User).filter(User.id == int(user_id)).first()
        except (OperationalError, DisconnectionError) as e:
            db_session.rollback()
            err = str(e).lower()
            is_temp = any(k in err for k in [
                "could not translate host name",
                "could not connect",
                "connection refused",
                "temporary failure",
                "name resolution",
                "dns",
                "timeout",
                "network"
            ])
            if is_temp and attempt < retries - 1:
                wait = (attempt + 1) * 0.6
                logger.warning(f"DB temp error get_user_by_id (attempt {attempt+1}/{retries}) waiting {wait}s")
                try:
                    db_session.remove()
                except:
                    pass
                time.sleep(wait)
                continue
            logger.error(f"DB error get_user_by_id: {str(e)[:200]}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"Unexpected error get_user_by_id: {str(e)[:200]}", exc_info=True)
            db_session.rollback()
            return None
    return None


def get_user_by_username(username: str):
    """Get user by username (case-insensitive)."""
    if not db_session:
        return None
    try:
        from sqlalchemy import func
        return db_session.query(User).filter(func.lower(User.username) == func.lower(username)).first()
    except Exception as e:
        logger.error(f"Error getting user by username: {str(e)}", exc_info=True)
        db_session.rollback()
        return None


# ==========================================================
# ADMIN CRUD HELPERS (used by admin blueprint later)
# ==========================================================
def admin_create_user(full_name: str, username: str, password: str,
                      role: str = "staff", department: str | None = None,
                      is_active: bool = True):
    """
    Create user in DB.
    - role: "staff" or "admin"
    - staff must have department in DEPARTMENTS
    - admin should have department=None
    """
    if not db_session:
        raise RuntimeError("DB session not available")

    full_name = (full_name or "").strip()
    username = (username or "").strip().lower()
    password = (password or "").strip()
    role = (role or "staff").strip().lower()

    if not full_name or not username or not password:
        raise ValueError("full_name, username and password are required")

    if role not in ("staff", "admin"):
        raise ValueError("role must be 'staff' or 'admin'")

    if role == "staff":
        if not is_valid_department(department):
            raise ValueError("Invalid department for staff user")

    else:
        department = None

    # username must be unique
    if get_user_by_username(username):
        raise ValueError("Username already exists")

    user = User(
        full_name=full_name,
        username=username,
        password_hash=generate_password_hash(password),
        role=role,
        department=department,
        is_active=bool(is_active),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        last_login=None
    )

    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def admin_list_users():
    if not db_session:
        return []
    try:
        return db_session.query(User).order_by(User.created_at.desc()).all()
    except Exception as e:
        logger.error(f"Error listing users: {str(e)}", exc_info=True)
        db_session.rollback()
        return []


def admin_delete_user(user_id: int):
    if not db_session:
        return False
    try:
        user = db_session.query(User).filter(User.id == int(user_id)).first()
        if not user:
            return False
        db_session.delete(user)
        db_session.commit()
        return True
    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}", exc_info=True)
        db_session.rollback()
        return False


def admin_set_active(user_id: int, is_active: bool):
    if not db_session:
        return None
    try:
        user = db_session.query(User).filter(User.id == int(user_id)).first()
        if not user:
            return None
        user.is_active = bool(is_active)
        user.updated_at = datetime.utcnow()
        db_session.commit()
        db_session.refresh(user)
        return user
    except Exception as e:
        logger.error(f"Error updating user active status: {str(e)}", exc_info=True)
        db_session.rollback()
        return None


# ==========================================================
# ACTIVITY LOGGING
# ==========================================================
def log_activity(
    department: str,
    activity_type: str,
    description: str,
    patient_name: str | None = None,
    patient_id: str | None = None,
    performed_by: str | None = None,
    metadata: dict | None = None,
):
    """
    Log an activity into the activities table.
    Matches models.Activity fields:
      - department
      - activity_type
      - description
      - patient_name
      - patient_id
      - performed_by
      - activity_metadata
      - created_at
    """
    try:
        from models import Activity

        activity = Activity(
            department=(department or "").strip() or "unknown",
            activity_type=(activity_type or "").strip() or "unknown",
            description=(description or "").strip() or "",
            patient_name=(patient_name or None),
            patient_id=(patient_id or None),
            performed_by=(performed_by or "system"),
            activity_metadata=metadata or None,
            created_at=datetime.utcnow(),
        )

        db_session.add(activity)
        # Do NOT commit here if caller will commit; flush is safer.
        db_session.flush()
        return activity

    except Exception as e:
        logger.warning(f"log_activity failed (ignored): {str(e)}", exc_info=True)
        try:
            db_session.rollback()
        except Exception:
            pass
        return None





def admin_set_password(user_id: int, new_password: str):
    """
    Admin resets a user's password (stores hash in users.password_hash).
    Returns updated user object, or None if not found.
    """
    if not db_session:
        raise RuntimeError("DB session not available")

    new_password = (new_password or "").strip()
    if len(new_password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    try:
        user = db_session.query(User).filter(User.id == int(user_id)).first()
        if not user:
            return None

        user.password_hash = generate_password_hash(new_password)
        user.updated_at = datetime.utcnow()
        db_session.commit()
        db_session.refresh(user)
        return user

    except Exception as e:
        logger.error(f"Error updating password: {str(e)}", exc_info=True)
        db_session.rollback()
        raise
