# ==========================================================
# EPICONSULT e-CLINIC — DEPARTMENTS BLUEPRINT (departments_bp.py)
# Department dashboards with privilege restrictions
# ==========================================================
import logging
from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user
from utils.decorators import require_department, get_user_context


departments_bp = Blueprint('departments_bp', __name__)
logger = logging.getLogger(__name__)


# ----------------------------------------------------------
# CUSTOMER CARE
# ----------------------------------------------------------
@departments_bp.route('/customer-care')
@login_required
@require_department('customer_care')
def customer_care():
    try:
        ctx = get_user_context()
        return render_template(
            'customer_care.html',
            user=ctx['username'],
            role=ctx['role_display'],
            title="Customer Care — e-Clinic"
        )
    except Exception as e:
        logger.error(f"Error loading customer care: {str(e)}")
        return "Error loading page", 500


# ----------------------------------------------------------
# DOCTOR
# ----------------------------------------------------------
@departments_bp.route('/doctor')
@login_required
@require_department('doctor')
def doctor():
    try:
        ctx = get_user_context()
        return render_template(
            'doctor.html',
            user=ctx['username'],
            role=ctx['role_display']
        )
    except Exception as e:
        logger.error(f"Error loading doctor: {str(e)}")
        return redirect(url_for('auth_bp.login'))


# ----------------------------------------------------------
# NURSING
# ----------------------------------------------------------
@departments_bp.route('/nursing')
@login_required
@require_department('nursing')
def nursing():
    try:
        return render_template('nursing.html')
    except Exception as e:
        logger.error(f"Error loading nursing: {str(e)}")
        return redirect(url_for('auth_bp.login'))


# ----------------------------------------------------------
# LABORATORY
# ----------------------------------------------------------
@departments_bp.route('/laboratory')
@login_required
@require_department('laboratory')
def laboratory():
    try:
        return render_template('laboratory.html')
    except Exception as e:
        logger.error(f"Error loading laboratory: {str(e)}")
        return redirect(url_for('auth_bp.login'))


# ----------------------------------------------------------
# DIAGNOSTICS
# ----------------------------------------------------------
@departments_bp.route('/diagnostics')
@login_required
@require_department('diagnostics')
def diagnostics():
    try:
        return render_template('diagnostics.html')
    except Exception as e:
        logger.error(f"Error loading diagnostics: {str(e)}")
        return redirect(url_for('auth_bp.login'))


# ----------------------------------------------------------
# INVENTORY
# ----------------------------------------------------------
@departments_bp.route('/inventory')
@login_required
@require_department('inventory')
def inventory():
    try:
        return render_template('inventory.html')
    except Exception as e:
        logger.error(f"Error loading inventory: {str(e)}")
        return redirect(url_for('auth_bp.login'))


# ----------------------------------------------------------
# ACCOUNTS
# ----------------------------------------------------------
@departments_bp.route('/accounts')
@login_required
@require_department('accounts')
def accounts():
    try:
        return render_template('accounts.html')
    except Exception as e:
        logger.error(f"Error loading accounts: {str(e)}")
        return redirect(url_for('auth_bp.login'))


# ----------------------------------------------------------
# IT DEPARTMENT
# ----------------------------------------------------------
@departments_bp.route('/it')
@login_required
@require_department('it')
def it():
    try:
        return render_template('it.html')
    except Exception as e:
        logger.error(f"Error loading IT: {str(e)}")
        return redirect(url_for('auth_bp.login'))


# ----------------------------------------------------------
# OPERATIONS (UNRESTRICTED)
# ----------------------------------------------------------
@departments_bp.route('/operations')
@login_required
@require_department('operations')
def operations():
    try:
        return render_template('operations.html')
    except Exception as e:
        logger.error(f"Error loading operations: {str(e)}")
        return redirect(url_for('auth_bp.login'))
