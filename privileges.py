# ===========================================================
# privileges.py — Backend Role Privilege Manager (v3.1)
# Doctor added as unrestricted
# ===========================================================

def can_access(role, department):
    """Return True if role can access the given department."""
    unrestricted = ["admin", "operations", "hop", "doctor"]
    if role.lower() in unrestricted:
        return True
    return role.lower() == department.lower()


def department_accessible_pages(role):
    """Return allowed pages for this role."""
    unrestricted = ["admin", "operations", "hop", "doctor"]
    if role.lower() in unrestricted:
        return [
            "customer care", "doctor", "nursing", "laboratory",
            "diagnostics", "inventory", "accounts", "it"
        ]
    return [role.lower()]


# ===========================================================
# privileges.py — Backend Role Privilege Manager (v3.2)
# Doctor unrestricted, Accounts + Diagnostics added
# ===========================================================

def can_access(role, department):
    """Return True if role can access the given department."""
    unrestricted = ["admin", "operations", "hop", "doctor"]
    if role.lower() in unrestricted:
        return True
    return role.lower() == department.lower()


def department_accessible_pages(role):
    """Return allowed pages for this role."""
    unrestricted = ["admin", "operations", "hop", "doctor"]
    all_departments = [
        "customer care", "doctor", "nursing", "laboratory",
        "diagnostics", "inventory", "accounts", "it"
    ]
    if role.lower() in unrestricted:
        return all_departments
    return [role.lower()]
