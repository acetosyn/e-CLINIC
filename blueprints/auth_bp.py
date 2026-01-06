# ==========================================================
# EPICONSULT e-CLINIC — AUTH BLUEPRINT (auth_bp.py)
# Login, Logout, Authentication Handling
# ==========================================================

import logging
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, session
from flask_login import login_user, logout_user, login_required, current_user
from datetime import datetime

from db import verify_user
from utils.decorators import normalize_role

auth_bp = Blueprint("auth_bp", __name__)
logger = logging.getLogger(__name__)


# ----------------------------------------------------------
# LOGIN
# ----------------------------------------------------------
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    try:
        data = request.get_json() or {}

        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        role = data.get("role", "").strip()

        if not username or not password or not role:
            return jsonify({
                "success": False,
                "message": "All fields are required."
            }), 400

        user = verify_user(username, password, role)

        if not user:
            logger.warning(f"Failed login attempt for {username}")
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

        # 🚨 IMPORTANT:
        # DO NOT set session['department'] here
        # Department is set ONLY when user enters a department page
        # via departments_bp.render_dept_page()

        logger.info(f"User {username} logged in successfully as {user.role}")

        return jsonify({
            "success": True,
            "message": f"Welcome {user.role}!",
            "user": {
                "username": user.username,
                "role": user.role
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
