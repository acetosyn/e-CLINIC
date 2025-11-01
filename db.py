from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash
import logging

# Initialize SQLAlchemy
db = SQLAlchemy()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db(app):
    """Initialize database with Flask app"""
    try:
        db.init_app(app)
        with app.app_context():
            # Import models here to avoid circular imports
            from models import User
            db.create_all()
            logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {str(e)}")
        raise

def verify_user(username, password_input, role):
    """Verify user credentials against Supabase database"""
    try:
        from models import User
        from sqlalchemy import select
        
        # Query user by username and role (case-insensitive) - SQLAlchemy 2.0 style
        stmt = select(User).where(
            db.func.lower(User.username) == username.lower(),
            db.func.lower(User.role) == role.lower(),
            User.is_active == True
        )
        user = db.session.execute(stmt).scalar_one_or_none()
        
        if user and check_password_hash(user.password_hash, password_input):
            logger.info(f"User {username} logged in successfully")
            return user
        
        logger.warning(f"Failed login attempt for {username}")
        return None
    except Exception as e:
        logger.error(f"Login verification error: {str(e)}")
        return None
