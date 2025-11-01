# ==========================================================
# EPICONSULT e-CLINIC — Flask App (app.py)
# Auth + Routing + Privileges System Integration
# ==========================================================
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash
from config import Config
from db import db, init_db, verify_user
from models import User
from privileges import can_access, department_accessible_pages
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ------------------------------
# INITIAL SETUP
# ------------------------------
app = Flask(__name__)
app.config.from_object(Config)

# Initialize database
init_db(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'

@login_manager.user_loader
def load_user(user_id):
    """Load user by ID for flask_login"""
    try:
        return db.session.get(User, int(user_id))
    except Exception as e:
        logger.error(f"Error loading user: {str(e)}")
        return None


# ------------------------------
# ROOT ROUTE
# ------------------------------
@app.route('/')
def index():
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
    return redirect(url_for('home'))


# ------------------------------
# LOGIN
# ------------------------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        if current_user.is_authenticated:
            return redirect(url_for('home'))
        return render_template('login.html')

    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        role = data.get("role", "").strip()

        user = verify_user(username, password, role)
        if user:
            login_user(user)
            user.update_last_login()
            
            # Store additional session data
            session["role"] = user.role
            session["allowed_pages"] = department_accessible_pages(user.role)
            
            logger.info(f"User {username} logged in as {role}")
            return jsonify({"success": True, "message": f"Welcome {role}!"})
        else:
            return jsonify({"success": False, "message": "Invalid username or password."})
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"success": False, "message": "An error occurred during login."})


# ------------------------------
# LOGOUT
# ------------------------------
@app.route('/logout')
@login_required
def logout():
    """Logs out the current user and redirects to login page."""
    logger.info(f"User {current_user.username} logged out")
    logout_user()
    session.clear()
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
    return render_template('home.html', user=current_user.username, role=current_user.role)


# ------------------------------
# DEPARTMENTAL ROUTES (Restricted)
# ------------------------------
# ==========================================================
# CUSTOMER CARE DASHBOARD
# ==========================================================
@app.route('/customer-care')
@login_required
def customer_care():
    """Customer Care main dashboard page."""
    # Step 1: verify login + access control
    access = check_access("customer care")
    if access:
        return access

    # Step 2: fetch user details (optional)
    user = session.get("user", "Guest")
    role = session.get("role", "Unknown")

    # Step 3: render the main page
    return render_template(
        'customer_care.html',
        user=user,
        role=role,
        title="Customer Care — e-Clinic"
    )


@app.route('/doctor')
@login_required
def doctor():
    access = check_access("doctor")
    if access:
        return access
    return render_template('doctor.html')

@app.route('/nursing')
@login_required
def nursing():
    access = check_access("nursing")
    if access:
        return access
    return render_template('nursing.html')

@app.route('/laboratory')
@login_required
def laboratory():
    access = check_access("laboratory")
    if access:
        return access
    return render_template('laboratory.html')

@app.route('/diagnostics')
@login_required
def diagnostics():
    access = check_access("diagnostics")
    if access:
        return access
    return render_template('diagnostics.html')

@app.route('/inventory')
@login_required
def inventory():
    access = check_access("inventory")
    if access:
        return access
    return render_template('inventory.html')

@app.route('/accounts')
@login_required
def accounts():
    access = check_access("accounts")
    if access:
        return access
    return render_template('accounts.html')

@app.route('/it')
@login_required
def it():
    access = check_access("it")
    if access:
        return access
    return render_template('it.html')

@app.route('/operations')
@login_required
def operations():
    access = check_access("operations")
    if access:
        return access
    return render_template('operations.html')


# ------------------------------
# GENERAL / COMMON ROUTES
# ------------------------------
@app.route('/about')
@login_required
def about():
    return render_template('about.html')

@app.route('/services')
@login_required
def services():
    return render_template('services.html')

@app.route('/departments')
@login_required
def departments():
    return render_template('departments.html')

@app.route('/contact')
@login_required
def contact():
    return render_template('contact.html')

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/appointments')
@login_required
def appointments():
    return render_template('appointments.html')

@app.route('/patients')
@login_required
def patients():
    return render_template('patients.html')

@app.route('/reports')
@login_required
def reports():
    return render_template('reports.html')

@app.route('/settings')
@login_required
def settings():
    return render_template('settings.html')


# ------------------------------
# CUSTOM ERROR PAGE (403)
# ------------------------------
@app.errorhandler(403)
def forbidden_error(e):
    return render_template("403.html", message="Access denied — insufficient privileges."), 403


# ------------------------------
# ENTRY POINT
# ------------------------------
if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)
