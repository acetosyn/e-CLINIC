# utils/decorators.py

from functools import wraps
from flask import redirect, url_for, render_template
from flask_login import current_user
from privileges import (
    can_access,
    normalize_role,
    is_unrestricted_role,
    department_accessible_pages,
)


def get_user_role():
    if not current_user.is_authenticated:
        return None
    return normalize_role(current_user.role)


def can_access_current_user(department):
    role = get_user_role()
    if not role:
        return False, None
    return can_access(role, department), role


def get_user_context():
    """Used by templates + injectors."""
    if not current_user or not current_user.is_authenticated:
        return None

    role = get_user_role()
    return {
        "username": current_user.username,
        "role": role,
        "role_display": role.replace("_", " ").title(),
        "is_admin": is_unrestricted_role(role),
        "accessible_departments": department_accessible_pages(role),
    }


# -------------------------------------------------------
# DECORATORS
# -------------------------------------------------------

def require_department(department):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for("auth_bp.login"))

            allowed, user_role = can_access_current_user(department)

            if not allowed:
                return render_template(
                    "403.html",
                    message=f"Access restricted — you can only access your {user_role.replace('_',' ').title()} dashboard."
                ), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator


def require_roles(*roles):
    allowed = [normalize_role(r) for r in roles]

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


def require_unrestricted():
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for("auth_bp.login"))

            if not is_unrestricted_role(get_user_role()):
                return render_template(
                    "403.html",
                    message="Access denied — admin privileges required."
                ), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator
