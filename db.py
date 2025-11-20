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
            poolclass=NullPool,
            echo=False,
            pool_pre_ping=True,  # Verify connections before using them
            connect_args={
                "connect_timeout": 10,  # 10 second connection timeout
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


def verify_user(username, password, role):
    """Verifies user credentials against Supabase."""
    if not db_session:
        logger.error("Database session not available")
        return None
    
    try:
        from sqlalchemy import func
        
        # Normalize the requested role to match database format
        normalized_role = normalize_role(role)
        
        # First, try to find user by username only (for debugging)
        user_by_username = db_session.query(User).filter(
            func.lower(User.username) == func.lower(username)
        ).first()
        
        if not user_by_username:
            logger.warning(f"User not found: username={username}")
            return None
        
        # Normalize database role for comparison
        db_role_normalized = normalize_role(user_by_username.role)
        
        logger.info(f"Found user: username={user_by_username.username}, role={user_by_username.role} ({db_role_normalized}), requested_role={role} ({normalized_role})")
        
        # Check if role matches (normalized comparison)
        if db_role_normalized != normalized_role:
            logger.warning(f"Role mismatch: user role='{user_by_username.role}' ({db_role_normalized}), requested role='{role}' ({normalized_role})")
            return None
        
        if not user_by_username.is_active:
            logger.warning(f"Inactive user attempted login: {username}")
            return None
        
        # Check password hash format
        if not user_by_username.password_hash or not user_by_username.password_hash.startswith('pbkdf2:'):
            logger.error(f"Invalid password hash format for user: {username}")
            return None
        
        # Verify password
        password_match = check_password_hash(user_by_username.password_hash, password)
        logger.info(f"Password check result: {password_match}")
        
        if password_match:
            # Update last_login
            user_by_username.last_login = datetime.now()
            user_by_username.updated_at = datetime.now()
            db_session.commit()
            logger.info(f"User {username} ({role}) logged in successfully")
            return user_by_username
        else:
            logger.warning(f"Invalid password for user: {username}")
            return None
    except Exception as e:
        logger.error(f"Error verifying user: {str(e)}", exc_info=True)
        db_session.rollback()
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
