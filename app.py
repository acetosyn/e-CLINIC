# ==========================================================
# EPICONSULT e-CLINIC — Flask App (app.py)
# Auth + Routing using Flask-Login and SQLAlchemy
# ==========================================================
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, make_response
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_migrate import Migrate
from config import get_config
from models import db, User, verify_user_credentials, get_user_by_id
import logging
import os

# ------------------------------
# LOGGING SETUP
# ------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ------------------------------
# INITIAL SETUP
# ------------------------------
app = Flask(__name__)
app.config.from_object(get_config())

# Initialize extensions
db.init_app(app)
migrate = Migrate(app, db)

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'


@login_manager.user_loader
def load_user(user_id):
    """Load user by ID for Flask-Login"""
    return get_user_by_id(user_id)


# Create tables
with app.app_context():
    try:
        db.create_all()
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")

# ------------------------------
# ROOT ROUTE
# ------------------------------
@app.route('/')
def index():
    """Root route - redirect to home if logged in, else to login"""
    # Check if user is authenticated (not just session exists)
    if current_user.is_authenticated:
        response = redirect(url_for('home'))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response
    response = redirect(url_for('login'))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

# ------------------------------
# LOGIN
# ------------------------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login route with role-based authentication"""
    # If already logged in, redirect to home
    if current_user.is_authenticated:
        response = redirect(url_for('home'))
        response.headers['Cache-Control'] = 'no-cache'
        return response
    
    if request.method == 'GET':
        # Clear any stale session data on login page load
        if 'role' in session:
            session.pop('role', None)
        response = make_response(render_template('login.html'))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        role = data.get("role", "").strip()

        # Validate input
        if not username or not password or not role:
            return jsonify({"success": False, "message": "All fields are required."})

        # Verify credentials
        user = verify_user_credentials(username, password, role)
        if user:
            login_user(user, remember=True)
            session["role"] = role  # Store role in session for easy access
            logger.info(f"User {username} ({role}) logged in successfully")
            return jsonify({"success": True, "message": f"Welcome {role}!"})
        else:
            logger.warning(f"Failed login attempt for {username} ({role})")
            return jsonify({"success": False, "message": "Invalid username, password, or role."})
    
    except Exception as e:
        logger.error(f"Error during login: {e}")
        return jsonify({"success": False, "message": "An error occurred during login."})

# ------------------------------
# LOGOUT
# ------------------------------
@app.route('/logout')
def logout():
    """Logs out the current user and redirects to login page"""
    try:
        username = None
        if current_user.is_authenticated:
            username = current_user.username
        
        # Clear Flask-Login session (this clears both session and remember cookie)
        logout_user()
        
        # Clear all session data
        session.clear()
        session.permanent = False
        
        # Explicitly delete remember cookie if it exists
        remember_cookie_name = app.config.get('REMEMBER_COOKIE_NAME', 'remember_token')
        
        if username:
            logger.info(f"User {username} logged out successfully")
        else:
            logger.info("Logout called (no authenticated user)")
        
        # Create redirect response
        response = redirect(url_for('login'))
        
        # Delete remember cookie explicitly
        response.set_cookie(remember_cookie_name, '', expires=0, max_age=0)
        
        # Add no-cache headers to prevent browser caching
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
    except Exception as e:
        logger.error(f"Error during logout: {e}")
        # Even if there's an error, redirect to login
        response = redirect(url_for('login'))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response


# ------------------------------
# HOME (Protected)
# ------------------------------
@app.route('/home')
@login_required
def home():
    """Home page - protected route"""
    return render_template('home.html', user=current_user.username, role=current_user.role)

# ------------------------------
# OTHER ROUTES (Protected)
# ------------------------------
@app.route('/about')
@login_required
def about():
    """About page - protected route"""
    return render_template('about.html')

@app.route('/services')
@login_required
def services():
    """Services page - protected route"""
    return render_template('services.html')

@app.route('/departments')
@login_required
def departments():
    """Departments page - protected route"""
    return render_template('departments.html')

@app.route('/contact')
@login_required
def contact():
    """Contact page - protected route"""
    return render_template('contact.html')

@app.route('/dashboard')
@login_required
def dashboard():
    """Dashboard page - protected route"""
    return render_template('dashboard.html')

@app.route('/appointments')
@login_required
def appointments():
    """Appointments page - protected route"""
    return render_template('appointments.html')

@app.route('/patients')
@login_required
def patients():
    """Patients page - protected route"""
    return render_template('patients.html')

@app.route('/inventory')
@login_required
def inventory():
    """Inventory page - protected route"""
    return render_template('inventory.html')

@app.route('/reports')
@login_required
def reports():
    """Reports page - protected route"""
    return render_template('reports.html')

@app.route('/settings')
@login_required
def settings():
    """Settings page - protected route"""
    return render_template('settings.html')

# ------------------------------
# ENTRY POINT
# ------------------------------
if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)
