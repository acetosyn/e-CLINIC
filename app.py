# ==========================================================
# EPICONSULT e-CLINIC — Flask App (app.py)
# Auth + Routing + Privileges System Integration
# ==========================================================
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from db import init_db, verify_user
from privileges import can_access, department_accessible_pages  # ✅ NEW IMPORT
import os
from flask import g

# ------------------------------
# INITIAL SETUP
# ------------------------------
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "epiconsult-secret-key")

# Initialize DB if not exists
if not os.path.exists("database.db"):
    init_db()


# ------------------------------
# ROOT ROUTE
# ------------------------------
@app.route('/')
def index():
    if "user" not in session:
        return redirect(url_for('login'))
    return redirect(url_for('home'))


# ------------------------------
# LOGIN
# ------------------------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "").strip()

    user = verify_user(username, password, role)
    if user:
        session["user"] = username
        session["role"] = role
        session["allowed_pages"] = department_accessible_pages(role)
        return jsonify({"success": True, "message": f"Welcome {role}!"})
    else:
        return jsonify({"success": False, "message": "Invalid username or password."})


# ------------------------------
# LOGOUT
# ------------------------------
@app.route('/logout')
def logout():
    """Logs out the current user and redirects to login page."""
    session.clear()
    return redirect(url_for('login'))


# ------------------------------
# HELPER FUNCTIONS
# ------------------------------
def require_login():
    """Redirects to login page if session is not active."""
    if "user" not in session:
        return redirect(url_for('login'))


def check_access(department):
    """
    Checks backend privilege for a department page.
    Admins & Operations always have full access.
    """
    role = session.get("role", "")
    if not can_access(role, department):
        return render_template(
            "403.html",
            message=f"Access restricted — you can only access your {role} dashboard."
        )
    return None


# ------------------------------
# HOME (Protected)
# ------------------------------
@app.route('/home')
def home():
    if "user" not in session:
        return redirect(url_for('login'))
    return render_template('home.html', user=session["user"], role=session["role"])


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
def customer_care():
    """Customer Care main dashboard page."""

    # Step 1: verify login session
    if "user" not in session:
        return redirect(url_for('login'))

    # Step 2: allow only Customer Care users
    role = session.get("role", "").lower()
    if role != "customer care":
        return redirect(url_for('dashboard'))  # or 'home' — your choice

    # Step 3: define department context
    session['department'] = "Customer Care"

    # Step 4: render the departmental page
    return render_template(
        'customer_care.html',
        user=session.get("user"),
        role=role.title(),
        title="Customer Care — e-Clinic"
    )



@app.route('/doctor')
def doctor():
    access = check_access("doctor")
    if access:
        return access
    return render_template('doctor.html')

@app.route('/nursing')
def nursing():
    access = check_access("nursing")
    if access:
        return access
    return render_template('nursing.html')

@app.route('/laboratory')
def laboratory():
    access = check_access("laboratory")
    if access:
        return access
    return render_template('laboratory.html')

@app.route('/diagnostics')
def diagnostics():
    access = check_access("diagnostics")
    if access:
        return access
    return render_template('diagnostics.html')

@app.route('/inventory')
def inventory():
    access = check_access("inventory")
    if access:
        return access
    return render_template('inventory.html')

@app.route('/accounts')
def accounts():
    access = check_access("accounts")
    if access:
        return access
    return render_template('accounts.html')

@app.route('/it')
def it():
    access = check_access("it")
    if access:
        return access
    return render_template('it.html')

@app.route('/operations')
def operations():
    access = check_access("operations")
    if access:
        return access
    return render_template('operations.html')


# ------------------------------
# GENERAL / COMMON ROUTES
# ------------------------------
@app.route('/about')
def about():
    return require_login() or render_template('about.html')

@app.route('/services')
def services():
    return require_login() or render_template('services.html')

@app.route('/departments')
def departments():
    return require_login() or render_template('departments.html')

@app.route('/contact')
def contact():
    return require_login() or render_template('contact.html')

@app.route('/dashboard')
def dashboard():
    return require_login() or render_template('dashboard.html')

@app.route('/appointments')
def appointments():
    return require_login() or render_template('appointments.html')

@app.route('/patients')
def patients():
    return require_login() or render_template('patients.html')

@app.route('/reports')
def reports():
    return require_login() or render_template('reports.html')

@app.route('/settings')
def settings():
    return require_login() or render_template('settings.html')


# ------------------------------
# CUSTOM ERROR PAGE (403)
# ------------------------------
@app.errorhandler(403)
def forbidden_error(e):
    return render_template("403.html", message="Access denied — insufficient privileges."), 403


# ==========================================================
# CONTEXT PROCESSORS & CACHE CONTROL (Fix Chrome stale CSS)
# ==========================================================


# --- Inject current user (optional but harmless) ---
@app.context_processor
def inject_user():
    return dict(current_user=getattr(g, "user", None))

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
    app.run(debug=True, host="0.0.0.0", port=5000)
