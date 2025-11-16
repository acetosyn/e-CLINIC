# ==========================================================
# EPICONSULT e-CLINIC — Flask App (app.py)
# Auth + Routing + Privileges System Integration
# ==========================================================
import os
import logging
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from dotenv import load_dotenv
from db import verify_user, get_user_by_id, db_session, engine, log_activity
from privileges import can_access, department_accessible_pages

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ------------------------------
# INITIAL SETUP
# ------------------------------
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "epiconsult-secret-key")

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'


@login_manager.user_loader
def load_user(user_id):
    """Load user for Flask-Login session."""
    try:
        return get_user_by_id(int(user_id))
    except Exception as e:
        logger.error(f"Error loading user: {str(e)}")
        return None


@app.teardown_appcontext
def shutdown_session(exception=None):
    """Remove database session after request."""
    try:
        if db_session:
            db_session.remove()
    except Exception as e:
        logger.error(f"Error closing database session: {str(e)}")


# ------------------------------
# ROOT ROUTE
# ------------------------------
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    return redirect(url_for('login'))


# ------------------------------
# LOGIN
# ------------------------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        role = data.get("role", "").strip()

        if not username or not password or not role:
            return jsonify({"success": False, "message": "All fields are required."}), 400

        user = verify_user(username, password, role)
        if user:
            login_user(user, remember=True)
            logger.info(f"User {username} logged in successfully")
            
            # Log login activity
            log_activity(
                department=role.lower(),
                activity_type="login",
                description=f"User {username} logged in",
                performed_by=username
            )
            
            return jsonify({
                "success": True,
                "message": f"Welcome {role}!",
                "user": {
                    "username": user.username,
                    "role": user.role
                }
            })
        else:
            logger.warning(f"Failed login attempt for {username}")
            return jsonify({"success": False, "message": "Invalid username or password."}), 401
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"success": False, "message": "An error occurred during login."}), 500


# ------------------------------
# LOGOUT
# ------------------------------
@app.route('/logout')
@login_required
def logout():
    """Logs out the current user and redirects to login page."""
    try:
        logout_user()
        logger.info("User logged out")
        return redirect(url_for('login'))
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return redirect(url_for('login'))


# ------------------------------
# HELPER FUNCTIONS
# ------------------------------
def check_access(department):
    """
    Checks backend privilege for a department page.
    Admins & Operations always have full access.
    """
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
    
    role = current_user.role
    if not can_access(role, department):
        return render_template(
            "403.html",
            message=f"Access restricted — you can only access your {role} dashboard."
        ), 403
    return None


# ------------------------------
# HOME (Protected)
# ------------------------------
@app.route('/home')
@login_required
def home():
    try:
        return render_template('home.html', user=current_user.username, role=current_user.role)
    except Exception as e:
        logger.error(f"Error loading home page: {str(e)}")
        return redirect(url_for('login'))


