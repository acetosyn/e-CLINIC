# ==========================================================
# EPICONSULT e-CLINIC — API BLUEPRINT (api_bp.py)
# All API endpoints: activities, health, cleanup, patients
# ==========================================================
import logging
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from datetime import datetime, date
from db import db_session, log_activity
from utils.decorators import get_user_role, require_unrestricted

api_bp = Blueprint('api_bp', __name__)
logger = logging.getLogger(__name__)

_last_cleanup_date = None


# ----------------------------------------------------------
# HEALTH CHECK
# ----------------------------------------------------------
@api_bp.route('/api/health')
@login_required
def health_check():
    try:
        from models import User
        count = db_session.query(User).count()
        return jsonify({
            'success': True,
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'users_count': count
        })
    except Exception as e:
        logger.error(f"Health error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ----------------------------------------------------------
# GET ACTIVITIES FOR TODAY
# ----------------------------------------------------------
@api_bp.route('/api/activities')
@login_required
def get_activities():
    try:
        from models import Activity
        from sqlalchemy import desc

        today = date.today()
        start = datetime.combine(today, datetime.min.time())

        activities = db_session.query(Activity).filter(
            Activity.created_at >= start
        ).order_by(desc(Activity.created_at)).all()

        return jsonify({
            'success': True,
            'activities': [a.to_dict() for a in activities]
        })
    except Exception as e:
        logger.error(f"Error fetching activities: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ----------------------------------------------------------
# CLEANUP OLD ACTIVITIES
# ----------------------------------------------------------
def cleanup_old_activities():
    try:
        from models import Activity

        today = date.today()
        start = datetime.combine(today, datetime.min.time())

        deleted = db_session.query(Activity).filter(
            Activity.created_at < start
        ).delete()

        db_session.commit()
        return deleted
    except Exception as e:
        db_session.rollback()
        logger.error(f"Cleanup error: {str(e)}")
        return 0


# Automatic cleanup between 6–7 AM
@api_bp.before_app_request
def run_daily_cleanup():
    global _last_cleanup_date
    now = datetime.now()
    today = date.today()

    if 6 <= now.hour < 7 and _last_cleanup_date != today:
        deleted = cleanup_old_activities()
        logger.info(f"Daily cleanup removed {deleted} entries")
        _last_cleanup_date = today


# ----------------------------------------------------------
# MANUAL CLEANUP (ADMIN ONLY)
# ----------------------------------------------------------
@api_bp.route('/api/admin/cleanup-activities', methods=['POST'])
@login_required
@require_unrestricted()
def manual_cleanup():
    try:
        deleted = cleanup_old_activities()
        return jsonify({'success': True, 'message': f'Deleted {deleted} old activities'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ----------------------------------------------------------
# REGISTER NEW PATIENT
# ----------------------------------------------------------
@api_bp.route('/api/patients/register', methods=['POST'])
@login_required
def register_patient():
    import time
    import uuid
    from models import Patient, Referral
    from sqlalchemy.exc import OperationalError
    
    max_retries = 3
    retry_delay = 1.0  # Start with 1 second
    
    for attempt in range(max_retries):
        try:
            data = request.get_json()

            required = ['first_name', 'last_name', 'date_of_birth', 'sex', 'phone']
            for r in required:
                if not data.get(r):
                    return jsonify({'success': False, 'message': f'{r} is required.'}), 400

            # File numbers
            file_no = f"F-{uuid.uuid4().hex[:8].upper()}"
            patient_id = f"EPN-{datetime.now().year}-{uuid.uuid4().hex[:8].upper()}"

            # Referral
            referred_by_id = None
            if data.get('referred_by'):
                referral = db_session.query(Referral).filter(
                    Referral.name == data['referred_by']
                ).first()

                if not referral:
                    referral = Referral(
                        name=data['referred_by'],
                        type="Other",
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    db_session.add(referral)
                    db_session.flush()

                referred_by_id = referral.id

            # DOB
            dob = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()

            # Create patient
            patient = Patient(
                file_no=file_no,
                patient_id=patient_id,
                title=data.get('title'),
                first_name=data['first_name'],
                last_name=data['last_name'],
                date_of_birth=dob,
                age=data.get('age'),
                sex=data['sex'],
                occupation=data.get('occupation'),
                phone=data['phone'],
                email=data.get('email'),
                address=data.get('address'),
                referred_by_id=referred_by_id,
                registered_by=current_user.username,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )

            db_session.add(patient)

            # Log activity
            log_activity(
                department=get_user_role(),
                activity_type='patient_registration',
                description=f"New patient: {data['first_name']} {data['last_name']} ({patient_id})",
                patient_name=f"{data['first_name']} {data['last_name']}",
                patient_id=patient_id,
                performed_by=current_user.username,
                metadata={'file_no': file_no}
            )

            db_session.commit()

            return jsonify({'success': True, 'patient': patient.to_dict()})

        except OperationalError as e:
            error_str = str(e)
            db_session.rollback()
            
            # Check if it's a DNS/connection error
            if 'could not translate host name' in error_str.lower() or 'could not connect' in error_str.lower():
                if attempt < max_retries - 1:
                    logger.warning(f"Database connection error (attempt {attempt + 1}/{max_retries}), retrying in {retry_delay}s: {error_str}")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    # Try to refresh the connection
                    try:
                        db_session.remove()
                    except:
                        pass
                    continue
                else:
                    logger.error(f"Failed to register patient after {max_retries} attempts: {error_str}")
                    return jsonify({
                        'success': False, 
                        'message': 'Database connection error. Please check your internet connection and try again.'
                    }), 500
            else:
                # Other operational errors - don't retry
                logger.error(f"Register patient error: {error_str}", exc_info=True)
                db_session.rollback()
                return jsonify({'success': False, 'message': 'Database error occurred. Please try again.'}), 500
                
        except Exception as e:
            logger.error(f"Register patient error: {str(e)}", exc_info=True)
            db_session.rollback()
            # Check if it's a connection-related error
            error_str = str(e).lower()
            if 'connection' in error_str or 'host' in error_str or 'dns' in error_str:
                return jsonify({
                    'success': False, 
                    'message': 'Unable to connect to database. Please check your internet connection and try again.'
                }), 500
            return jsonify({'success': False, 'message': 'An error occurred while registering the patient. Please try again.'}), 500
    
    # Should not reach here, but just in case
    return jsonify({'success': False, 'message': 'Failed to register patient after multiple attempts. Please try again.'}), 500
