# privileges.py — Pure privilege logic (no Flask imports)

from constants import DEPARTMENTS, canonical_department, normalize_slug

def is_admin_role(role: str) -> bool:
    return normalize_slug(role) == "admin"


def is_unrestricted_role(role: str) -> bool:
    """
    Roles that can access all departments in the UI.
    For now, only admin is unrestricted.
    """
    return is_admin_role(role)


def dept_label(slug: str) -> str:
    """Safe label lookup for UI rendering."""
    slug = canonical_department(slug)
    return DEPARTMENTS.get(slug, slug.replace("_", " ").title())

def can_access(user_role: str, user_department: str, target_department: str) -> bool:
    """
    Access rules:
    - admin => access everything
    - staff => only their department
    - reception/customer_care are treated as the same canonical department
    """
    if is_admin_role(user_role):
        return True

    user_dept = canonical_department(user_department)
    target_dept = canonical_department(target_department)
    return user_dept == target_dept

def department_accessible_pages(user_role: str, user_department: str):
    """
    Used by templates to show department navigation options.
    Admin sees all departments; staff sees only their own.
    """
    user_role = normalize_slug(user_role)
    user_department = canonical_department(user_department)

    # Define frontend navigation + route endpoints (Flask endpoints)
    pages = {
        "accountant": {
            "slug": "accountant",
            "name": dept_label("accountant"),
            "route": "departments_bp.accountant",
        },
        "bdu": {
            "slug": "bdu",
            "name": dept_label("bdu"),
            "route": "departments_bp.bdu",
        },
        "doctor": {
            "slug": "doctor",
            "name": dept_label("doctor"),
            "route": "departments_bp.doctor",
        },
        "medical_officer": {
            "slug": "medical_officer",
            "name": dept_label("medical_officer"),
            "route": "departments_bp.medical_officer",
        },
        "nurse": {
            "slug": "nurse",
            "name": dept_label("nurse"),
            "route": "departments_bp.nurse",
        },

        # ✅ canonical reception page (covers customer_care alias too)
        "reception": {
            "slug": "reception",
            "name": dept_label("reception"),
            "route": "departments_bp.reception",
        },

        "laboratory": {
            "slug": "laboratory",
            "name": dept_label("laboratory"),
            "route": "departments_bp.laboratory",
        },
        "inventory": {
            "slug": "inventory",
            "name": dept_label("inventory"),
            "route": "departments_bp.inventory",
        },
        "security_support": {
            "slug": "security_support",
            "name": dept_label("security_support"),
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
    reception and customer_care both redirect to SAME endpoint.
    """
    dept_slug = canonical_department(dept_slug)

    mapping = {
        "accountant": "departments_bp.accountant",
        "bdu": "departments_bp.bdu",
        "doctor": "departments_bp.doctor",
        "medical_officer": "departments_bp.medical_officer",
        "nurse": "departments_bp.nurse",

        # ✅ customer_care -> reception by canonical_department()
        "reception": "departments_bp.reception",

        "laboratory": "departments_bp.laboratory",
        "inventory": "departments_bp.inventory",
        "security_support": "departments_bp.security_support",
    }

    # fallback (staff without dept) -> dashboard
    return mapping.get(dept_slug, "main_bp.dashboard")