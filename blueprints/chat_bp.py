# ==========================================================
# EPICONSULT e-CLINIC — CHAT BLUEPRINT (chat_bp.py)
# Inter-department messaging API
#
# Fixes:
# - Canonical department mismatch (customer_care -> reception, nursing -> nurse, etc.)
# Adds:
# - /poll-inbox for live inbox updates (no refresh)
# - /threads for multi-sender inbox handling
# - /reply for replying from inbox without selecting dropdown
# ==========================================================

from __future__ import annotations

from flask import Blueprint, request, jsonify, session
from flask_login import login_required
from sqlalchemy import or_, and_, desc
from datetime import datetime
from time import time

from db import db_session
from models import DepartmentMessage
from constants import canonical_department  # ✅ you already use this elsewhere


chat_bp = Blueprint("chat_bp", __name__, url_prefix="/api/chat")

# ----------------------------------------------------------
# Typing indicator registry (per worker)
# ----------------------------------------------------------
TYPING_REGISTRY = {}

# ----------------------------------------------------------
# Canonical Departments (MUST match what session["department"] becomes)
# (Based on your departments_bp.py routes)
# ----------------------------------------------------------
CANONICAL_DEPARTMENTS = [
    "reception",         # customer_care -> reception
    "doctor",
    "medical_officer",
    "nurse",             # not "nursing"
    "laboratory",
    "diagnostics",
    "inventory",
    "accountant",        # not "accounts"
    "it",
    "operations",
    "bdu",
    "security_support",
]

# Optional: accept legacy values from older UI/DB and normalize them
DEPT_ALIASES = {
    "customer_care": "reception",
    "nursing": "nurse",
    "accounts": "accountant",
    "accountant": "accountant",
    "reception": "reception",
}

# ----------------------------------------------------------
# Helpers
# ----------------------------------------------------------
def normalize_dept(value: str | None) -> str | None:
    """
    Normalize any input dept (payload/query/session/db legacy) into canonical slug.
    Returns None if empty.
    """
    if not value:
        return None
    v = canonical_department(value)  # your canonicalizer (already handles some aliases)
    v = DEPT_ALIASES.get(v, v)       # ensure our aliases are enforced
    return v


def ensure_department():
    """
    Ensures department exists in session and is canonical.
    """
    department = normalize_dept(session.get("department"))
    if not department:
        return None, jsonify({"error": "Department not set in session"}), 403

    # If session had a legacy dept, normalize it in-session too
    if session.get("department") != department:
        session["department"] = department
        session.modified = True

    return department, None, None


def parse_since_iso(since: str | None) -> datetime | None:
    """
    Robust ISO parser: returns None if invalid.
    """
    if not since:
        return None
    try:
        return datetime.fromisoformat(since)
    except Exception:
        return None


# ==========================================================
# 1) GET AVAILABLE DEPARTMENTS (EXCLUDING SELF)
# ==========================================================
@chat_bp.route("/departments", methods=["GET"])
@login_required
def get_departments():
    me, error, status = ensure_department()
    if error:
        return error, status

    departments = [
        {"value": d, "label": d.replace("_", " ").title()}
        for d in CANONICAL_DEPARTMENTS
        if d != me
    ]
    return jsonify(departments)


# ==========================================================
# 2) SEND MESSAGE
# ==========================================================
@chat_bp.route("/send", methods=["POST"])
@login_required
def send_message():
    sender, error, status = ensure_department()
    if error:
        return error, status

    data = request.get_json(silent=True) or {}
    receiver = normalize_dept(data.get("to"))
    message = (data.get("message") or "").strip()

    # Validation
    if not receiver or not message:
        return jsonify({"error": "Invalid message payload"}), 400

    if receiver == sender:
        return jsonify({"error": "Cannot message your own department"}), 400

    if receiver not in CANONICAL_DEPARTMENTS:
        return jsonify({"error": "Invalid department"}), 400

    msg = DepartmentMessage(
        sender_department=sender,
        receiver_department=receiver,
        message=message,
        created_at=datetime.utcnow(),
    )

    try:
        db_session.add(msg)
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        return jsonify({"error": "Failed to send message", "detail": str(e)}), 500

    return jsonify({"success": True, "message": msg.to_dict()}), 201


