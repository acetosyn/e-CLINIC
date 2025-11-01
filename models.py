from flask_login import UserMixin
from datetime import datetime
from db import db

class User(UserMixin, db.Model):
    """User model for authentication and authorization"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    last_login = db.Column(db.DateTime)
    
    def __repr__(self):
        return f'<User {self.username} - {self.role}>'
    
    def get_id(self):
        """Required for flask_login"""
        return str(self.id)
    
    @property
    def is_authenticated(self):
        """Required for flask_login"""
        return True
    
    def update_last_login(self):
        """Update last login timestamp"""
        self.last_login = datetime.now()
        db.session.commit()

