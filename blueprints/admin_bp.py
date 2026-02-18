# blueprints/admin_bp.py
# ==========================================================
# EPICONSULT e-CLINIC — ADMIN BLUEPRINT (admin_bp.py)
# Admin UI + User Management APIs + Passkey Gate
# ==========================================================

import os
import logging
from dotenv import load_dotenv
from flask import Blueprint, render_template, jsonify, request, abort, session, url_for
from flask_login import current_user

from db import (
    admin_create_user,
    admin_list_users,
    admin_delete_user,
    admin_set_active,
    admin_set_password,   # ✅ ADD THIS
)


load_dotenv()
logger = logging.getLogger(__name__)

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/admin")


# ----------------------------
# Guard
# ----------------------------
def admin_console_allowed() -> bool:
    """
    Allow admin console if:
    - Logged-in user role == admin
    OR
    - Passkey gate session is active (from /admin/access)
    """
    if session.get("admin_verified") is True:
        return True

    if getattr(current_user, "is_authenticated", False):
        role = (getattr(current_user, "role", "") or "").strip().lower()
        return role == "admin"

    return False


def admin_required():
    if not admin_console_allowed():
        abort(403)


# ----------------------------
# UI: Users Page
# ----------------------------
@admin_bp.route("/users", methods=["GET"])
def users_page():
    admin_required()
    return render_template("users.html")


# ----------------------------
# Passkey Gate: /admin/access
# ----------------------------
@admin_bp.route("/access", methods=["POST"])
def admin_access():
    """
    Validates admin passkey from login modal.
    If correct, mark session as admin_verified and return redirect_url to /admin/users.
    """
    data = request.get_json(silent=True) or {}
    passkey = (data.get("passkey") or "").strip()

    expected = (os.getenv("admin_access") or "").strip()

    if not expected:
        return jsonify({"success": False, "message": "Admin access is not configured."}), 500

    if passkey != expected:
        return jsonify({"success": False, "message": "Incorrect passkey."}), 401

    session["admin_verified"] = True
    return jsonify({"success": True, "redirect_url": url_for("admin_bp.users_page")})


# ----------------------------
# API: List Users
# ----------------------------
@admin_bp.route("/api/users", methods=["GET"])
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
# API: Create User
# ----------------------------
@admin_bp.route("/api/users", methods=["POST"])
def api_create_user():
    admin_required()
    data = request.get_json(silent=True) or {}

    try:
        user = admin_create_user(
            full_name=(data.get("full_name") or "").strip(),
            username=(data.get("username") or "").strip(),
            password=(data.get("password") or "").strip(),
            role=(data.get("role") or "staff").strip().lower(),
            department=(data.get("department") or "").strip() or None,
            is_active=bool(data.get("is_active", True)),
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


@admin_bp.route("/api/users/<int:user_id>/password", methods=["PATCH"])
def api_set_password(user_id: int):
    admin_required()

    data = request.get_json(silent=True) or {}
    new_password = (data.get("password") or "").strip()

    if not new_password:
        return jsonify({"success": False, "message": "Password is required."}), 400

    if len(new_password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters."}), 400

    try:
        user = admin_set_password(user_id, new_password)  # in db.py
        if not user:
            return jsonify({"success": False, "message": "User not found."}), 404

        return jsonify({
            "success": True,
            "message": "Password updated.",
            "user": {
                "id": user.id,
                "username": user.username,
                "updated_at": user.updated_at.isoformat() if getattr(user, "updated_at", None) else None,
            }
        }), 200

    except ValueError as e:
        # for db.py validation errors
        return jsonify({"success": False, "message": str(e)}), 400

    except Exception as e:
        logger.error(f"Set password error: {str(e)}", exc_info=True)
        return jsonify({"success": False, "message": "Failed to update password."}), 500
