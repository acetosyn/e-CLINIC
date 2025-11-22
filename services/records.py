# ==========================================================
# Patient Records Logic — records.py
# ==========================================================

from supabase_client import supabase

# FIELDS WE WANT TO RETURN
PATIENT_FIELDS = [
    "id",
    "file_no",
    "patient_id",
    "title",
    "first_name",
    "last_name",
    "date_of_birth",
    "age",
    "sex",
    "phone",
    "email",
    "address",
]

# ==========================================================
# CLEANER UTILITY — removes null/empty fields
# ==========================================================
def clean_patient_record(row: dict) -> dict:
    """Return only wanted fields and ignore null/empty ones."""
    if not row:
        return {}

    clean = {}

    for field in PATIENT_FIELDS:
        value = row.get(field)

        # Skip null, empty string, None
        if value not in [None, "", " "]:
            clean[field] = value

    return clean


# ==========================================================
# SEARCH PATIENTS — live search
# ==========================================================
def search_patients(query: str):
    """Search by first_name, last_name, file_no, patient_id."""
    if not query or not query.strip():
        return []

    q = query.strip()

    response = (
        supabase.table("patients")
        .select("*")
        .or_(
            f"first_name.ilike.%{q}%,"
            f"last_name.ilike.%{q}%,"
            f"file_no.ilike.%{q}%,"
            f"patient_id.ilike.%{q}%"
        )
        .order("id")
        .limit(50)
        .execute()
    )

    cleaned = [clean_patient_record(r) for r in (response.data or [])]
    return cleaned


# ==========================================================
# FETCH ALL PATIENTS (for full table load)
# ==========================================================
def fetch_all_patients():
    response = (
        supabase.table("patients")
        .select("*")
        .order("id")
        .execute()
    )

    cleaned = [clean_patient_record(r) for r in (response.data or [])]
    return cleaned


# ==========================================================
# FETCH SINGLE PATIENT — used when clicking a table row
# ==========================================================
def fetch_single_patient(identifier: str):
    """
    Fetch one patient using:
    - file_no
    - patient_id
    """
    response = (
        supabase.table("patients")
        .select("*")
        .or_(
            f"patient_id.eq.{identifier},"
            f"file_no.eq.{identifier}"
        )
        .single()
        .execute()
    )

    return clean_patient_record(response.data or {})


# ==========================================================
# FETCH SERVICES (SUPABASE services table)
# ==========================================================
def fetch_services():
    response = (
        supabase.table("services")
        .select("*")
        .order("category")
        .execute()
    )
    return response.data or []
