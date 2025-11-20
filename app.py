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
from privileges import (
    can_access, 
    department_accessible_pages,
    require_department,
    require_roles,
    require_unrestricted,
    get_user_role,
    get_user_context,
    normalize_role,
    is_unrestricted_role
)
from datetime import datetime, date, timedelta

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global flag to track if cleanup has run today
_last_cleanup_date = None

# ------------------------------
# INITIAL SETUP
# ------------------------------
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "epiconsult-secret-key")

# Configure session to persist longer (until browser closes or explicit logout)
# Default is 31 days, but we'll make it even longer for better UX
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=365)  # 1 year
app.config['SESSION_COOKIE_SECURE'] = os.getenv('FLASK_ENV') == 'production'  # Secure in production
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prevent XSS
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # CSRF protection

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'
# Extend remember cookie duration (default is 365 days)
login_manager.remember_cookie_duration = timedelta(days=365)


@login_manager.user_loader
def load_user(user_id):
    """Load user for Flask-Login session with graceful error handling."""
    try:
        user = get_user_by_id(int(user_id))
        if user is None:
            # User not found - this is OK, might be a temporary connection issue
            # Don't log as error to avoid spam, but log as warning
            logger.warning(f"User {user_id} not found during session restore (might be temporary connection issue)")
        return user
    except ValueError as e:
        # Invalid user_id format
        logger.error(f"Invalid user ID format: {str(e)}")
        return None
    except Exception as e:
        # Unexpected error - log but don't crash
        logger.error(f"Unexpected error loading user: {str(e)}", exc_info=True)
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
            # Make session permanent so it persists across browser sessions
            from flask import session
            session.permanent = True
            
            login_user(user, remember=True)
            logger.info(f"User {username} logged in successfully (permanent session)")
            
            # Set session variables for compatibility with templates
            session['user'] = user.username
            session['role'] = user.role
            session['department'] = user.role  # Set department to role for templates
            
            # Login activity logging removed - not needed
            
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
        username = current_user.username if current_user.is_authenticated else "Unknown"
        
        # Clear session completely
        from flask import session
        session.clear()
        session.permanent = False
        
        logout_user()
        logger.info(f"User {username} logged out (session cleared)")
        return redirect(url_for('login'))
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return redirect(url_for('login'))


# ------------------------------
# HELPER FUNCTIONS (DEPRECATED - Use decorators from privileges.py)
# ------------------------------
# Note: check_access() is kept for backward compatibility but should be replaced
# with @require_department() decorator in new code
def check_access(department):
    """
    DEPRECATED: Use @require_department() decorator instead.
    Checks backend privilege for a department page.
    Admins & Operations always have full access.
    """
    if not current_user.is_authenticated:
        return redirect(url_for('login'))
    
    from privileges import can_access_current_user
    has_access, user_role = can_access_current_user(department)
    
    if not has_access:
        return render_template(
            "403.html",
            message=f"Access restricted — you can only access your {user_role.replace('_', ' ').title()} dashboard."
        ), 403
    return None


# ------------------------------
# HOME (Protected) - Redirects to role-specific landing page
# ------------------------------
def get_department_route(role):
    """Map user role to their department landing page route function name."""
    role_norm = normalize_role(role)
    
    # Map roles to their Flask route function names (used in url_for)
    role_to_route = {
        'customer_care': 'customer_care',  # function name is customer_care, route is /customer-care
        'doctor': 'doctor',
        'nursing': 'nursing',
        'laboratory': 'laboratory',
        'diagnostics': 'diagnostics',
        'inventory': 'inventory',
        'accounts': 'accounts',
        'it': 'it',
        'operations': 'dashboard',  # Operations goes to general dashboard
        'hop': 'dashboard',  # Head of Operations goes to general dashboard
        'admin': 'dashboard',  # Admin goes to general dashboard (overview of all departments)
    }
    
    return role_to_route.get(role_norm, 'dashboard')  # Default to dashboard


@app.route('/home')
@login_required
def home():
    """Home dashboard - redirects users to their department landing page."""
    try:
        user_role = get_user_role()
        if not user_role:
            logger.warning("User role not found, redirecting to login")
            return redirect(url_for('login'))
        
        # Get the department route for this user
        dept_route = get_department_route(user_role)
        
        # Redirect to their department landing page
        logger.info(f"Redirecting user with role '{user_role}' to '{dept_route}'")
        return redirect(url_for(dept_route))
    except Exception as e:
        logger.error(f"Error in home route: {str(e)}", exc_info=True)
        return redirect(url_for('login'))


