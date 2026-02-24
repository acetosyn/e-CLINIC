# utils/helpers.py
import os
from flask import url_for
from flask_login import current_user

def dated_url_for(endpoint, **values):
    """
    Cache-bust static files (css/js/img) by appending ?v=<mtime>.
    """
    if endpoint == "static":
        filename = values.get("filename")
        if filename:
            file_path = os.path.join(os.path.dirname(__file__), "..", "static", filename)
            file_path = os.path.normpath(file_path)
            if os.path.isfile(file_path):
                values["v"] = int(os.stat(file_path).st_mtime)
    return url_for(endpoint, **values)


def inject_user_context():
    """
    Inject user context into templates safely.
    Avoids import-time issues and works even when not authenticated.
    """
    try:
        if not current_user or not current_user.is_authenticated:
            return {"user_context": None}

        # Import here (lazy import) to avoid circular import / import timing issues
        from utils.decorators import get_user_context
        return {"user_context": get_user_context()}

    except Exception:
        # Never break template rendering because of context issues
        return {"user_context": None}


def add_no_cache(response):
    """
    Disable caching for dynamic pages.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response
