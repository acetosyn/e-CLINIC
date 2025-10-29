# ==========================================================
# EPICONSULT e-CLINIC — Flask App (app.py)
# Auth + Routing using db.py
# ==========================================================
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from db import init_db, verify_user
import os

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
# HOME (Protected)
# ------------------------------
@app.route('/home')
def home():
    if "user" not in session:
        return redirect(url_for('login'))
    return render_template('home.html', user=session["user"], role=session["role"])

# ------------------------------
# OTHER ROUTES (Protected)
# ------------------------------
def require_login():
    if "user" not in session:
        return redirect(url_for('login'))

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

@app.route('/inventory')
def inventory():
    return require_login() or render_template('inventory.html')

@app.route('/reports')
def reports():
    return require_login() or render_template('reports.html')

@app.route('/settings')
def settings():
    return require_login() or render_template('settings.html')

# ------------------------------
# ENTRY POINT
# ------------------------------
if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)
