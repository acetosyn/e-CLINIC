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
from services.patient_services import register_new_patient


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
# REGISTER NEW PATIENT (NEW STANDARD ENDPOINT)
# Used by patients.html (patients.js)
# POST /api/patients
# ----------------------------------------------------------
@api_bp.route('/api/patients', methods=['POST'])
@login_required
def create_patient():
    try:
        data = request.get_json() or {}

        result = register_new_patient(data, current_user)
        return jsonify(result), 201

    except ValueError as e:
        # Validation errors from patient_services.py
        return jsonify({'success': False, 'message': str(e)}), 400

    except Exception as e:
        logger.error(f"Create patient error: {str(e)}", exc_info=True)
        db_session.rollback()
        return jsonify({
            'success': False,
            'message': 'An error occurred while registering the patient. Please try again.'
        }), 500


# ----------------------------------------------------------
# REGISTER NEW PATIENT (LEGACY ENDPOINT)
# Old modal JS may still call this:
# POST /api/patients/register
# Kept for backward compatibility BUT no duplicate logic.
# ----------------------------------------------------------
@api_bp.route('/api/patients/register', methods=['POST'])
@login_required
def register_patient():
    try:
        data = request.get_json() or {}

        result = register_new_patient(data, current_user)
        return jsonify(result), 201

    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400

    except Exception as e:
        logger.error(f"Register patient error: {str(e)}", exc_info=True)
        db_session.rollback()
        return jsonify({
            'success': False,
            'message': 'An error occurred while registering the patient. Please try again.'
        }), 500
