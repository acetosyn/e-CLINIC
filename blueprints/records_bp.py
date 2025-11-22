# ==========================================================
# EPICONSULT — Patient Records API Blueprint (records_bp.py)
# Clean, Modular, Production-Ready
# ==========================================================

from flask import Blueprint, request, jsonify, render_template
from flask_login import login_required
from services.records import (
    search_patients,
    fetch_all_patients,
    fetch_single_patient,
    fetch_services
)

# ----------------------------------------------------------
# BLUEPRINT INITIALIZATION
# ----------------------------------------------------------
records_bp = Blueprint(
    "records_bp",
    __name__,
    url_prefix="/records"   # All routes now start with /records/...
)

# ----------------------------------------------------------
# RECORDS PAGE (loads records.html)
# ----------------------------------------------------------
@records_bp.route("/", methods=["GET"])
@login_required
def records_page():
    return render_template("records.html")


# ----------------------------------------------------------
# LIVE SEARCH
# ----------------------------------------------------------
@records_bp.route("/search", methods=["GET"])
@login_required
def api_search_patients():
    q = request.args.get("q", "")
    try:
        results = search_patients(q)
        return jsonify({"success": True, "results": results})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ----------------------------------------------------------
# GET ALL PATIENTS
# ----------------------------------------------------------
@records_bp.route("/all", methods=["GET"])
@login_required
def api_get_all():
    try:
        records = fetch_all_patients()
        return jsonify({"success": True, "records": records})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ----------------------------------------------------------
# GET SINGLE PATIENT
# ----------------------------------------------------------
@records_bp.route("/get/<identifier>", methods=["GET"])
@login_required
def api_get_one(identifier):
    try:
        patient = fetch_single_patient(identifier)
        return jsonify({"success": True, "patient": patient})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ----------------------------------------------------------
# GET ALL SERVICES
# ----------------------------------------------------------
@records_bp.route("/services", methods=["GET"])
@login_required
def api_services():
    try:
        services_data = fetch_services()
        return jsonify({"success": True, "services": services_data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
