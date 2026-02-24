# ==========================================================
# Patient Services — patient_services.py
# Supabase-backed patient registration
# ==========================================================

from db import db_session, log_activity
from models import Patient, Referral
from datetime import datetime
import uuid



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
    patient = Patient(
        file_no=file_no,
        patient_id=patient_id,
        title=data.get("title"),
        first_name=data["first_name"],
        last_name=data["last_name"],
        date_of_birth=dob,
        age=data.get("age"),
        sex=data["sex"],
        occupation=data.get("occupation"),
        phone=data["phone"],
        email=data.get("email"),
        address=data.get("address"),
        category=data.get("category"),
        referred_by_id=referred_by_id,
        registered_by=current_user.username,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    db_session.add(patient)
    db_session.flush()  # ensures patient.id exists

    # ------------------------------------------------------
    # 6. ACTIVITY LOG
    # ------------------------------------------------------
    log_activity(
        department=getattr(current_user, "department", None) or "unknown",
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
