# utils/decorators.py

from functools import wraps
from flask import redirect, url_for, render_template
from flask_login import current_user

from privileges import (
    normalize_slug,
    can_access,
    is_admin_role,
    department_accessible_pages,
)

def get_user_role():
    if not current_user.is_authenticated:
        return None
    return normalize_slug(getattr(current_user, "role", ""))

def get_user_department():
    if not current_user.is_authenticated:
        return None
    return normalize_slug(getattr(current_user, "department", ""))

def get_user_context():
    """Used by templates + injectors."""
    if not current_user or not current_user.is_authenticated:
        return None

    role = get_user_role()
    dept = get_user_department()

    return {
        "username": current_user.username,
        "role": role,
        "role_display": role.replace("_", " ").title(),
        "department": dept,
        "department_display": dept.replace("_", " ").title() if dept else "",
        "is_admin": is_admin_role(role),
        "accessible_departments": department_accessible_pages(role, dept),
    }

def require_department(target_department: str):
    """
    Staff can only access their own department.
    Admin can access everything.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for("auth_bp.login"))

            role = get_user_role()
            dept = get_user_department()

            if not can_access(role, dept, target_department):
                return render_template(
                    "403.html",
                    message="Access restricted — you can only access your assigned department."
                ), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator

def require_roles(*roles):
    allowed = [normalize_slug(r) for r in roles]

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for("auth_bp.login"))

            role = get_user_role()
            if role not in allowed:
                return render_template(
                    "403.html",
                    message="Access denied — insufficient privileges."
                ), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator

def require_admin():
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for("auth_bp.login"))

            if not is_admin_role(get_user_role()):
                return render_template(
                    "403.html",
                    message="Access denied — admin privileges required."
                ), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator
