# ==========================================================
# Patient Services — patient_services.py
# ==========================================================

from db import db_session, log_activity
from models import Patient, Referral
from datetime import datetime
import uuid

# Register a new patient
def register_new_patient(data: dict, current_user):
    required = ["first_name", "last_name", "date_of_birth", "sex", "phone"]
    for field in required:
        if not data.get(field):
            raise ValueError(f"{field.replace('_',' ').title()} is required.")

    # File number + Patient ID
    file_no = f"F-{str(uuid.uuid4())[:8].upper()}"
    patient_id = f"EPN-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}"

    # Referral
    referred_by_id = None
    if data.get("referred_by"):
        referral = (
            db_session.query(Referral)
            .filter(Referral.name == data["referred_by"])
            .first()
        )
        if not referral:
            referral = Referral(
                name=data["referred_by"],
                type="Other",
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db_session.add(referral)
            db_session.flush()
        referred_by_id = referral.id

    # Parse date
    dob = datetime.strptime(data["date_of_birth"], "%Y-%m-%d").date()

    # Create patient
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
        referred_by_id=referred_by_id,
        registered_by=current_user.username,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    db_session.add(patient)

    # Activity log
    log_activity(
        department=current_user.role,
        activity_type="patient_registration",
        description=f"New patient registered: {patient.first_name} {patient.last_name} ({patient_id})",
        patient_name=f"{patient.first_name} {patient.last_name}",
        patient_id=patient_id,
        performed_by=current_user.username,
        metadata={"file_no": file_no},
    )

    db_session.commit()

    return patient.to_dict()
