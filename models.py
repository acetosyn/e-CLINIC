# ==========================================================
# EPICONSULT e-CLINIC — Database Models (models.py)
# SQLAlchemy models for Postgres/Supabase
# ==========================================================
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
db = SQLAlchemy()

# ----------------------------------------------------------
# USER MODEL
# ----------------------------------------------------------
class User(UserMixin, db.Model):
    """User model for role-based authentication"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Valid roles
    VALID_ROLES = [
        'Admin',
        'HOP',
        'Doctor',
        'Pharmacy',
        'Inventory',
        'Lab',
        'Nursing',
        'Customer Care',
        'Staff'
    ]
    
    def set_password(self, password):
        """Hash and set password"""
        try:
            self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')
            logger.info(f"Password set for user: {self.username}")
        except Exception as e:
            logger.error(f"Error setting password for {self.username}: {e}")
            raise
    
    def check_password(self, password):
        """Verify password"""
        try:
            return check_password_hash(self.password_hash, password)
        except Exception as e:
            logger.error(f"Error checking password for {self.username}: {e}")
            return False
    
    def update_last_login(self):
        """Update last login timestamp"""
        try:
            self.last_login = datetime.now()
            db.session.commit()
            logger.info(f"Updated last login for user: {self.username}")
        except Exception as e:
            logger.error(f"Error updating last login for {self.username}: {e}")
            db.session.rollback()
    
    def __repr__(self):
        return f'<User {self.username} ({self.role})>'


# ----------------------------------------------------------
# HELPER FUNCTIONS
# ----------------------------------------------------------
def init_db_models(app):
    """Initialize database models"""
    db.init_app(app)
    with app.app_context():
        try:
            db.create_all()
            logger.info("Database models initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing database models: {e}")
            raise


def get_user_by_username(username):
    """Get user by username"""
    try:
        return User.query.filter_by(username=username).first()
    except Exception as e:
        logger.error(f"Error fetching user {username}: {e}")
        return None


def get_user_by_id(user_id):
    """Get user by ID"""
    try:
        return User.query.get(int(user_id))
    except Exception as e:
        logger.error(f"Error fetching user by ID {user_id}: {e}")
        return None


def verify_user_credentials(username, password, role):
    """Verify user credentials"""
    try:
        user = User.query.filter_by(username=username, role=role, is_active=True).first()
        if user and user.check_password(password):
            user.update_last_login()
            return user
        return None
    except Exception as e:
        logger.error(f"Error verifying credentials for {username}: {e}")
        return None