# ==========================================================
# 3) REPLY (FROM INBOX WITHOUT DROPDOWN SELECTION)
#    Options:
#    A) { "reply_to": "doctor", "message": "..." }
#    B) { "message_id": 123, "message": "..." }  # replies to sender of that message
# ==========================================================
@chat_bp.route("/reply", methods=["POST"])
@login_required
def reply_message():
    me, error, status = ensure_department()
    if error:
        return error, status

    data = request.get_json(silent=True) or {}
    text = (data.get("message") or "").strip()

    if not text:
        return jsonify({"error": "Message is required"}), 400

    # Option A: reply_to provided
    reply_to = normalize_dept(data.get("reply_to"))

    # Option B: infer reply_to from message_id
    if not reply_to:
        mid = data.get("message_id")
        if mid is not None:
            try:
                mid_int = int(mid)
            except Exception:
                return jsonify({"error": "Invalid message_id"}), 400

            original = (
                db_session.query(DepartmentMessage)
                .filter(DepartmentMessage.id == mid_int)
                .first()
            )
            if not original:
                return jsonify({"error": "Message not found"}), 404

            # Only allow replying to a message that involved me
            orig_sender = normalize_dept(getattr(original, "sender_department", None))
            orig_receiver = normalize_dept(getattr(original, "receiver_department", None))

            if me not in (orig_sender, orig_receiver):
                return jsonify({"error": "Not allowed"}), 403

            # Reply goes to the other party (usually original sender)
            reply_to = orig_sender if orig_sender != me else orig_receiver

    if not reply_to or reply_to == me:
        return jsonify({"error": "Invalid reply target"}), 400

    if reply_to not in CANONICAL_DEPARTMENTS:
        return jsonify({"error": "Invalid department"}), 400

    msg = DepartmentMessage(
        sender_department=me,
        receiver_department=reply_to,
        message=text,
        created_at=datetime.utcnow(),
    )

    try:
        db_session.add(msg)
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        return jsonify({"error": "Failed to send reply", "detail": str(e)}), 500

    return jsonify({"success": True, "message": msg.to_dict()}), 201


# ==========================================================
# 4) FETCH CONVERSATION (ME <-> OTHER)
# ==========================================================
@chat_bp.route("/conversation", methods=["GET"])
@login_required
def get_conversation():
    me, error, status = ensure_department()
    if error:
        return error, status

    other = normalize_dept(request.args.get("department"))
    if not other or other == me:
        return jsonify([])

    if other not in CANONICAL_DEPARTMENTS:
        return jsonify([])

    messages = (
        db_session.query(DepartmentMessage)
        .filter(
            or_(
                and_(
                    DepartmentMessage.sender_department == me,
                    DepartmentMessage.receiver_department == other,
                ),
                and_(
                    DepartmentMessage.sender_department == other,
                    DepartmentMessage.receiver_department == me,
                ),
            )
        )
        .order_by(DepartmentMessage.created_at.asc())
        .all()
    )

    return jsonify([m.to_dict() for m in messages])


# ==========================================================
# 5) POLLING — INBOUND ONLY FOR ACTIVE CONVERSATION
#    /poll?department=doctor&since=ISO
# ==========================================================
@chat_bp.route("/poll", methods=["GET"])
@login_required
def poll_messages():
    me, error, status = ensure_department()
    if error:
        return error, status

    other = normalize_dept(request.args.get("department"))
    since_dt = parse_since_iso(request.args.get("since"))

    if not other or other == me or not since_dt:
        return jsonify([])

    if other not in CANONICAL_DEPARTMENTS:
        return jsonify([])

    messages = (
        db_session.query(DepartmentMessage)
        .filter(
            DepartmentMessage.sender_department == other,   # only from them
            DepartmentMessage.receiver_department == me,     # only to me
            DepartmentMessage.created_at > since_dt,
        )
        .order_by(DepartmentMessage.created_at.asc())
        .all()
    )

    return jsonify([m.to_dict() for m in messages])


# ==========================================================
# 6) INBOX — Messages sent TO me (latest N)
# ==========================================================
@chat_bp.route("/inbox", methods=["GET"])
@login_required
def inbox_messages():
    me, error, status = ensure_department()
    if error:
        return error, status

    limit = request.args.get("limit")
    try:
        limit = int(limit) if limit else 50
        limit = max(1, min(limit, 200))
    except Exception:
        limit = 50

    messages = (
        db_session.query(DepartmentMessage)
        .filter(DepartmentMessage.receiver_department == me)
        .order_by(DepartmentMessage.created_at.asc())
        .limit(limit)
        .all()
    )

    return jsonify([m.to_dict() for m in messages])


