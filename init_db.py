# init_db.py
from db import engine
from models import Base

print("🚀 Creating missing database tables...")
Base.metadata.create_all(bind=engine)
print("✅ Done.")
