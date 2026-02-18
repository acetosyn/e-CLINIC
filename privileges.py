# privileges.py — Pure privilege logic (no Flask imports)

from constants import DEPARTMENTS

def normalize_slug(value: str) -> str:
    """
    Normalize into a stable slug-like string.
    """
    if not value:
        return ""
    return (
        value.strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
    )

def is_admin_role(role: str) -> bool:
    return normalize_slug(role) == "admin"

def can_access(user_role: str, user_department: str, target_department: str) -> bool:
    """
    Access rules:
    - admin => access everything
    - staff => only their department
    """
    if is_admin_role(user_role):
        return True

    return normalize_slug(user_department) == normalize_slug(target_department)

def department_accessible_pages(user_role: str, user_department: str):
    """
    Used by templates to show department navigation options.
    Admin sees all departments; staff sees only their own.
    """
    user_role = normalize_slug(user_role)
    user_department = normalize_slug(user_department)

    # Define frontend navigation + route endpoints (Flask endpoints)
    pages = {
        "accountant": {
            "slug": "accountant",
            "name": DEPARTMENTS["accountant"],
            "route": "departments_bp.accountant",
        },
        "bdu": {
            "slug": "bdu",
            "name": DEPARTMENTS["bdu"],
            "route": "departments_bp.bdu",
        },
        "doctor": {
            "slug": "doctor",
            "name": DEPARTMENTS["doctor"],
            "route": "departments_bp.doctor",
        },
        "medical_officer": {
            "slug": "medical_officer",
            "name": DEPARTMENTS["medical_officer"],
            "route": "departments_bp.medical_officer",
        },
        "nurse": {
            "slug": "nurse",
            "name": DEPARTMENTS["nurse"],
            "route": "departments_bp.nurse",
        },
        "reception": {
            "slug": "reception",
            "name": DEPARTMENTS["reception"],
            "route": "departments_bp.reception",
        },
        "laboratory": {
            "slug": "laboratory",
            "name": DEPARTMENTS["laboratory"],
            "route": "departments_bp.laboratory",
        },
        "inventory": {
            "slug": "inventory",
            "name": DEPARTMENTS["inventory"],
            "route": "departments_bp.inventory",
        },
        "security_support": {
            "slug": "security_support",
            "name": DEPARTMENTS["security_support"],
            "route": "departments_bp.security_support",
        },
    }

    if is_admin_role(user_role):
        return list(pages.values())

    if user_department in pages:
        return [pages[user_department]]

    return []

def department_to_route(dept_slug: str) -> str:
    """
    Dept slug -> Flask endpoint used for redirect after login.
    """
    dept_slug = normalize_slug(dept_slug)

    mapping = {
        "accountant": "departments_bp.accountant",
        "bdu": "departments_bp.bdu",
        "doctor": "departments_bp.doctor",
        "medical_officer": "departments_bp.medical_officer",
        "nurse": "departments_bp.nurse",
        "reception": "departments_bp.reception",
        "laboratory": "departments_bp.laboratory",
        "inventory": "departments_bp.inventory",
        "security_support": "departments_bp.security_support",
    }

    # fallback (staff without dept) -> dashboard
    return mapping.get(dept_slug, "main_bp.dashboard")
