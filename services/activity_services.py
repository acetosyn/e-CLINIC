# ==========================================================
# Activity Services — activity_services.py
# ==========================================================

from datetime import datetime, date
from db import db_session
from models import Activity
from sqlalchemy import desc

# Fetch all activities from today
def get_today_activities():
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())

    activities = (
        db_session.query(Activity)
        .filter(Activity.created_at >= today_start)
        .order_by(desc(Activity.created_at))
        .all()
    )

    return [a.to_dict() for a in activities]

# Remove older activity logs
def cleanup_old_activities():
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())

    deleted = (
        db_session.query(Activity)
        .filter(Activity.created_at < today_start)
        .delete()
    )

    db_session.commit()
    return deleted
