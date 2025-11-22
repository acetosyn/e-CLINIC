# privileges.py — Pure privilege logic (no Flask imports)

def normalize_role(role):
    if not role:
        return ""
    return role.lower().replace(" ", "_").replace("-", "_")


def is_unrestricted_role(role):
    if not role:
        return False
    role = normalize_role(role)
    return role in ["admin", "operations", "hop"]


def can_access(role, department):
    role = normalize_role(role)
    department = normalize_role(department)

    if is_unrestricted_role(role):
        return True

    return role == department


def department_accessible_pages(role):
    role = normalize_role(role)
    all_departments = [
        "customer_care", "doctor", "nursing", "laboratory",
        "diagnostics", "inventory", "accounts", "it"
    ]
    if is_unrestricted_role(role):
        return all_departments
    return [role]
