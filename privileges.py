# ===========================================================
# privileges.py — Centralized Role & Privilege Manager (v4.0)
# Centralized functions for role checks, access control, and decorators
# ===========================================================
from functools import wraps
from flask import redirect, url_for, render_template
from flask_login import current_user


# ===========================================================
# CORE UTILITY FUNCTIONS
# ===========================================================

def normalize_role(role):
    """
    Normalize role to database format: lowercase, spaces to underscores.
    Centralized function - use this everywhere instead of duplicating.
    """
    if not role:
        return ""
    return role.lower().replace(" ", "_").replace("-", "_")


def get_user_role():
    """
    Get current user's normalized role.
    Returns None if user is not authenticated.
    """
    if not current_user or not current_user.is_authenticated:
        return None
    return normalize_role(current_user.role)


def is_unrestricted_role(role=None):
    """
    Check if a role has unrestricted access (admin, operations, etc.).
    If role is None, uses current_user's role.
    """
    if role is None:
        role = get_user_role()
        if role is None:
            return False
    
    role_norm = normalize_role(role)
    unrestricted = ["admin", "operations", "hop"]
    return role_norm in unrestricted


def can_access(role, department):
    """
    Return True if role can access the given department.
    Only Admins, Operations, and HOP (Head of Operations) have unrestricted access.
    All other roles (including Doctors) can only access their own department.
    """
    role_norm = normalize_role(role)
    dept_norm = normalize_role(department)
    
    # Unrestricted roles can access everything
    if is_unrestricted_role(role_norm):
        return True
    
    # Otherwise, role must match department
    return role_norm == dept_norm


def can_access_current_user(department):
    """
    Check if current user can access a department.
    Returns (has_access: bool, user_role: str or None)
    """
    user_role = get_user_role()
    if user_role is None:
        return False, None
    return can_access(user_role, department), user_role


def department_accessible_pages(role):
    """
    Return list of department pages accessible to this role.
    """
    role_norm = normalize_role(role)
    all_departments = [
        "customer_care", "doctor", "nursing", "laboratory",
        "diagnostics", "inventory", "accounts", "it"
    ]
    
    if is_unrestricted_role(role_norm):
        return all_departments
    return [role_norm]


def get_user_context():
    """
    Get standardized user context for templates.
    Returns dict with user info, role, and privileges.
    """
    if not current_user or not current_user.is_authenticated:
        return None
    
    role = get_user_role()
    return {
        "username": current_user.username,
        "role": role,
        "role_display": role.replace("_", " ").title() if role else "Guest",
        "is_admin": is_unrestricted_role(role),
        "accessible_departments": department_accessible_pages(role) if role else []
    }


# ===========================================================
# DECORATORS FOR ROUTE PROTECTION
# ===========================================================

def require_department(department, redirect_to='dashboard'):
    """
    Decorator to restrict route access to specific department.
    Only Admins, Operations, and HOP (Head of Operations) bypass this restriction.
    All other roles (including Doctors) can only access their own department.
    
    Usage:
        @app.route('/customer-care')
        @login_required
        @require_department('customer_care')
        def customer_care():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Check authentication (should be used with @login_required)
            if not current_user or not current_user.is_authenticated:
                return redirect(url_for('login'))
            
            # Check access
            has_access, user_role = can_access_current_user(department)
            
            if not has_access:
                return render_template(
                    "403.html",
                    message=f"Access restricted — you can only access your {user_role.replace('_', ' ').title()} dashboard."
                ), 403
            
            # User has access, proceed with route
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_roles(*allowed_roles, redirect_to='dashboard'):
    """
    Decorator to restrict route access to specific roles.
    
    Usage:
        @app.route('/admin-only')
        @login_required
        @require_roles('admin', 'head_of_operations')
        def admin_page():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Check authentication
            if not current_user or not current_user.is_authenticated:
                return redirect(url_for('login'))
            
            user_role = get_user_role()
            if user_role is None:
                return redirect(url_for('login'))
            
            # Normalize allowed roles
            normalized_allowed = [normalize_role(role) for role in allowed_roles]
            
            # Check if user role is in allowed list
            if user_role not in normalized_allowed:
                return render_template(
                    "403.html",
                    message="Access denied — insufficient privileges."
                ), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_unrestricted(redirect_to='dashboard'):
    """
    Decorator to restrict route to unrestricted roles only (admin, operations, etc.).
    
    Usage:
        @app.route('/admin-panel')
        @login_required
        @require_unrestricted()
        def admin_panel():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Check authentication
            if not current_user or not current_user.is_authenticated:
                return redirect(url_for('login'))
            
            user_role = get_user_role()
            if not is_unrestricted_role(user_role):
                return render_template(
                    "403.html",
                    message="Access denied — admin privileges required."
                ), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator
