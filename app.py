import os
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


# ===============================
# DATABASE CORE
# ===============================
from db import get_user_by_id, db_session, engine

# ===============================
# UTILS
# ===============================
from utils.helpers import dated_url_for, inject_user_context, add_no_cache

# ==========================================================
# INIT
# ==========================================================
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "epiconsult-secret-key")

# Session config
app.config["PERMANENT_SESSION_LIFETIME"] = 365 * 24 * 3600
app.config["SESSION_COOKIE_SECURE"] = os.getenv('FLASK_ENV') == 'production'
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# ==========================================================
# LOGIN MANAGER
# ==========================================================
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "auth_bp.login"
login_manager.login_message = "Please log in to continue."


# ==========================================================
# BLUEPRINTS
# ==========================================================
app.register_blueprint(auth_bp)
app.register_blueprint(main_bp)
app.register_blueprint(departments_bp)
app.register_blueprint(api_bp)
app.register_blueprint(records_bp)
app.register_blueprint(chat_bp)


@login_manager.user_loader
def load_user(user_id):
    """Load user from DB."""
    try:
        return get_user_by_id(int(user_id))
    except:
        return None


@app.teardown_appcontext
def shutdown_session(exception=None):
    """Auto-close DB session."""
    try:
        db_session.remove()
    except:
        pass


# ==========================================================
# ROUTES
# ==========================================================
@app.route("/")
def index():
    """Root redirect based on login state."""
    if current_user.is_authenticated:
        return redirect(url_for("main_bp.home"))
    return redirect(url_for("auth_bp.login"))

# ==========================================================
# ERROR HANDLERS
# ==========================================================
@app.errorhandler(403)
def forbidden_error(e):
    return "Access denied", 403

@app.errorhandler(404)
def not_found_error(e):
    return "Page not found", 404

@app.errorhandler(500)
def internal_error(e):
    return "Internal server error", 500

# ==========================================================
# STATIC CACHE BUSTING
# ==========================================================
@app.context_processor
def override_url_for():
    """Allows {{ url_for('static', filename='...') }} to auto-refresh."""
    return dict(url_for=dated_url_for)

# ==========================================================
# TEMPLATE GLOBALS
# ==========================================================
@app.context_processor
def inject_globals():
    """
    Inject privilege helpers + user context into all templates.
    No logic stored here — just references to external modules.
    """
    from privileges import can_access, is_unrestricted_role, normalize_role
    return {
        "can_access": can_access,
        "is_unrestricted_role": is_unrestricted_role,
        "normalize_role": normalize_role,
        "SUPABASE_URL": os.getenv('SUPABASE_URL', ''),
        "SUPABASE_ANON_KEY": os.getenv('SUPABASE_ANON_KEY', ''),
        **inject_user_context()   # keeps user_context working
    }


# ==========================================================
# DISABLE CACHING ON ALL RESPONSES
# ==========================================================
@app.after_request
def no_cache_middleware(response):
    return add_no_cache(response)

# ==========================================================
# ENTRY POINT
# ==========================================================
if __name__ == "__main__":
    if not engine:
        print("❌ Database engine not initialized. Check DATABASE_URL in .env.")
    app.run(debug=True, host="0.0.0.0", port=5001)