# constants.py
"""
Stable slugs (used in DB, sessions, routing, decorators)
Human labels (used in UI dropdowns)

IMPORTANT:
- "reception" and "customer_care" are the SAME department.
- Canonical slug = "reception" (because your route is /departments/reception).
- "customer_care" is treated as an alias that resolves to "reception".
"""

# Canonical departments
DEPARTMENTS = {
    "accountant": "Accountant",
    "bdu": "Business Development Unit (BDU)",
    "doctor": "Doctor",
    "medical_officer": "Medical Officer (Radiology/Sonography/etc)",
    "nurse": "Nurse",

    # ✅ Canonical key that your code already expects (privileges + departments_bp)
    "reception": "Customer Care / Reception",

    "laboratory": "Laboratory",
    "inventory": "Inventory",
    "security_support": "Security & Support Staff",
}

# Aliases that should resolve to canonical slugs
DEPARTMENT_ALIASES = {
    # customer care == reception
    "customer_care": "reception",
    "customer-care": "reception",
    "customercare": "reception",
    "frontdesk": "reception",
    "front_desk": "reception",
}

# Admin is NOT a department; it's a role/access level
ROLES = ["staff", "admin"]

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def normalize_slug(value: str) -> str:
    """Normalize into a stable slug-like string."""
    if not value:
        return ""
    return (
        value.strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
    )

def canonical_department(dept_slug: str) -> str:
    """
    Convert any dept slug (including aliases) to canonical slug.
    Example: customer_care -> reception
    """
    slug = normalize_slug(dept_slug)
    return DEPARTMENT_ALIASES.get(slug, slug)

def is_valid_department(dept_slug: str) -> bool:
    """Valid if canonical slug exists in DEPARTMENTS."""
    return canonical_department(dept_slug) in DEPARTMENTS

def department_label(dept_slug: str) -> str:
    """Return display label from slug (works with aliases)."""
    return DEPARTMENTS.get(canonical_department(dept_slug), "")

def department_slug_from_label(label: str) -> str | None:
    """Convert dropdown label back to canonical slug."""
    label = (label or "").strip()
    for slug, text in DEPARTMENTS.items():
        if text == label:
            return slug
    return None