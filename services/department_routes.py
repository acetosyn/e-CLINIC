# ==========================================================
# Department Route Mapper — department_routes.py
# ==========================================================

from privileges import normalize_role

def get_department_route(role: str) -> str:
    """Return Flask route function for each department."""

    role = normalize_role(role)

    mapping = {
        "customer_care": "customer_care",
        "doctor": "doctor",
        "nursing": "nursing",
        "laboratory": "laboratory",
        "diagnostics": "diagnostics",
        "inventory": "inventory",
        "accounts": "accounts",
        "it": "it",
        "operations": "dashboard",
        "hop": "dashboard",
        "admin": "dashboard",
    }

    return mapping.get(role, "dashboard")
