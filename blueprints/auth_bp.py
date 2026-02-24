# ==========================================================
# EPICONSULT e-CLINIC — AUTH BLUEPRINT (auth_bp.py)
# Login, Logout, Authentication Handling
# - Username + Password only (no role dropdown)
# ==========================================================

import logging
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, session
from flask_login import login_user, logout_user, login_required, current_user

from db import verify_user
from privileges import normalize_slug, department_to_route, is_admin_role
from constants import canonical_department  # reception/customer_care alias handling

auth_bp = Blueprint("auth_bp", __name__)
logger = logging.getLogger(__name__)


# ----------------------------------------------------------
# LOGIN
# ----------------------------------------------------------
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    # Page render
    if request.method == "GET":
        return render_template("login.html")

    try:
        data = request.get_json(silent=True) or {}

        username = (data.get("username") or "").strip()
        password = (data.get("password") or "").strip()

        if not username or not password:
            return jsonify({
                "success": False,
                "message": "Username and password are required."
            }), 400

        # ✅ DB is source of truth (also blocks inactive users inside verify_user)
        user = verify_user(username, password)

        if not user:
            logger.warning(f"Failed login attempt for username={username}")
            return jsonify({
                "success": False,
                "message": "Invalid username or password."
            }), 401

        # ---- LOGIN SUCCESS ----
        login_user(user, remember=True)
        session.permanent = True

        # Core session identity
        session["user"] = user.username
        session["role"] = user.role

        # Canonicalize dept: customer_care -> reception
        raw_dept = getattr(user, "department", None) or ""
        dept_slug = canonical_department(raw_dept)
        session["department"] = dept_slug or None

        # Decide redirect
        role_slug = normalize_slug(getattr(user, "role", ""))

        if is_admin_role(role_slug):
            redirect_url = url_for("admin_bp.users_page")
        else:
            # Staff must have a department
            if not dept_slug:
                return jsonify({
                    "success": False,
                    "message": "Your account has no department assigned. Please contact admin."
                }), 403

            endpoint = department_to_route(dept_slug)
            redirect_url = url_for(endpoint)

        logger.info(
            f"User {user.username} logged in. role={user.role}, dept_raw={getattr(user,'department',None)}, dept_canonical={dept_slug}"
        )

        return jsonify({
            "success": True,
            "message": "Login successful.",
            "redirect_url": redirect_url,
            "user": {
                "username": user.username,
                "role": user.role,
                "department": getattr(user, "department", None),
                "department_canonical": dept_slug
            }
        })

    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "message": "An error occurred during login."
        }), 500


# ----------------------------------------------------------
# LOGOUT
# ----------------------------------------------------------
@auth_bp.route("/logout")
@login_required
def logout():
    try:
        username = getattr(current_user, "username", "unknown")

        # Optional: if you used passkey gate before login, clear it on logout too
        session.pop("admin_verified", None)

        session.clear()
        logout_user()

        logger.info(f"User {username} logged out successfully")
        return redirect(url_for("auth_bp.login"))

    except Exception as e:
        logger.error(f"Logout error: {str(e)}", exc_info=True)
        return redirect(url_for("auth_bp.login"))