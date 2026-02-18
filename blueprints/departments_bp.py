# blueprints/departments_bp.py
# ==========================================================
# EPICONSULT e-CLINIC — DEPARTMENTS BLUEPRINT
# Department dashboards with privilege restrictions
# ==========================================================
import logging
from flask import Blueprint, render_template, redirect, url_for, session
from flask_login import login_required, current_user

from utils.decorators import require_department, get_user_context
from privileges import normalize_slug

departments_bp = Blueprint("departments_bp", __name__, url_prefix="/departments")
logger = logging.getLogger(__name__)


def render_dept_page(template_name: str, dept_slug: str, title: str | None = None):
    """
    Safely render a department page and set current department in session.
    """
    try:
        session["department"] = normalize_slug(dept_slug)

        ctx = get_user_context() or {}
        return render_template(
            template_name,
            user=ctx.get("username"),
            role=ctx.get("role_display"),
            title=title,
            ctx=ctx,  # optional: if templates want full context
        )
    except Exception as e:
        logger.error(f"Error loading dept={dept_slug}: {str(e)}", exc_info=True)
        return "Error loading page", 500


# ----------------------------------------------------------
# Optional index: redirect user to their department page
# (Admin can go to main dashboard or a departments list)
# ----------------------------------------------------------
@departments_bp.route("/")
@login_required
def index():
    role = normalize_slug(getattr(current_user, "role", ""))
    dept = normalize_slug(getattr(current_user, "department", ""))

    if role == "admin":
        return redirect(url_for("main_bp.dashboard"))

    # staff -> go straight to their department route
    if dept:
        return redirect(url_for(f"departments_bp.{dept}"))

    return redirect(url_for("main_bp.dashboard"))


# ==========================================================
# NEW SLUG ROUTES (match privileges.py)
# ==========================================================

@departments_bp.route("/accountant")
@login_required
@require_department("accountant")
def accountant():
    # you currently have accounts.html — reuse it
    return render_dept_page("accounts.html", "accountant", "Accountant — e-Clinic")


@departments_bp.route("/bdu")
@login_required
@require_department("bdu")
def bdu():
    # no template yet: reuse dashboard or operations temporarily
    return render_dept_page("operations.html", "bdu", "BDU — e-Clinic")


@departments_bp.route("/doctor")
@login_required
@require_department("doctor")
def doctor():
    return render_dept_page("doctor.html", "doctor", "Doctor — e-Clinic")


@departments_bp.route("/medical_officer")
@login_required
@require_department("medical_officer")
def medical_officer():
    # no template yet: reuse doctor for now
    return render_dept_page("doctor.html", "medical_officer", "Medical Officer — e-Clinic")


@departments_bp.route("/nurse")
@login_required
@require_department("nurse")
def nurse():
    # you currently have nursing.html — reuse it
    return render_dept_page("nursing.html", "nurse", "Nursing — e-Clinic")


@departments_bp.route("/reception")
@login_required
@require_department("reception")
def reception():
    # you currently have customer_care.html — reuse it
    return render_dept_page("customer_care.html", "reception", "Reception — e-Clinic")


@departments_bp.route("/laboratory")
@login_required
@require_department("laboratory")
def laboratory():
    return render_dept_page("laboratory.html", "laboratory", "Laboratory — e-Clinic")


@departments_bp.route("/inventory")
@login_required
@require_department("inventory")
def inventory():
    return render_dept_page("inventory.html", "inventory", "Inventory — e-Clinic")


@departments_bp.route("/security_support")
@login_required
@require_department("security_support")
def security_support():
    # no template yet: reuse operations for now
    return render_dept_page("operations.html", "security_support", "Security Support — e-Clinic")
