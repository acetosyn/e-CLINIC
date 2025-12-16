# ==========================================================
# EPICONSULT e-CLINIC — CHAT BLUEPRINT (chat_bp.py)
# Inter-department messaging API
# ==========================================================

from flask import Blueprint, request, jsonify, session
from flask_login import login_required
from sqlalchemy import or_, and_
from datetime import datetime

from db import db_session
from models import DepartmentMessage
from time import time

# simple in-memory typing registry (per worker)
TYPING_REGISTRY = {}

chat_bp = Blueprint("chat_bp", __name__, url_prefix="/api/chat")

# ----------------------------------------------------------
# VALID DEPARTMENTS (MUST MATCH department_routes.py)
# ----------------------------------------------------------
VALID_DEPARTMENTS = [
    "customer_care",
    "doctor",
    "nursing",
    "laboratory",
    "diagnostics",
    "inventory",
    "accounts",
    "it",
    "operations",
]

# ----------------------------------------------------------
# INTERNAL HELPER — ensure department exists in session
# ----------------------------------------------------------
def ensure_department():
    department = session.get("department")
    if not department:
        return None, jsonify({"error": "Department not set in session"}), 403
    return department, None, None


# ==========================================================
# GET AVAILABLE DEPARTMENTS (EXCLUDING SELF)
# ==========================================================
@chat_bp.route("/departments", methods=["GET"])
@login_required
def get_departments():
    me, error, status = ensure_department()
    if error:
        return error, status

    departments = [
        {
            "value": dept,
            "label": dept.replace("_", " ").title()
        }
        for dept in VALID_DEPARTMENTS
        if dept != me
    ]

    return jsonify(departments)


# ==========================================================
# SEND MESSAGE
# ==========================================================
@chat_bp.route("/send", methods=["POST"])
@login_required
def send_message():
    sender, error, status = ensure_department()
    if error:
        return error, status

    data = request.get_json(silent=True) or {}
    receiver = data.get("to")
    message = (data.get("message") or "").strip()

    # -------------------------------
    # VALIDATION
    # -------------------------------
    if not receiver or not message:
        return jsonify({
            "error": "Invalid message payload"
        }), 400

    if receiver == sender:
        return jsonify({
            "error": "Cannot message your own department"
        }), 400

    if receiver not in VALID_DEPARTMENTS:
        return jsonify({
            "error": "Invalid department"
        }), 400

    # -------------------------------
    # CREATE MESSAGE
    # -------------------------------
    msg = DepartmentMessage(
        sender_department=sender,
        receiver_department=receiver,
        message=message,
        created_at=datetime.utcnow()
    )

    try:
        db_session.add(msg)
        db_session.commit()

    except Exception as e:
        # 🔥 IMPORTANT: never swallow DB errors
        db_session.rollback()

        print("❌ CHAT SEND ERROR")
        print("Sender:", sender)
        print("Receiver:", receiver)
        print("Message:", message)
        print("Exception:", repr(e))

        return jsonify({
            "error": "Failed to send message",
            "detail": str(e)
        }), 500

    # -------------------------------
    # SUCCESS RESPONSE
    # -------------------------------
    return jsonify({
        "success": True,
        "message": msg.to_dict()
    }), 201


# ==========================================================
# FETCH CONVERSATION (2 DEPARTMENTS)
# ==========================================================
@chat_bp.route("/conversation", methods=["GET"])
@login_required
def get_conversation():
    me, error, status = ensure_department()
    if error:
        return error, status

    other = request.args.get("department")
    if not other or other == me:
        return jsonify([])

    messages = (
        db_session.query(DepartmentMessage)
        .filter(
            or_(
                and_(
                    DepartmentMessage.sender_department == me,
                    DepartmentMessage.receiver_department == other
                ),
                and_(
                    DepartmentMessage.sender_department == other,
                    DepartmentMessage.receiver_department == me
                )
            )
        )
        .order_by(DepartmentMessage.created_at.asc())
        .all()
    )

    return jsonify([m.to_dict() for m in messages])


