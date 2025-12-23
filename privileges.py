# privileges.py — Pure privilege logic (no Flask imports)

# ---------------------------------------------------------
# NORMALIZER
# ---------------------------------------------------------
def normalize_role(role):
    """
    Convert any role string into a canonical slug.
    Example:
    "Customer Care" -> "customer_care"
    "HOP" -> "hop"
    """
    if not role:
        return ""
    return role.lower().strip().replace(" ", "_").replace("-", "_")


# ---------------------------------------------------------
# UNRESTRICTED ROLE LOGIC
# ---------------------------------------------------------
def is_unrestricted_role(role):
    """
    Admin, Operations, HOP, and Doctor have full unrestricted access.
    These users can access ALL departments and dashboards.
    """
    if not role:
        return False

    role = normalize_role(role)
    return role in ["admin", "operations", "hop", "doctor"]


# ---------------------------------------------------------
# PER-DEPARTMENT ACCESS CHECK
# ---------------------------------------------------------
def can_access(role, department):
    """
    Used by require_department():
    - unrestricted roles → always allowed
    - everyone else → only own department
    """
    role = normalize_role(role)
    department = normalize_role(department)

    if is_unrestricted_role(role):
        return True

    return role == department


# ---------------------------------------------------------
# DEPARTMENT PAGE MAPPING (BACKEND MASTER LIST)
# ---------------------------------------------------------
def department_accessible_pages(role):
    """
    Return department configs for header rendering.
    Unrestricted roles get ALL departments.
    Normal users get ONLY their department.
    """

    role = normalize_role(role)

    departments = {
        "customer_care": {
            "slug": "customer_care",
            "name": "Customer Care",
            "icon": "fa-headset",
            "route": "departments_bp.customer_care"
        },
        "doctor": {
            "slug": "doctor",
            "name": "Doctor",
            "icon": "fa-stethoscope",
            "route": "departments_bp.doctor"
        },
        "nursing": {
            "slug": "nursing",
            "name": "Nursing",
            "icon": "fa-user-nurse",
            "route": "departments_bp.nursing"
        },
        "pharmacy": {
            "slug": "nursing",   # Pharmacy comes under Nursing
            "name": "Pharmacy",
            "icon": "fa-pills",
            "route": "departments_bp.nursing"
        },
        "laboratory": {
            "slug": "laboratory",
            "name": "Laboratory",
            "icon": "fa-flask",
            "route": "departments_bp.laboratory"
        },
        "diagnostics": {
            "slug": "diagnostics",
            "name": "Diagnostics",
            "icon": "fa-x-ray",
            "route": "departments_bp.diagnostics"
        },
        "inventory": {
            "slug": "inventory",
            "name": "Inventory",
            "icon": "fa-boxes",
            "route": "departments_bp.inventory"
        },
        "accounts": {
            "slug": "accounts",
            "name": "Accounts",
            "icon": "fa-file-invoice-dollar",
            "route": "departments_bp.accounts"
        },
        "it": {
            "slug": "it",
            "name": "IT Support",
            "icon": "fa-computer",
            "route": "departments_bp.it"
        },
        "staff": {
            "slug": "customer_care",   # fallback group
            "name": "Staff",
            "icon": "fa-user",
            "route": "departments_bp.customer_care"
        }
    }

    # unrestricted roles → all departments
    if is_unrestricted_role(role):
        return list(departments.values())

    # normal user → only their own
    dept = departments.get(role)
    if not dept:
        return []

    return [dept]
