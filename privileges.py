# ===========================================================
# privileges.py — Backend Role Privilege Manager (v3.2)
# Doctor unrestricted, Accounts + Diagnostics added
# ===========================================================

def normalize_role(role):
    """Normalize role to database format: lowercase, spaces to underscores."""
    if not role:
        return ""
    return role.lower().replace(" ", "_").replace("-", "_")


def can_access(role, department):
    """Return True if role can access the given department."""
    role_norm = normalize_role(role)
    dept_norm = normalize_role(department)
    unrestricted = ["admin", "operations", "hop", "doctor"]
    if role_norm in unrestricted:
        return True
    return role_norm == dept_norm


def department_accessible_pages(role):
    """Return allowed pages for this role."""
    role_norm = normalize_role(role)
    unrestricted = ["admin", "operations", "hop", "doctor"]
    all_departments = [
        "customer_care", "doctor", "nursing", "laboratory",
        "diagnostics", "inventory", "accounts", "it"
    ]
    if role_norm in unrestricted:
        return all_departments
    return [role_norm]
