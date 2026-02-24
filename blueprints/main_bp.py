# ==========================================================
# EPICONSULT e-CLINIC — MAIN BLUEPRINT (main_bp.py)
# Home Redirect + General Pages
# ==========================================================
import logging
from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user

from utils.decorators import get_user_context
from privileges import normalize_slug, department_to_route, is_admin_role
from constants import canonical_department

main_bp = Blueprint("main_bp", __name__)
logger = logging.getLogger(__name__)


# ----------------------------------------------------------
# HOME → redirect to department dashboard (staff) / admin page
# ----------------------------------------------------------
@main_bp.route("/home")
@login_required
def home():
    try:
        role_slug = normalize_slug(getattr(current_user, "role", ""))
        dept_slug = canonical_department(getattr(current_user, "department", "") or "")

        if is_admin_role(role_slug):
            # send admin to admin users page (same as your auth redirect)
            return redirect(url_for("admin_bp.users_page"))

        # staff -> department route
        endpoint = department_to_route(dept_slug)

        # department_to_route has fallback to main_bp.dashboard,
        # but if you want strict enforcement, you can block missing dept:
        if not dept_slug:
            logger.warning(f"User {getattr(current_user,'username','?')} missing department")
            return redirect(url_for("main_bp.dashboard"))

        return redirect(url_for(endpoint))

    except Exception as e:
        logger.error(f"Home redirection error: {str(e)}", exc_info=True)
        return redirect(url_for("auth_bp.login"))


# ----------------------------------------------------------
# GENERAL STATIC PAGES
# ----------------------------------------------------------
@main_bp.route("/about")
@login_required
def about():
    return render_template("about.html")


@main_bp.route("/services")
@login_required
def services():
    return render_template("services.html")


@main_bp.route("/departments")
@login_required
def departments():
    return render_template("departments.html")


@main_bp.route("/contact")
@login_required
def contact():
    return render_template("contact.html")


# ----------------------------------------------------------
# ADMIN / OPS DASHBOARD
# ----------------------------------------------------------
@main_bp.route("/dashboard")
@login_required
def dashboard():
    try:
        user_ctx = get_user_context() or {}

        return render_template(
            "dashboard.html",
            user=user_ctx.get("username"),
            role=user_ctx.get("role_display"),
            is_admin=user_ctx.get("is_admin"),
        )
    except Exception:
        return redirect(url_for("auth_bp.login"))


# ----------------------------------------------------------
# OTHER GENERAL ROUTES
# ----------------------------------------------------------
@main_bp.route("/appointments")
@login_required
def appointments():
    return render_template("appointments.html")


@main_bp.route("/patients")
@login_required
def patients():
    return render_template("patients.html")


@main_bp.route("/reports")
@login_required
def reports_page():
    return render_template("reports.html")


@main_bp.route("/settings")
@login_required
def settings():
    return render_template("settings.html")