# ==========================================================
# FETCH RECENT CONVERSATIONS (HISTORY LIST)
# ==========================================================
@chat_bp.route("/history", methods=["GET"])
@login_required
def conversation_history():
    me, error, status = ensure_department()
    if error:
        return error, status

    messages = (
        db_session.query(DepartmentMessage)
        .filter(
            or_(
                DepartmentMessage.sender_department == me,
                DepartmentMessage.receiver_department == me
            )
        )
        .order_by(DepartmentMessage.created_at.desc())
        .limit(100)
        .all()
    )

    seen = set()
    history = []

    for msg in messages:
        other = (
            msg.receiver_department
            if msg.sender_department == me
            else msg.sender_department
        )

        if other in seen:
            continue

        seen.add(other)
        history.append({
            "department": other,
            "last_message": msg.message,
            "timestamp": msg.created_at.isoformat()
        })

    return jsonify(history)


# ==========================================================
# POLLING ENDPOINT — STRICT INBOUND ONLY (NO DUPLICATES)
# ==========================================================
@chat_bp.route("/poll", methods=["GET"])
@login_required
def poll_messages():
    me, error, status = ensure_department()
    if error:
        return error, status

    other = request.args.get("department")
    since = request.args.get("since")

    if not other or not since or other == me:
        return jsonify([])

    try:
        since_dt = datetime.fromisoformat(since)
    except ValueError:
        return jsonify([])

    messages = (
        db_session.query(DepartmentMessage)
        .filter(
            DepartmentMessage.sender_department == other,   # 🔒 ONLY from them
            DepartmentMessage.receiver_department == me,     # 🔒 ONLY to me
            DepartmentMessage.created_at > since_dt
        )
        .order_by(DepartmentMessage.created_at.asc())
        .all()
    )

    return jsonify([m.to_dict() for m in messages])




# ==========================================================
# INBOX — Messages sent TO me (no department selection)
# ==========================================================
@chat_bp.route("/inbox", methods=["GET"])
@login_required
def inbox_messages():
    me, error, status = ensure_department()
    if error:
        return error, status

    messages = (
        db_session.query(DepartmentMessage)
        .filter(
            DepartmentMessage.receiver_department == me
        )
        .order_by(DepartmentMessage.created_at.asc())
        .limit(50)
        .all()
    )

    return jsonify([m.to_dict() for m in messages])



# ==========================================================
# CLEAR CONVERSATION — HARD DELETE (ME ↔ OTHER)
# ==========================================================
@chat_bp.route("/clear", methods=["DELETE"])
@login_required
def clear_conversation():
    me, error, status = ensure_department()
    if error:
        return error, status

    data = request.get_json(silent=True) or {}
    other = data.get("department")

    if not other or other == me:
        return jsonify({
            "error": "Invalid department"
        }), 400

    try:
        deleted = (
            db_session.query(DepartmentMessage)
            .filter(
                or_(
                    and_(
                        DepartmentMessage.sender_department == me,
                        DepartmentMessage.receiver_department == other
                    ),
                    and_(
                        DepartmentMessage.sender_department == other,
                        DepartmentMessage.receiver_department == me
                    )
                )
            )
            .delete(synchronize_session=False)
        )

        db_session.commit()

        return jsonify({
            "success": True,
            "deleted_count": deleted
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({
            "error": "Failed to clear conversation",
            "detail": str(e)
        }), 500



# ==========================================================
# TYPING INDICATOR (EPHEMERAL — NO DB)
# ==========================================================

@chat_bp.route("/typing", methods=["POST"])
@login_required
def typing_signal():
    me, error, status = ensure_department()
    if error:
        return error, status

    data = request.get_json(silent=True) or {}
    other = data.get("to")

    if not other or other == me:
        return jsonify({"ok": True})

    # store typing timestamp (expires fast)
    TYPING_REGISTRY[(me, other)] = time()
    return jsonify({"ok": True})


@chat_bp.route("/typing-status", methods=["GET"])
@login_required
def typing_status():
    me, error, status = ensure_department()
    if error:
        return error, status

    other = request.args.get("department")
    if not other:
        return jsonify({"typing": False})

    now = time()
    key = (other, me)

    # typing valid for last 2 seconds
    typing = key in TYPING_REGISTRY and (now - TYPING_REGISTRY[key]) < 2.5

    return jsonify({"typing": typing})
