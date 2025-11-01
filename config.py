import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Flask configuration class"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'epiconsult-secret-key-change-in-production')
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    
    # Supabase configuration
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
    SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
    
    # Database configuration - extract DB URL from Supabase
    # Supabase provides a postgres connection string
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    # SQLAlchemy configuration
    if DATABASE_URL:
        if DATABASE_URL.startswith('postgres://'):
            # Render and some services use postgres:// but SQLAlchemy needs postgresql://
            SQLALCHEMY_DATABASE_URI = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        else:
            SQLALCHEMY_DATABASE_URI = DATABASE_URL
    else:
        # Fallback to SQLite for local development
        SQLALCHEMY_DATABASE_URI = 'sqlite:///database.db'
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }

