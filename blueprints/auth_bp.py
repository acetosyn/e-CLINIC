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

        # ✅ DB is source of truth
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

        # Department from DB (staff only; admin may be None)
        session["department"] = getattr(user, "department", None)

        # Decide redirect
        role_slug = normalize_slug(getattr(user, "role", ""))
        dept_slug = normalize_slug(getattr(user, "department", "") or "")

        if is_admin_role(role_slug):
            # ✅ NEW: send admin to admin users page
            redirect_url = url_for("admin_bp.users_page")
        else:
            # staff => department landing page
            endpoint = department_to_route(dept_slug)

            # safety fallback if dept missing/invalid
            if not endpoint:
                logger.warning(f"User {user.username} missing/invalid department: {dept_slug}")
                return jsonify({
                    "success": False,
                    "message": "Your account has no department assigned. Please contact admin."
                }), 403

            redirect_url = url_for(endpoint)

        logger.info(
            f"User {user.username} logged in. role={getattr(user,'role',None)}, dept={getattr(user,'department',None)}"
        )

        return jsonify({
            "success": True,
            "message": "Login successful.",
            "redirect_url": redirect_url,
            "user": {
                "username": user.username,
                "role": user.role,
                "department": getattr(user, "department", None)
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
        username = current_user.username

        session.clear()
        logout_user()

        logger.info(f"User {username} logged out successfully")
        return redirect(url_for("auth_bp.login"))

    except Exception as e:
        logger.error(f"Logout error: {str(e)}", exc_info=True)
        return redirect(url_for("auth_bp.login"))




# ==========================================================
# EPICONSULT e-CLINIC — ADMIN BLUEPRINT (admin_bp.py)
# Admin UI + User Management APIs
# ==========================================================

import logging
from flask import Blueprint, render_template, jsonify, request, abort
from flask_login import login_required, current_user

from db import (
    admin_create_user,
    admin_list_users,
    admin_delete_user,
    admin_set_active,
)

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/admin")
logger = logging.getLogger(__name__)


# ----------------------------
# Guard
# ----------------------------
def admin_required():
    role = (getattr(current_user, "role", "") or "").strip().lower()
    if role != "admin":
        abort(403)


# ----------------------------
# Admin UI Page
# ----------------------------
@admin_bp.route("/users", methods=["GET"])
@login_required
def users_page():
    admin_required()
    return render_template("users.html")


# ----------------------------
# API: List Users
# ----------------------------
@admin_bp.route("/api/users", methods=["GET"])
@login_required
def api_list_users():
    admin_required()
    users = admin_list_users()

    return jsonify({
        "success": True,
        "users": [
            {
                "id": u.id,
                "full_name": u.full_name,
                "username": u.username,
                "role": u.role,
                "department": u.department,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
            }
            for u in users
        ]
    })


# ----------------------------
# API: Create Staff User
# ----------------------------
@admin_bp.route("/api/users", methods=["POST"])
@login_required
def api_create_user():
    admin_required()
    data = request.get_json(silent=True) or {}

    try:
        user = admin_create_user(
            full_name=(data.get("full_name") or "").strip(),
            username=(data.get("username") or "").strip(),
            password=(data.get("password") or "").strip(),
            role=(data.get("role") or "staff").strip().lower(),   # allow staff/admin if you want
            department=(data.get("department") or "").strip() or None,
            is_active=bool(data.get("is_active", True))
        )

        return jsonify({
            "success": True,
            "message": "User created.",
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "username": user.username,
                "role": user.role,
                "department": user.department,
                "is_active": user.is_active,
            }
        }), 201

    except Exception as e:
        logger.error(f"Create user error: {str(e)}", exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 400


# ----------------------------
# API: Delete User
# ----------------------------
@admin_bp.route("/api/users/<int:user_id>", methods=["DELETE"])
@login_required
def api_delete_user(user_id: int):
    admin_required()
    ok = admin_delete_user(user_id)
    if not ok:
        return jsonify({"success": False, "message": "User not found."}), 404
    return jsonify({"success": True, "message": "User deleted."})


# ----------------------------
# API: Enable/Disable User
# ----------------------------
@admin_bp.route("/api/users/<int:user_id>/active", methods=["PATCH"])
@login_required
def api_set_active(user_id: int):
    admin_required()
    data = request.get_json(silent=True) or {}
    is_active = bool(data.get("is_active"))

    user = admin_set_active(user_id, is_active)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    return jsonify({
        "success": True,
        "message": "User updated.",
        "user": {"id": user.id, "is_active": user.is_active}
    })
