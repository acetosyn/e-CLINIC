# ==========================================================
# EPICONSULT e-CLINIC — DEPARTMENTS BLUEPRINT (departments_bp.py)
# Department dashboards with privilege restrictions
# ==========================================================
import logging
from flask import Blueprint, render_template, redirect, url_for, session
from flask_login import login_required
from utils.decorators import require_department, get_user_context
from privileges import normalize_role

departments_bp = Blueprint('departments_bp', __name__)
logger = logging.getLogger(__name__)

# ----------------------------------------------------------
# HELPER: SAFE RENDER FUNCTION
# ----------------------------------------------------------
def render_dept_page(template_name, dept_slug, title=None):
    """
    Safely render a department page and set current department.
    Prevents UI scattering by enforcing session['department'].
    """
    try:
        # FIX: Always set correct active department
        session['department'] = dept_slug

        # Context from user_services / decorators
        ctx = get_user_context()

        return render_template(
            template_name,
            user=ctx.get("username"),
            role=ctx.get("role_display"),
            title=title
        )
    except Exception as e:
        logger.error(f"Error loading {dept_slug}: {str(e)}")
        return "Error loading page", 500


# ==========================================================
# CUSTOMER CARE
# templates/customer_care.html   (NOT in /departments)
# ==========================================================
@departments_bp.route('/customer-care')
@login_required
@require_department('customer_care')
def customer_care():
    return render_dept_page(
        "customer_care.html",      # FIXED: correct location
        "customer_care",
        "Customer Care — e-Clinic"
    )


# ==========================================================
# DOCTOR
# templates/doctor.html
# ==========================================================
@departments_bp.route('/doctor')
@login_required
@require_department('doctor')
def doctor():
    return render_dept_page(
        "doctor.html",
        "doctor",
        "Doctor — e-Clinic"
    )


# ==========================================================
# NURSING
# templates/nursing.html
# ==========================================================
@departments_bp.route('/nursing')
@login_required
@require_department('nursing')
def nursing():
    return render_dept_page(
        "nursing.html",
        "nursing",
        "Nursing — e-Clinic"
    )


# ==========================================================
# LABORATORY
# templates/laboratory.html
# ==========================================================
@departments_bp.route('/laboratory')
@login_required
@require_department('laboratory')
def laboratory():
    return render_dept_page(
        "laboratory.html",
        "laboratory",
        "Laboratory — e-Clinic"
    )


# ==========================================================
# DIAGNOSTICS
# templates/diagnostics.html
# ==========================================================
@departments_bp.route('/diagnostics')
@login_required
@require_department('diagnostics')
def diagnostics():
    return render_dept_page(
        "diagnostics.html",
        "diagnostics",
        "Diagnostics — e-Clinic"
    )


# ==========================================================
# INVENTORY
# templates/inventory.html
# ==========================================================
@departments_bp.route('/inventory')
@login_required
@require_department('inventory')
def inventory():
    return render_dept_page(
        "inventory.html",
        "inventory",
        "Inventory — e-Clinic"
    )


# ==========================================================
# ACCOUNTS
# templates/accounts.html
# ==========================================================
@departments_bp.route('/accounts')
@login_required
@require_department('accounts')
def accounts():
    return render_dept_page(
        "accounts.html",
        "accounts",
        "Accounts — e-Clinic"
    )


# ==========================================================
# IT
# templates/it.html
# ==========================================================
@departments_bp.route('/it')
@login_required
@require_department('it')
def it():
    return render_dept_page(
        "it.html",
        "it",
        "IT Support — e-Clinic"
    )


# ==========================================================
# OPERATIONS  (Admin / Ops unrestricted roles)
# templates/operations.html
# ==========================================================
@departments_bp.route('/operations')
@login_required
@require_department('operations')
def operations():
    return render_dept_page(
        "operations.html",
        "operations",
        "Operations — e-Clinic"
    )
