# services/user_services.py (clean minimal)
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import verify_user as db_verify_user, get_user_by_id
from privileges import normalize_slug, is_admin_role
from utils.decorators import get_user_role, get_user_context

def authenticate_user(username: str, password: str):
    return db_verify_user(username, password)

def load_user_from_session(user_id):
    return get_user_by_id(int(user_id))

def get_role():
    return get_user_role()

def get_context():
    return get_user_context()

def is_admin(user):
    return is_admin_role(normalize_slug(getattr(user, "role", "")))
