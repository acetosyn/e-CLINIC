# ==========================================================
# EPICONSULT e-CLINIC — Delete Test Patients Script
# Removes all patients where is_test = True
# ==========================================================

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import db_session
from models import Patient

def delete_test_patients():
    """Delete all patients marked as test patients (is_test = True)."""
    
    if not db_session:
        print("[ERROR] Database session not available. Check your .env configuration.")
        return False
    
    try:
        # First, count how many test patients exist
        test_patients = db_session.query(Patient).filter(Patient.is_test == True).all()
        count = len(test_patients)
        
        if count == 0:
            print("[OK] No test patients found in the database.")
            return True
        
        # Show what will be deleted
        print(f"\n[INFO] Found {count} test patient(s) to delete:\n")
        print("-" * 60)
        for i, patient in enumerate(test_patients, 1):
            print(f"  {i}. {patient.first_name} {patient.last_name}")
            print(f"     File No: {patient.file_no}")
            print(f"     Patient ID: {patient.patient_id}")
            print(f"     Created: {patient.created_at}")
            print()
        print("-" * 60)
        
        # Confirm deletion
        confirm = input(f"\n[WARNING] Are you sure you want to DELETE all {count} test patient(s)? (yes/no): ").strip().lower()
        
        if confirm != 'yes':
            print("[CANCELLED] Deletion cancelled.")
            return False
        
        # Delete all test patients
        deleted_count = db_session.query(Patient).filter(Patient.is_test == True).delete()
        db_session.commit()
        
        print(f"\n[SUCCESS] Deleted {deleted_count} test patient(s).")
        return True
        
    except Exception as e:
        print(f"[ERROR] Error deleting test patients: {str(e)}")
        db_session.rollback()
        return False


def delete_test_patients_no_confirm():
    """Delete all test patients without confirmation (use with caution)."""
    
    if not db_session:
        print("[ERROR] Database session not available.")
        return False
    
    try:
        count = db_session.query(Patient).filter(Patient.is_test == True).count()
        
        if count == 0:
            print("[OK] No test patients found.")
            return True
        
        deleted_count = db_session.query(Patient).filter(Patient.is_test == True).delete()
        db_session.commit()
        
        print(f"[SUCCESS] Deleted {deleted_count} test patient(s).")
        return True
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        db_session.rollback()
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("  EPICONSULT e-CLINIC - Delete Test Patients")
    print("=" * 60)
    print("\nThis script will delete all patients where is_test = True")
    print("These are test/dummy patients, not real patient records.\n")
    
    # Check for --force flag
    if len(sys.argv) > 1 and sys.argv[1] == '--force':
        print("[WARNING] Running with --force flag (no confirmation)\n")
        delete_test_patients_no_confirm()
    else:
        delete_test_patients()

