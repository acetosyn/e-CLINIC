import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from flask import Flask, redirect, url_for
from flask_login import LoginManager, current_user
from dotenv import load_dotenv

# ===============================
# BLUEPRINTS
# ===============================
from blueprints.auth_bp import auth_bp
from blueprints.main_bp import main_bp
from blueprints.departments_bp import departments_bp
from blueprints.api_bp import api_bp
from blueprints.records_bp import records_bp
from blueprints.chat_bp import chat_bp
from blueprints.admin_bp import admin_bp

# ===============================
# DATABASE CORE
# ===============================
from db import get_user_by_id, db_session, engine

# ===============================
# UTILS
# ===============================
from utils.helpers import dated_url_for, inject_user_context, add_no_cache

load_dotenv()
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "epiconsult-secret-key")

# Session config
app.config["PERMANENT_SESSION_LIFETIME"] = 365 * 24 * 3600
app.config["SESSION_COOKIE_SECURE"] = os.getenv("FLASK_ENV") == "production"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# ===============================
# LOGIN MANAGER
# ===============================
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "auth_bp.login"
login_manager.login_message = "Please log in to continue."

# ===============================
# REGISTER BLUEPRINTS
# ===============================
app.register_blueprint(auth_bp)
app.register_blueprint(main_bp)
app.register_blueprint(departments_bp)
app.register_blueprint(api_bp)
app.register_blueprint(records_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(admin_bp)


@login_manager.user_loader
def load_user(user_id):
    try:
        return get_user_by_id(int(user_id))
    except Exception:
        return None

@app.teardown_appcontext
def shutdown_session(exception=None):
    try:
        db_session.remove()
    except Exception:
        pass

# ===============================
# ROUTES
# ===============================
@app.route("/")
def index():
    """Root redirect based on login state."""
    if current_user.is_authenticated:
        return redirect(url_for("main_bp.home"))
    return redirect(url_for("auth_bp.login"))

# ===============================
# ERROR HANDLERS
# ===============================
@app.errorhandler(403)
def forbidden_error(e):
    return "Access denied", 403

@app.errorhandler(404)
def not_found_error(e):
    return "Page not found", 404

@app.errorhandler(500)
def internal_error(e):
    return "Internal server error", 500

# ===============================
# STATIC CACHE BUSTING
# ===============================
@app.context_processor
def override_url_for():
    return dict(url_for=dated_url_for)

# ===============================
# TEMPLATE GLOBALS
# ===============================
@app.context_processor
def inject_globals():
    """
    Inject privilege helpers + user context into all templates.
    """
    from privileges import (
        can_access,
        is_admin_role,
        normalize_slug,
        department_to_route,
        is_unrestricted_role,   # ✅ add
    )

    return {
        "can_access": can_access,
        "is_admin_role": is_admin_role,
        "normalize_slug": normalize_slug,

        # base.html expects normalize_role(...)
        "normalize_role": normalize_slug,

        # ✅ base.html expects is_unrestricted_role(...)
        "is_unrestricted_role": is_unrestricted_role,

        "department_to_route": department_to_route,
        **inject_user_context()
    }
# ===============================
# DISABLE CACHING ON ALL RESPONSES
# ===============================
@app.after_request
def no_cache_middleware(response):
    return add_no_cache(response)

if __name__ == "__main__":
    if not engine:
        print("❌ Database engine not initialized. Check DATABASE_URL in .env.")
    app.run(debug=True, host="0.0.0.0", port=5000)
