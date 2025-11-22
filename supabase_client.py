# ==========================================================
# Supabase Client — supabase_client.py (Clean Version)
# ==========================================================
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # server key

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("ERROR: Missing Supabase credentials in .env")

def init_supabase() -> Client:
    """Initialize and return a Supabase client."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Global client for the entire backend
supabase = init_supabase()
