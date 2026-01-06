# ==========================================================
# records_bp.py — Records Page Blueprint (CSV-driven UI)
# ==========================================================

from flask import Blueprint, render_template
from flask_login import login_required

# ----------------------------------------------------------
# BLUEPRINT INITIALIZATION (THIS WAS MISSING)
# ----------------------------------------------------------
records_bp = Blueprint(
    "records_bp",
    __name__,
    url_prefix="/records"
)

# ----------------------------------------------------------
# RECORDS PAGE ONLY
# ----------------------------------------------------------
@records_bp.route("/", methods=["GET"])
@login_required
def records_page():
    """
    Renders the Patient Records Workspace.
    Data loading is handled entirely on the frontend via CSV + JS.
    """
    return render_template("records.html")
