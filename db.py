# ==========================================================
# EPICONSULT e-CLINIC — Database Utility (db.py)
# Supabase Postgres Connection
# ==========================================================
import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import NullPool
from werkzeug.security import check_password_hash
from models import User, Activity, Base

load_dotenv()
logger = logging.getLogger(__name__)

# Supabase Postgres connection string from environment
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logger.error("DATABASE_URL not found in environment variables")
    raise ValueError("DATABASE_URL must be set in .env file")

engine = None
db_session = None

try:
    if DATABASE_URL:
        engine = create_engine(
            DATABASE_URL,
            poolclass=NullPool,  # Using NullPool to avoid connection pool issues with Supabase
            echo=False,
            pool_pre_ping=True,  # Verify connections before using them
            pool_recycle=3600,  # Recycle connections after 1 hour
            connect_args={
                "connect_timeout": 15,  # Increased to 15 seconds for DNS resolution
                "keepalives": 1,
                "keepalives_idle": 30,
                "keepalives_interval": 10,
                "keepalives_count": 5
            } if "postgresql" in DATABASE_URL.lower() else {}
        )
        db_session = scoped_session(sessionmaker(bind=engine))
        Base.metadata.bind = engine
        logger.info("Database connection established")
except Exception as e:
    logger.error(f"Failed to establish database connection: {str(e)}")
    raise


# ----------------------------------------------------------
# VERIFY USER LOGIN
# ----------------------------------------------------------
# Note: normalize_role is now imported from privileges.py to avoid duplication
from privileges import normalize_role


def verify_user(username, password, role=None):
    """Verifies user using ONLY username + password.
       Role dropdown is ignored because DB role is the source of truth."""
    import time
    from sqlalchemy.exc import OperationalError
    
    if not db_session:
        logger.error("Database session not available")
        return None

    max_retries = 3
    retry_delay = 1.0
    
    for attempt in range(max_retries):
        try:
            from sqlalchemy import func

            # Fetch user by username only (case-insensitive)
            user = db_session.query(User).filter(
                func.lower(User.username) == func.lower(username)
            ).first()

            if not user:
                logger.warning(f"User not found: username={username}")
                return None

            # Check if active
            if not user.is_active:
                logger.warning(f"Inactive user attempted login: {username}")
                return None

            # Password hash must be valid
            if not user.password_hash or not user.password_hash.startswith("pbkdf2:"):
                logger.error(f"Invalid password hash for user: {username}")
                return None

            # Check password
            password_match = check_password_hash(user.password_hash, password)
            logger.info(f"Password check result: {password_match}")

            if password_match:
                # Update timestamps
                user.last_login = datetime.now()
                user.updated_at = datetime.now()
                db_session.commit()

                logger.info(f"User {username} logged in successfully with DB role {user.role}")
                return user

            logger.warning(f"Invalid password for user: {username}")
            return None

        except OperationalError as e:
            error_str = str(e)
            db_session.rollback()
            
            # Check if it's a DNS/connection error
            if 'could not translate host name' in error_str.lower() or 'could not connect' in error_str.lower():
                if attempt < max_retries - 1:
                    logger.warning(f"Database connection error (attempt {attempt + 1}/{max_retries}), retrying in {retry_delay}s: {error_str}")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    # Try to refresh the connection
                    try:
                        db_session.remove()
                    except:
                        pass
                    continue
                else:
                    logger.error(f"Failed to verify user after {max_retries} attempts: {error_str}")
                    return None
            else:
                # Other operational errors - don't retry
                logger.error(f"Error verifying user: {error_str}", exc_info=True)
                db_session.rollback()
                return None
                
        except Exception as e:
            logger.error(f"Error verifying user: {str(e)}", exc_info=True)
            db_session.rollback()
            return None
    
    return None



def get_user_by_id(user_id, retries=3):
    """Get user by ID for Flask-Login with retry logic for temporary connection errors."""
    if not db_session or not engine:
        logger.warning("Database session or engine not available")
        return None
    
    import time
    from sqlalchemy.exc import OperationalError, DisconnectionError
    try:
        import psycopg2
        psycopg2_available = True
    except ImportError:
        psycopg2_available = False
    
    for attempt in range(retries):
        try:
            # Try to get the user
            user = db_session.query(User).filter(User.id == user_id).first()
            # If we get here, connection is good
            return user
        except (OperationalError, DisconnectionError) as e:
            # These are temporary connection errors (DNS, network, etc.)
            error_msg = str(e).lower()
            is_temporary = any(keyword in error_msg for keyword in [
                'could not translate host name',
                'could not connect',
                'connection refused',
                'temporary failure',
                'name resolution',
                'dns',
                'timeout',
                'network'
            ])
            
            if is_temporary and attempt < retries - 1:
                wait_time = (attempt + 1) * 0.5  # Exponential backoff: 0.5s, 1s, 1.5s
                logger.warning(f"Temporary connection error (attempt {attempt + 1}/{retries}), retrying in {wait_time}s: {str(e)[:100]}")
                
                # Clean up failed session
                try:
                    db_session.rollback()
                    db_session.remove()  # Remove scoped session
                except:
                    pass
                
                time.sleep(wait_time)
                
                # Session will be recreated automatically by scoped_session on next access
                continue
            else:
                # Last attempt or non-temporary error
                if attempt == retries - 1:
                    logger.warning(f"Failed to get user {user_id} after {retries} attempts (connection error: {str(e)[:100]})")
                else:
                    logger.error(f"Non-temporary error getting user by ID (attempt {attempt + 1}/{retries}): {str(e)[:100]}")
                
                try:
                    db_session.rollback()
                except:
                    pass
                return None
        except Exception as e:
            # Non-connection errors - log and return None
            logger.error(f"Unexpected error getting user by ID: {str(e)[:100]}")
            try:
                db_session.rollback()
            except:
                pass
            return None
    
    return None


def get_user_by_username(username):
    """Get user by username."""
    if not db_session:
        return None
    
    try:
        from sqlalchemy import func
        return db_session.query(User).filter(
            func.lower(User.username) == func.lower(username)
        ).first()
    except Exception as e:
        logger.error(f"Error getting user by username: {str(e)}")
        return None


def log_activity(department, activity_type, description, performed_by, 
                 patient_name=None, patient_id=None, metadata=None):
    """Log an activity to the activities table."""
    if not db_session:
        logger.error("Database session not available for activity logging")
        return None
    
    try:
        activity = Activity(
            department=department,
            activity_type=activity_type,
            description=description,
            patient_name=patient_name,
            patient_id=patient_id,
            performed_by=performed_by,
            activity_metadata=metadata,
            created_at=datetime.now()
        )
        db_session.add(activity)
        db_session.commit()
        logger.info(f"Activity logged: {department} - {activity_type}")
        return activity
    except Exception as e:
        logger.error(f"Error logging activity: {str(e)}")
        db_session.rollback()
        return None
