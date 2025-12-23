/epiconsult_app
│
├── app.py                           # CLEAN entry point only (no business logic)
│
├── blueprints/                      # All route blueprints
│   ├── auth_bp.py                   # Login, Logout, Authentication
│   ├── main_bp.py                   # Home → department routing, dashboard, general pages
│   ├── departments_bp.py            # Department dashboards (doctor, nursing, lab...)
│   ├── api_bp.py                    # Health, activities, cleanup, register patient (API)
│   └── records_bp.py                # Patient records API (/records/search, /records/get...)
│
├── services/                        # Backend logic – NO Flask, NO rendering
│   ├── patient_services.py          # Patient CRUD, registering, data operations
│   ├── activity_services.py         # Activity logging + cleanup logic
│   ├── user_services.py             # User verification, user-related operations
│   ├── department_routes.py         # get_department_route() + role mappings
│   └── notifications_services.py    # (optional) Real-time notifications
│
├── utils/                           # Helpers & decorators used by blueprints
│   ├── decorators.py                # require_department, require_roles, require_unrestricted
│   ├── helpers.py                   # dated_url_for, inject_user_context, no-cache
│   └── logger.py                    # Centralized logging setup (optional)
│
├── privileges.py                    # PURE ROLE LOGIC ONLY (no Flask imports)
│                                     # normalize_role, can_access, is_unrestricted_role…
│
├── db.py                             # Database session, engine, verify_user, get_user_by_id
│
├── models/                           # SQLAlchemy models (User, Patient, Activity…)
│
├── templates/                        # HTML Jinja templates
│
└── static/                           # CSS, JS, images
