# ==========================================================
# EPICONSULT e-CLINIC — MAIN BLUEPRINT (main_bp.py)
# Home Redirect + General Pages
# ==========================================================
import logging
from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user
from utils.decorators import get_user_role, get_user_context
from privileges import normalize_role


main_bp = Blueprint('main_bp', __name__)
logger = logging.getLogger(__name__)


# ----------------------------------------------------------
# MAP USER ROLE → DEPARTMENT LANDING PAGE
# ----------------------------------------------------------
def get_department_route(role):
    role_norm = normalize_role(role)

    role_map = {
        'customer_care': 'departments_bp.customer_care',
        'doctor': 'departments_bp.doctor',
        'nursing': 'departments_bp.nursing',
        'laboratory': 'departments_bp.laboratory',
        'diagnostics': 'departments_bp.diagnostics',
        'inventory': 'departments_bp.inventory',
        'accounts': 'departments_bp.accounts',
        'it': 'departments_bp.it',
        'operations': 'main_bp.dashboard',
        'hop': 'main_bp.dashboard',
        'admin': 'main_bp.dashboard'
    }

    return role_map.get(role_norm, 'main_bp.dashboard')


# ----------------------------------------------------------
# HOME → redirect to department dashboard
# ----------------------------------------------------------
@main_bp.route('/home')
@login_required
def home():
    try:
        role = get_user_role()
        if not role:
            return redirect(url_for('auth_bp.login'))

        route = get_department_route(role)
        return redirect(url_for(route))
    except Exception as e:
        logger.error(f"Home redirection error: {str(e)}", exc_info=True)
        return redirect(url_for('auth_bp.login'))


# ----------------------------------------------------------
# GENERAL STATIC PAGES
# ----------------------------------------------------------
@main_bp.route('/about')
@login_required
def about():
    return render_template('about.html')


@main_bp.route('/services')
@login_required
def services():
    return render_template('services.html')


@main_bp.route('/departments')
@login_required
def departments():
    return render_template('departments.html')


@main_bp.route('/contact')
@login_required
def contact():
    return render_template('contact.html')


# ----------------------------------------------------------
# ADMIN / OPS DASHBOARD
# ----------------------------------------------------------
@main_bp.route('/dashboard')
@login_required
def dashboard():
    try:
        user_ctx = get_user_context()

        return render_template(
            'dashboard.html',
            user=user_ctx['username'],
            role=user_ctx['role_display'],
            is_admin=user_ctx['is_admin']
        )
    except:
        return redirect(url_for('auth_bp.login'))


# ----------------------------------------------------------
# OTHER GENERAL ROUTES
# ----------------------------------------------------------
@main_bp.route('/appointments')
@login_required
def appointments():
    return render_template('appointments.html')


@main_bp.route('/patients')
@login_required
def patients():
    return render_template('patients.html')


@main_bp.route('/reports')
@login_required
def reports_page():
    return render_template('reports.html')


@main_bp.route('/settings')
@login_required
def settings():
    return render_template('settings.html')
