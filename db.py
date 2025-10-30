# ==========================================================
# EPICONSULT e-CLINIC — Database Utility (db.py)
# Full Role Coverage + Robust Login Matching
# ==========================================================
import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()
DB_PATH = "database.db"


# ----------------------------------------------------------
# INITIALIZE DATABASE (Users + Roles)
# ----------------------------------------------------------
def init_db():
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

    # ✅ Updated roles — includes Accounts & Diagnostics
    roles = [
        ("Admin", "ADMIN"),
        ("HOP", "HOP"),
        ("Doctor", "DOCTOR"),
        ("Pharmacy", "PHARMACY"),
        ("Inventory", "INVENTORY"),
        ("Lab", "LAB"),
        ("Diagnostics", "DIAGNOSTICS"),
        ("Accounts", "ACCOUNTS"),
        ("Nursing", "NURSING"),
        ("Customer Care", "CUSTOMER"),
        ("Staff", "STAFF"),
    ]

    # Insert users from .env if DB empty
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


# ----------------------------------------------------------
# VERIFY USER LOGIN
# ----------------------------------------------------------
def verify_user(username, password, role):
    """Verifies user credentials (case-insensitive match)."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM users 
        WHERE LOWER(username)=LOWER(?) 
        AND password=? 
        AND LOWER(role)=LOWER(?)
    """, (username, password, role))
    user = cur.fetchone()
    conn.close()
    return user