# ------------------------------
# DEPARTMENTAL ROUTES (Restricted)
# ------------------------------
# ==========================================================
# CUSTOMER CARE DASHBOARD (Department Base Inheritance)
# ==========================================================
# ------------------------------
# CUSTOMER CARE DASHBOARD
# ------------------------------
@app.route('/customer-care')
@login_required
def customer_care():
    """Customer Care main dashboard page."""
    try:
        # Step 1: verify login session (handled by @login_required)
        # Step 2: allow only Customer Care users
        from db import normalize_role
        role = normalize_role(current_user.role)
        if role != "customer_care":
            return redirect(url_for('dashboard'))

        # Step 3: render the departmental page
        return render_template(
            'customer_care.html',
            user=current_user.username,
            role=role.title(),
            title="Customer Care — e-Clinic"
        )
    except Exception as e:
        logger.error(f"Error loading customer care page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/doctor')
@login_required
def doctor():
    try:
        access = check_access("doctor")
        if access:
            return access
        return render_template('doctor.html')
    except Exception as e:
        logger.error(f"Error loading doctor page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/nursing')
@login_required
def nursing():
    try:
        access = check_access("nursing")
        if access:
            return access
        return render_template('nursing.html')
    except Exception as e:
        logger.error(f"Error loading nursing page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/laboratory')
@login_required
def laboratory():
    try:
        access = check_access("laboratory")
        if access:
            return access
        return render_template('laboratory.html')
    except Exception as e:
        logger.error(f"Error loading laboratory page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/diagnostics')
@login_required
def diagnostics():
    try:
        access = check_access("diagnostics")
        if access:
            return access
        return render_template('diagnostics.html')
    except Exception as e:
        logger.error(f"Error loading diagnostics page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/inventory')
@login_required
def inventory():
    try:
        access = check_access("inventory")
        if access:
            return access
        return render_template('inventory.html')
    except Exception as e:
        logger.error(f"Error loading inventory page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/accounts')
@login_required
def accounts():
    try:
        access = check_access("accounts")
        if access:
            return access
        return render_template('accounts.html')
    except Exception as e:
        logger.error(f"Error loading accounts page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/it')
@login_required
def it():
    try:
        access = check_access("it")
        if access:
            return access
        return render_template('it.html')
    except Exception as e:
        logger.error(f"Error loading IT page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/operations')
@login_required
def operations():
    try:
        access = check_access("operations")
        if access:
            return access
        return render_template('operations.html')
    except Exception as e:
        logger.error(f"Error loading operations page: {str(e)}")
        return redirect(url_for('login'))


# ------------------------------
# GENERAL / COMMON ROUTES
# ------------------------------
@app.route('/about')
@login_required
def about():
    try:
        return render_template('about.html')
    except Exception as e:
        logger.error(f"Error loading about page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/services')
@login_required
def services():
    try:
        return render_template('services.html')
    except Exception as e:
        logger.error(f"Error loading services page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/departments')
@login_required
def departments():
    try:
        return render_template('departments.html')
    except Exception as e:
        logger.error(f"Error loading departments page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/contact')
@login_required
def contact():
    try:
        return render_template('contact.html')
    except Exception as e:
        logger.error(f"Error loading contact page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/dashboard')
@login_required
def dashboard():
    try:
        return render_template('dashboard.html')
    except Exception as e:
        logger.error(f"Error loading dashboard page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/appointments')
@login_required
def appointments():
    try:
        return render_template('appointments.html')
    except Exception as e:
        logger.error(f"Error loading appointments page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/patients')
@login_required
def patients():
    try:
        return render_template('patients.html')
    except Exception as e:
        logger.error(f"Error loading patients page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/reports')
@login_required
def reports():
    try:
        return render_template('reports.html')
    except Exception as e:
        logger.error(f"Error loading reports page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/settings')
@login_required
def settings():
    try:
        return render_template('settings.html')
    except Exception as e:
        logger.error(f"Error loading settings page: {str(e)}")
        return redirect(url_for('login'))


# ------------------------------
# API ENDPOINTS
# ------------------------------
@app.route('/api/activities', methods=['GET'])
@login_required
def get_activities():
    """Get recent activities for real-time feed."""
    try:
        from models import Activity
        from sqlalchemy import desc
        
        limit = request.args.get('limit', 50, type=int)
        activities = db_session.query(Activity).order_by(
            desc(Activity.created_at)
        ).limit(limit).all()
        
        return jsonify({
            'success': True,
            'activities': [activity.to_dict() for activity in activities]
        })
    except Exception as e:
        logger.error(f"Error getting activities: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ------------------------------
# CUSTOM ERROR PAGE (403)
# ------------------------------
@app.errorhandler(403)
def forbidden_error(e):
    return render_template("403.html", message="Access denied — insufficient privileges."), 403


@app.errorhandler(404)
def not_found_error(e):
    return render_template("403.html", message="Page not found."), 404


@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {str(e)}")
    return render_template("403.html", message="An internal error occurred."), 500


# ==========================================================
# CONTEXT PROCESSORS & CACHE CONTROL (Fix Chrome stale CSS)
# ==========================================================

# --- Inject current user (optional but harmless) ---
@app.context_processor
def inject_user():
    return dict(current_user=current_user if current_user.is_authenticated else None)


# --- Force unique version on static file URLs ---
@app.context_processor
def override_url_for():
    return dict(url_for=dated_url_for)


def dated_url_for(endpoint, **values):
    if endpoint == "static":
        filename = values.get("filename")
        if filename:
            file_path = os.path.join(app.root_path, endpoint, filename)
            if os.path.isfile(file_path):
                values["v"] = int(os.stat(file_path).st_mtime)
    return url_for(endpoint, **values)


# --- Disable caching of responses ---
@app.after_request
def add_no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


# ------------------------------
# ENTRY POINT
# ------------------------------
if __name__ == '__main__':
    try:
        if not engine:
            logger.error("Database engine not initialized. Check DATABASE_URL in .env")
        app.run(debug=True, host="0.0.0.0", port=5000)
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}")