# ==========================================================
# 7) POLL INBOX — REAL-TIME INBOX UPDATES (MULTI-SENDER)
#    /poll-inbox?since=ISO
#    Returns all new messages sent TO me since timestamp, regardless of sender.
# ==========================================================
@chat_bp.route("/poll-inbox", methods=["GET"])
@login_required
def poll_inbox():
    me, error, status = ensure_department()
    if error:
        return error, status

    since_dt = parse_since_iso(request.args.get("since"))
    if not since_dt:
        # If caller has no since, return empty (caller should first load /inbox)
        return jsonify([])

    messages = (
        db_session.query(DepartmentMessage)
        .filter(
            DepartmentMessage.receiver_department == me,
            DepartmentMessage.created_at > since_dt,
        )
        .order_by(DepartmentMessage.created_at.asc())
        .all()
    )

    return jsonify([m.to_dict() for m in messages])


# ==========================================================
# 8) THREADS — MULTI-SENDER INBOX TRACKING
#    Returns latest message per sender department (who messaged me)
# ==========================================================
@chat_bp.route("/threads", methods=["GET"])
@login_required
def inbox_threads():
    """
    Provides a clean "who is messaging me" list.
    Frontend can show these as quick-reply targets without dropdown switching.
    """
    me, error, status = ensure_department()
    if error:
        return error, status

    # Get last 300 incoming messages, then compute latest per sender in Python
    # (simple + reliable, no fancy SQL window functions needed)
    incoming = (
        db_session.query(DepartmentMessage)
        .filter(DepartmentMessage.receiver_department == me)
        .order_by(desc(DepartmentMessage.created_at))
        .limit(300)
        .all()
    )

    seen = set()
    threads = []

    for msg in incoming:
        sender = normalize_dept(getattr(msg, "sender_department", None))
        if not sender or sender in seen:
            continue
        seen.add(sender)
        threads.append(
            {
                "department": sender,
                "label": sender.replace("_", " ").title(),
                "last_message": msg.message,
                "timestamp": msg.created_at.isoformat() if msg.created_at else None,
                "message_id": msg.id,
            }
        )

    # Newest threads first
    return jsonify(threads)


# ==========================================================
# 9) CLEAR CONVERSATION — HARD DELETE (ME ↔ OTHER)
# ==========================================================
@chat_bp.route("/clear", methods=["DELETE"])
@login_required
def clear_conversation():
    me, error, status = ensure_department()
    if error:
        return error, status

    data = request.get_json(silent=True) or {}
    other = normalize_dept(data.get("department"))

    if not other or other == me:
        return jsonify({"error": "Invalid department"}), 400

    if other not in CANONICAL_DEPARTMENTS:
        return jsonify({"error": "Invalid department"}), 400

    try:
        deleted = (
            db_session.query(DepartmentMessage)
            .filter(
                or_(
                    and_(
                        DepartmentMessage.sender_department == me,
                        DepartmentMessage.receiver_department == other,
                    ),
                    and_(
                        DepartmentMessage.sender_department == other,
                        DepartmentMessage.receiver_department == me,
                    ),
                )
            )
            .delete(synchronize_session=False)
        )

        db_session.commit()
        return jsonify({"success": True, "deleted_count": deleted})

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": "Failed to clear conversation", "detail": str(e)}), 500


# ==========================================================
# 10) TYPING INDICATOR (EPHEMERAL — NO DB)
# ==========================================================
@chat_bp.route("/typing", methods=["POST"])
@login_required
def typing_signal():
    me, error, status = ensure_department()
    if error:
        return error, status

    data = request.get_json(silent=True) or {}
    other = normalize_dept(data.get("to"))

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

    other = normalize_dept(request.args.get("department"))
    if not other:
        return jsonify({"typing": False})

    now = time()
    key = (other, me)
    typing = key in TYPING_REGISTRY and (now - TYPING_REGISTRY[key]) < 2.5
    return jsonify({"typing": typing})