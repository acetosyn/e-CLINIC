# ==========================================================
# User Services — user_services.py
# ==========================================================

from db import verify_user as db_verify_user, get_user_by_id

# PURE LOGIC from privileges.py
from privileges import normalize_role, is_unrestricted_role

# FLASK-LOGIN / CONTEXT LOGIC from utils.decorators
from utils.decorators import get_user_role, get_user_context

# Authenticate user credentials
def authenticate_user(username: str, password: str, role: str):
    return db_verify_user(username, password, role)

# Flask-Login: load user from session
def load_user_from_session(user_id):
    try:
        return get_user_by_id(int(user_id))
    except:
        return None

# Shortcut helpers
def get_role():
    return get_user_role()

def get_context():
    return get_user_context()

def is_admin_or_ops():
    return is_unrestricted_role()

def normalize(role: str):
    return normalize_role(role)
