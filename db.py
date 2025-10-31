# ==========================================================
# EPICONSULT e-CLINIC — Database Utility (db.py)
# ⚠️ DEPRECATED - This file is no longer used
# ==========================================================
# 
# This file has been replaced by:
# - models.py        : SQLAlchemy database models
# - config.py        : Database configuration
# - manage_users.py  : User management CLI
#
# The new implementation uses:
# - PostgreSQL/Supabase instead of SQLite
# - Flask-Login for session management
# - Hashed passwords instead of plain text
# - Alembic for database migrations
#
# This file is kept for reference only.
# You can safely delete it if desired.
#
# To use the new system:
# 1. Run migrations: flask db upgrade
# 2. Create users: python manage_users.py --quick-setup
# 3. Start app: python app.py
#
# For more information, see:
# - QUICKSTART.md
# - DATABASE_SETUP.md
# - IMPLEMENTATION_SUMMARY.md
#
# ==========================================================

# Old SQLite-based implementation below (DO NOT USE)
# ----------------------------------------------------------

import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()
DB_PATH = "database.db"

def init_db():
    """DEPRECATED: Use 'flask db upgrade' instead"""
    print("⚠️  WARNING: This function is deprecated.")
    print("   Use the new migration system:")
    print("   flask db migrate -m 'message'")
    print("   flask db upgrade")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    """)
    conn.commit()

    roles = [
        ("Admin", "ADMIN"),
        ("HOP", "HOP"),
        ("Doctor", "DOCTOR"),
        ("Pharmacy", "PHARMACY"),
        ("Inventory", "INVENTORY"),
        ("Lab", "LAB"),
        ("Nursing", "NURSING"),
        ("Customer Care", "CUSTOMER"),
        ("Staff", "STAFF"),
    ]

    cur.execute("SELECT COUNT(*) FROM users")
    count = cur.fetchone()[0]
    if count == 0:
        users = []
        for role_name, key in roles:
            username = os.getenv(f"{key}_USER")
            password = os.getenv(f"{key}_PASS")
            if username and password:
                users.append((username, password, role_name))
        cur.executemany(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)", users
        )
        conn.commit()
        print("✅ Users seeded successfully.")

    conn.close()
    print("✅ e-Clinic Database initialized successfully.")


def verify_user(username, password, role):
    """DEPRECATED: Use verify_user_credentials() from models.py instead"""
    print("⚠️  WARNING: This function is deprecated.")
    print("   Use: verify_user_credentials(username, password, role) from models.py")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM users WHERE username=? AND password=? AND role=?",
        (username, password, role)
    )
    user = cur.fetchone()
    conn.close()
    return user
