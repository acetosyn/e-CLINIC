# utils/helpers.py

import os
from flask import url_for
from utils.decorators import get_user_context


def dated_url_for(endpoint, **values):
    """Auto-refresh CSS/JS."""
    if endpoint == "static":
        filename = values.get("filename")
        if filename:
            file_path = os.path.join("static", filename)
            if os.path.isfile(file_path):
                values["v"] = int(os.stat(file_path).st_mtime)
    return url_for(endpoint, **values)


def inject_user_context():
    """Makes user + privileges available in all templates."""
    return dict(user_context=get_user_context())


def add_no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response
