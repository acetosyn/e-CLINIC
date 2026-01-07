# ==========================================================
# Patient Services — patient_services.py
# Supabase-backed patient registration
# ==========================================================

from db import db_session, log_activity
from models import Patient, Referral
from datetime import datetime
import uuid
import os


def _clean_int(value):
    """Convert value to int or None. Handles empty strings and non-numeric values."""
    if value is None or value == '':
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _clean_str(value):
    """Convert empty strings to None."""
    if value is None or (isinstance(value, str) and value.strip() == ''):
        return None
    return value


def _calculate_age(dob):
    """Calculate age from date of birth."""
    if not dob:
        return None
    today = datetime.now().date()
    age = today.year - dob.year
    # Adjust if birthday hasn't occurred yet this year
    if (today.month, today.day) < (dob.month, dob.day):
        age -= 1
    return age if age >= 0 else None



# ==========================================================
# REGISTER NEW PATIENT
# ==========================================================
def register_new_patient(data: dict, current_user):
    """
    Registers a new patient into Supabase-backed Postgres.
    Called by /api/patients (POST)

    Expects:
    {
        title,
        first_name,
        last_name,
        date_of_birth (YYYY-MM-DD),
        age,
        sex,
        phone,
        email,
        address,
        occupation,
        category,
        referred_by,
        services: []   # optional
    }
    """

    # ------------------------------------------------------
    # 1. REQUIRED FIELD VALIDATION
    # ------------------------------------------------------
    required = ["first_name", "last_name", "date_of_birth", "sex", "phone"]
    for field in required:
        if not data.get(field):
            raise ValueError(f"{field.replace('_',' ').title()} is required.")

    # ------------------------------------------------------
    # 2. GENERATE FILE NO & PATIENT ID
    # ------------------------------------------------------
    file_no = f"F-{uuid.uuid4().hex[:8].upper()}"
    patient_id = f"EPN-{datetime.now().year}-{uuid.uuid4().hex[:8].upper()}"

    # ------------------------------------------------------
    # 3. HANDLE REFERRAL (AUTO-CREATE IF NOT EXISTS)
    # ------------------------------------------------------
    referred_by_id = None
    referral_name = data.get("referred_by")

    if referral_name:
        referral = (
            db_session.query(Referral)
            .filter(Referral.name == referral_name)
            .first()
        )

        if not referral:
            referral = Referral(
                name=referral_name,
                type="Other",
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db_session.add(referral)
            db_session.flush()

        referred_by_id = referral.id

    # ------------------------------------------------------
    # 4. PARSE DATE OF BIRTH
    # ------------------------------------------------------
    dob = datetime.strptime(data["date_of_birth"], "%Y-%m-%d").date()

    # ------------------------------------------------------
    # 5. CREATE PATIENT RECORD
    # ------------------------------------------------------
    # Check IS_TEST environment variable (defaults to False)
    is_test_mode = os.getenv("IS_TEST", "false").lower() in ("true", "1", "yes")

    # Calculate age from DOB if not provided
    age = _clean_int(data.get("age"))
    if age is None:
        age = _calculate_age(dob)

    patient = Patient(
        file_no=file_no,
        patient_id=patient_id,
        title=_clean_str(data.get("title")),
        first_name=data["first_name"],
        last_name=data["last_name"],
        date_of_birth=dob,
        age=age,  # Calculated from DOB if not provided
        sex=data["sex"],
        occupation=_clean_str(data.get("occupation")),
        phone=data["phone"],
        email=_clean_str(data.get("email")),
        address=_clean_str(data.get("address")),
        category=_clean_str(data.get("category")),
        referred_by_id=referred_by_id,
        registered_by=current_user.username,
        is_test=is_test_mode,  # From IS_TEST env variable
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    db_session.add(patient)
    db_session.flush()  # ensures patient.id exists

    # ------------------------------------------------------
    # 6. ACTIVITY LOG
    # ------------------------------------------------------
    log_activity(
        department=current_user.role,
        activity_type="patient_registration",
        description=f"New patient registered: {patient.first_name} {patient.last_name}",
        patient_name=f"{patient.first_name} {patient.last_name}",
        patient_id=patient_id,
        performed_by=current_user.username,
        metadata={
            "file_no": file_no,
            "services_count": len(data.get("services", [])),
        },
    )

    # ------------------------------------------------------
    # 7. COMMIT
    # ------------------------------------------------------
    db_session.commit()

    # ------------------------------------------------------
    # 8. STANDARDIZED RESPONSE (IMPORTANT)
    # ------------------------------------------------------
    return {
        "success": True,
        "patient": patient.to_dict(),
        "message": "Patient registered successfully",
    }