# ------------------------------
# DEPARTMENTAL ROUTES (Restricted)
# ------------------------------
# ==========================================================
# CUSTOMER CARE DASHBOARD (Department Base Inheritance)
# ==========================================================

@app.route('/customer-care')
@login_required
@require_department('customer_care')
def customer_care():
    """Customer Care main dashboard page."""
    try:
        user_ctx = get_user_context()
        return render_template(
            'customer_care.html',
            user=user_ctx['username'],
            role=user_ctx['role_display'],
            title="Customer Care — e-Clinic"
        )

    except Exception as e:
        logger.error(f"Error loading Customer Care page: {str(e)}", exc_info=True)
        return f"Error loading page: {str(e)}", 500


@app.route('/doctor')
@login_required
@require_department('doctor')
def doctor():
    """Doctor dashboard page."""
    try:
        user_ctx = get_user_context()
        return render_template(
            'doctor.html',
            user=user_ctx['username'] if user_ctx else current_user.username,
            role=user_ctx['role_display'] if user_ctx else get_user_role()
        )
    except Exception as e:
        logger.error(f"Error loading doctor page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/nursing')
@login_required
@require_department('nursing')
def nursing():
    """Nursing department dashboard."""
    try:
        user_ctx = get_user_context()
        return render_template('nursing.html')
    except Exception as e:
        logger.error(f"Error loading nursing page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/laboratory')
@login_required
@require_department('laboratory')
def laboratory():
    """Laboratory department dashboard."""
    try:
        return render_template('laboratory.html')
    except Exception as e:
        logger.error(f"Error loading laboratory page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/diagnostics')
@login_required
@require_department('diagnostics')
def diagnostics():
    """Diagnostics department dashboard."""
    try:
        return render_template('diagnostics.html')
    except Exception as e:
        logger.error(f"Error loading diagnostics page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/inventory')
@login_required
@require_department('inventory')
def inventory():
    """Inventory department dashboard."""
    try:
        return render_template('inventory.html')
    except Exception as e:
        logger.error(f"Error loading inventory page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/accounts')
@login_required
@require_department('accounts')
def accounts():
    """Accounts department dashboard."""
    try:
        return render_template('accounts.html')
    except Exception as e:
        logger.error(f"Error loading accounts page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/it')
@login_required
@require_department('it')
def it():
    """IT department dashboard."""
    try:
        return render_template('it.html')
    except Exception as e:
        logger.error(f"Error loading IT page: {str(e)}")
        return redirect(url_for('login'))


@app.route('/operations')
@login_required
@require_department('operations')
def operations():
    """Operations department dashboard (unrestricted access)."""
    try:
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
    """General dashboard for admin/operations - overview of all departments."""
    try:
        user_ctx = get_user_context()
        # This dashboard is primarily for unrestricted roles (admin/operations)
        # but other roles can access it too if needed
        return render_template(
            'dashboard.html',
            user=user_ctx['username'] if user_ctx else current_user.username,
            role=user_ctx['role_display'] if user_ctx else current_user.role,
            is_admin=user_ctx['is_admin'] if user_ctx else is_unrestricted_role()
        )
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
@app.route('/api/health', methods=['GET'])
@login_required
def health_check():
    """Lightweight health check endpoint for keep-alive pings."""
    try:
        # Query users table to keep it warm (prevent cold starts)
        from models import User
        user_count = db_session.query(User).count()
        
        return jsonify({
            'success': True,
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'users_count': user_count
        })
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return jsonify({
            'success': False,
            'status': 'error',
            'error': str(e)
        }), 500


@app.route('/api/activities', methods=['GET'])
@login_required
def get_activities():
    """Get all activities for today."""
    try:
        from models import Activity
        from sqlalchemy import desc, func
        from datetime import datetime, date
        
        # Get today's date (start of day)
        today = date.today()
        today_start = datetime.combine(today, datetime.min.time())
        
        logger.info(f"Fetching activities from {today_start} onwards")
        
        # Get all activities from today only
        activities = db_session.query(Activity).filter(
            Activity.created_at >= today_start
        ).order_by(
            desc(Activity.created_at)
        ).all()
        
        logger.info(f"Found {len(activities)} activities for today")
        
        activities_dict = [activity.to_dict() for activity in activities]
        
        # Log first activity for debugging
        if activities_dict:
            logger.info(f"First activity sample: {activities_dict[0]}")
        
        return jsonify({
            'success': True,
            'activities': activities_dict
        })
    except Exception as e:
        logger.error(f"Error getting activities: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


def cleanup_old_activities():
    """Delete activities from yesterday and before (keep only today's activities)."""
    try:
        from models import Activity
        
        # Get today's date (start of day)
        today = date.today()
        today_start = datetime.combine(today, datetime.min.time())
        
        # Delete all activities from yesterday and before (keep only today)
        deleted = db_session.query(Activity).filter(
            Activity.created_at < today_start
        ).delete()
        
        db_session.commit()
        logger.info(f"Cleaned up {deleted} old activity records (kept only today's activities from {today_start})")
        return deleted
    except Exception as e:
        logger.error(f"Error cleaning up old activities: {str(e)}", exc_info=True)
        db_session.rollback()
        return 0


@app.before_request
def check_and_cleanup_activities():
    """Check if it's early morning and cleanup old activities if needed."""
    global _last_cleanup_date
    try:
        now = datetime.now()
        today = date.today()
        
        # Run cleanup between 6 AM and 7 AM (once per day)
        # Only run if we haven't cleaned up today yet
        if 6 <= now.hour < 7 and _last_cleanup_date != today:
            deleted = cleanup_old_activities()
            _last_cleanup_date = today
            logger.info(f"Daily cleanup completed: {deleted} old activities removed")
    except Exception as e:
        logger.error(f"Error in activity cleanup check: {str(e)}")


@app.route('/api/admin/cleanup-activities', methods=['POST'])
@login_required
@require_unrestricted()
def manual_cleanup_activities():
    """Manual endpoint to cleanup old activities (admin use)."""
    try:
        deleted = cleanup_old_activities()
        return jsonify({
            'success': True,
            'message': f'Cleaned up {deleted} old activity records'
        })
    except Exception as e:
        logger.error(f"Error in manual cleanup: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/patients/register', methods=['POST'])
@login_required
def register_patient():
    """Register a new patient."""
    try:
        from models import Patient, Referral
        from datetime import datetime
        import uuid
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['first_name', 'last_name', 'date_of_birth', 'sex', 'phone']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'{field.replace("_", " ").title()} is required.'}), 400
        
        # Generate patient IDs
        file_no = f"F-{str(uuid.uuid4())[:8].upper()}"
        patient_id = f"EPN-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}"
        
        # Get or create referral
        referred_by_id = None
        if data.get('referred_by'):
            referral = db_session.query(Referral).filter(
                Referral.name == data.get('referred_by')
            ).first()
            if not referral:
                # Create new referral
                referral = Referral(
                    name=data.get('referred_by'),
                    type='Other',
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db_session.add(referral)
                db_session.flush()
            referred_by_id = referral.id
        
        # Parse date of birth (age is calculated in frontend)
        dob = datetime.strptime(data.get('date_of_birth'), '%Y-%m-%d').date()
        
        # Create patient
        patient = Patient(
            file_no=file_no,
            patient_id=patient_id,
            title=data.get('title'),
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            date_of_birth=dob,
            age=data.get('age'),  # Age is already calculated in frontend
            sex=data.get('sex'),
            occupation=data.get('occupation'),
            phone=data.get('phone'),
            email=data.get('email'),
            address=data.get('address'),
            referred_by_id=referred_by_id,
            registered_by=current_user.username,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db_session.add(patient)
        
        # Log activity
        log_activity(
            department=get_user_role(),
            activity_type='patient_registration',
            description=f"New patient registered: {data.get('first_name')} {data.get('last_name')} ({patient_id})",
            patient_name=f"{data.get('first_name')} {data.get('last_name')}",
            patient_id=patient_id,
            performed_by=current_user.username,
            metadata={'file_no': file_no, 'services': data.get('services', [])}
        )
        
        db_session.commit()
        
        logger.info(f"Patient {patient_id} registered by {current_user.username}")
        
        return jsonify({
            'success': True,
            'message': 'Patient registered successfully',
            'patient': patient.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Error registering patient: {str(e)}", exc_info=True)
        db_session.rollback()
        return jsonify({'success': False, 'message': f'Error registering patient: {str(e)}'}), 500


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
    from privileges import can_access
    return dict(
        current_user=current_user if current_user.is_authenticated else None,
        SUPABASE_URL=os.getenv('SUPABASE_URL', ''),
        SUPABASE_ANON_KEY=os.getenv('SUPABASE_ANON_KEY', ''),
        can_access=can_access
    )


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
