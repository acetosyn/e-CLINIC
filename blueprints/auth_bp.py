# ==========================================================
# EPICONSULT e-CLINIC — AUTH BLUEPRINT (auth_bp.py)
# Login, Logout, Authentication Handling
# ==========================================================
import logging
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, session
from flask_login import login_user, logout_user, login_required, current_user
from db import verify_user
from datetime import datetime

auth_bp = Blueprint('auth_bp', __name__)

logger = logging.getLogger(__name__)


# ----------------------------------------------------------
# LOGIN ROUTE
# ----------------------------------------------------------
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        role = data.get("role", "").strip()

        # Validation
        if not username or not password or not role:
            return jsonify({"success": False, "message": "All fields are required."}), 400

        user = verify_user(username, password, role)

        if user:
            session.permanent = True
            login_user(user, remember=True)

            session['user'] = user.username
            session['role'] = user.role
            session['department'] = user.role

            logger.info(f"User {username} logged in successfully")

            return jsonify({
                "success": True,
                "message": f"Welcome {role}!",
                "user": {
                    "username": user.username,
                    "role": user.role
                }
            })

        logger.warning(f"Failed login attempt for {username}")
        return jsonify({"success": False, "message": "Invalid username or password."}), 401

    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        return jsonify({"success": False, "message": "An error occurred during login."}), 500


# ----------------------------------------------------------
# LOGOUT
# ----------------------------------------------------------
@auth_bp.route('/logout')
@login_required
def logout():
    try:
        username = current_user.username
        session.clear()
        logout_user()
        logger.info(f"User {username} logged out")

        return redirect(url_for('auth_bp.login'))
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return redirect(url_for('auth_bp.login'))
