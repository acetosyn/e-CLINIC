# ==========================================================
# Patient Records Logic — records.py
# ==========================================================

from db import db_session
from models import Patient
from sqlalchemy import or_, func

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
# CLEANER UTILITY — converts Patient model to dict
# ==========================================================
def clean_patient_record(patient) -> dict:
    """Convert Patient model to dictionary with only wanted fields."""
    if not patient:
        return {}
    
    # Handle both dict and model objects
    if isinstance(patient, dict):
        clean = {}
        for field in PATIENT_FIELDS:
            value = patient.get(field)
            if value not in [None, "", " "]:
                clean[field] = value
        return clean
    else:
        # It's a Patient model instance
        return {
            'id': patient.id,
            'file_no': patient.file_no,
            'patient_id': patient.patient_id,
            'title': patient.title,
            'first_name': patient.first_name,
            'last_name': patient.last_name,
            'date_of_birth': patient.date_of_birth.isoformat() if patient.date_of_birth else None,
            'age': patient.age,
            'sex': patient.sex,
            'phone': patient.phone,
            'email': patient.email,
            'address': patient.address,
        }


# ==========================================================
# SEARCH PATIENTS — live search using SQLAlchemy
# ==========================================================
def search_patients(query: str):
    """Search by first_name, last_name, file_no, patient_id, email."""
    if not query or not query.strip():
        return []

    if not db_session:
        return []

    q = f"%{query.strip()}%"

    try:
        patients = db_session.query(Patient).filter(
            or_(
                func.lower(Patient.first_name).like(func.lower(q)),
                func.lower(Patient.last_name).like(func.lower(q)),
                func.lower(Patient.file_no).like(func.lower(q)),
                func.lower(Patient.patient_id).like(func.lower(q)),
                func.lower(Patient.email).like(func.lower(q))
            )
        ).order_by(Patient.id).limit(50).all()

        return [clean_patient_record(p) for p in patients]
    except Exception as e:
        print(f"Search error: {e}")
        return []


# ==========================================================
# FETCH ALL PATIENTS (for full table load)
# ==========================================================
def fetch_all_patients():
    if not db_session:
        return []

    try:
        patients = db_session.query(Patient).order_by(Patient.id).all()
        return [clean_patient_record(p) for p in patients]
    except Exception as e:
        print(f"Fetch all error: {e}")
        return []


# ==========================================================
# FETCH SINGLE PATIENT — used when clicking a table row
# ==========================================================
def fetch_single_patient(identifier: str):
    """
    Fetch one patient using:
    - file_no
    - patient_id
    """
    if not db_session:
        return {}

    try:
        patient = db_session.query(Patient).filter(
            or_(
                Patient.patient_id == identifier,
                Patient.file_no == identifier
            )
        ).first()

        return clean_patient_record(patient) if patient else {}
    except Exception as e:
        print(f"Fetch single error: {e}")
        return {}


# ==========================================================
# FETCH SERVICES (from services table)
# ==========================================================
def fetch_services():
    # If you have a Service model, use it here
    # For now, return empty list or implement if needed
    try:
        from supabase_client import supabase
        response = (
            supabase.table("services")
            .select("*")
            .order("category")
            .execute()
        )
        return response.data or []
    except:
        return []
