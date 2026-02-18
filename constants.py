# constants.py

# ✅ Stable slugs (used in DB, sessions, routing, decorators)
# ✅ Human labels (used in UI dropdowns)

DEPARTMENTS = {
    "accountant": "Accountant",
    "bdu": "Business Development Unit (BDU)",
    "doctor": "Doctor",
    "medical_officer": "Medical Officer (Radiology/Sonography/etc)",
    "nurse": "Nurse",
    "customer_care": "Customer Care",
    "laboratory": "Laboratory",
    "inventory": "Inventory",
    "security_support": "Security & Support Staff",
}

# Admin is NOT a department; it's a role/access level
ROLES = ["staff", "admin"]

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def is_valid_department(dept_slug: str) -> bool:
    return (dept_slug or "").strip() in DEPARTMENTS


def department_label(dept_slug: str) -> str:
    """Return display label from slug."""
    return DEPARTMENTS.get((dept_slug or "").strip(), "")


def department_slug_from_label(label: str) -> str | None:
    """Convert dropdown label back to slug (useful if UI sends labels)."""
    label = (label or "").strip()
    for slug, text in DEPARTMENTS.items():
        if text == label:
            return slug
    return None
