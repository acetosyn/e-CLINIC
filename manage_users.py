#!/usr/bin/env python3
# ==========================================================
# EPICONSULT e-CLINIC — User Management Script
# Create and update role-based users with hashed passwords
# ==========================================================
"""
This script allows you to:
1. Create new users for each role with username and password
2. Update existing users' username and/or password
3. List all users in the system
4. Deactivate users

Usage:
    python manage_users.py
"""

from app import app, db
from models import User
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_or_update_user(username, password, role):
    """Create a new user or update existing user"""
    try:
        # Check if user exists
        existing_user = User.query.filter_by(role=role).first()
        
        if existing_user:
            # Update existing user
            old_username = existing_user.username
            existing_user.username = username
            existing_user.set_password(password)
            existing_user.is_active = True
            db.session.commit()
            logger.info(f"✅ Updated user for role '{role}': {old_username} → {username}")
            print(f"\n✅ SUCCESS: Updated user for role '{role}'")
            print(f"   Old username: {old_username}")
            print(f"   New username: {username}")
            print(f"   Password: Updated (hashed)")
        else:
            # Create new user
            user = User(username=username, role=role)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            logger.info(f"✅ Created new user: {username} ({role})")
            print(f"\n✅ SUCCESS: Created new user for role '{role}'")
            print(f"   Username: {username}")
            print(f"   Password: Set (hashed)")
        
        return True
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error creating/updating user: {e}")
        print(f"\n❌ ERROR: Failed to create/update user: {e}")
        return False


def list_users():
    """List all users in the system"""
    try:
        users = User.query.order_by(User.role, User.username).all()
        
        if not users:
            print("\n📋 No users found in the database.")
            return
        
        print("\n" + "=" * 80)
        print("📋 CURRENT USERS IN DATABASE")
        print("=" * 80)
        print(f"{'ID':<5} {'Role':<20} {'Username':<25} {'Active':<10} {'Last Login'}")
        print("-" * 80)
        
        for user in users:
            last_login = user.last_login.strftime('%Y-%m-%d %H:%M') if user.last_login else 'Never'
            active = '✓' if user.is_active else '✗'
            print(f"{user.id:<5} {user.role:<20} {user.username:<25} {active:<10} {last_login}")
        
        print("=" * 80)
        print(f"Total users: {len(users)}\n")
    
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        print(f"\n❌ ERROR: Failed to list users: {e}")


def deactivate_user(role):
    """Deactivate a user by role"""
    try:
        user = User.query.filter_by(role=role).first()
        
        if not user:
            print(f"\n❌ No user found with role '{role}'")
            return False
        
        user.is_active = False
        db.session.commit()
        logger.info(f"✅ Deactivated user: {user.username} ({role})")
        print(f"\n✅ SUCCESS: Deactivated user '{user.username}' ({role})")
        return True
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deactivating user: {e}")
        print(f"\n❌ ERROR: Failed to deactivate user: {e}")
        return False


def interactive_menu():
    """Interactive menu for user management"""
    valid_roles = User.VALID_ROLES
    
    while True:
        print("\n" + "=" * 80)
        print("🏥 EPICONSULT e-CLINIC - USER MANAGEMENT")
        print("=" * 80)
        print("1. Create/Update User")
        print("2. List All Users")
        print("3. Deactivate User")
        print("4. Exit")
        print("=" * 80)
        
        choice = input("\nEnter your choice (1-4): ").strip()
        
        if choice == '1':
            # Create/Update User
            print("\n" + "-" * 80)
            print("CREATE/UPDATE USER")
            print("-" * 80)
            print("Available roles:")
            for i, role in enumerate(valid_roles, 1):
                print(f"  {i}. {role}")
            print("-" * 80)
            
            role_choice = input(f"\nSelect role (1-{len(valid_roles)}): ").strip()
            
            try:
                role_index = int(role_choice) - 1
                if 0 <= role_index < len(valid_roles):
                    role = valid_roles[role_index]
                else:
                    print("❌ Invalid role selection!")
                    continue
            except ValueError:
                print("❌ Invalid input!")
                continue
            
            username = input(f"Enter username for {role}: ").strip()
            if not username:
                print("❌ Username cannot be empty!")
                continue
            
            password = input(f"Enter password for {role}: ").strip()
            if not password:
                print("❌ Password cannot be empty!")
                continue
            
            # Confirm
            print(f"\n📝 Summary:")
            print(f"   Role: {role}")
            print(f"   Username: {username}")
            print(f"   Password: {'*' * len(password)}")
            
            confirm = input("\nProceed? (yes/no): ").strip().lower()
            if confirm in ['yes', 'y']:
                create_or_update_user(username, password, role)
            else:
                print("❌ Operation cancelled.")
        
        elif choice == '2':
            # List Users
            list_users()
        
        elif choice == '3':
            # Deactivate User
            print("\n" + "-" * 80)
            print("DEACTIVATE USER")
            print("-" * 80)
            print("Available roles:")
            for i, role in enumerate(valid_roles, 1):
                print(f"  {i}. {role}")
            print("-" * 80)
            
            role_choice = input(f"\nSelect role to deactivate (1-{len(valid_roles)}): ").strip()
            
            try:
                role_index = int(role_choice) - 1
                if 0 <= role_index < len(valid_roles):
                    role = valid_roles[role_index]
                else:
                    print("❌ Invalid role selection!")
                    continue
            except ValueError:
                print("❌ Invalid input!")
                continue
            
            confirm = input(f"\n⚠️  Are you sure you want to deactivate the user for role '{role}'? (yes/no): ").strip().lower()
            if confirm in ['yes', 'y']:
                deactivate_user(role)
            else:
                print("❌ Operation cancelled.")
        
        elif choice == '4':
            # Exit
            print("\n👋 Goodbye!\n")
            break
        
        else:
            print("❌ Invalid choice! Please select 1-4.")


def quick_setup():
    """Quick setup - create all users from environment variables"""
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    print("\n" + "=" * 80)
    print("🚀 QUICK SETUP - Creating users from environment variables")
    print("=" * 80)
    
    role_mappings = [
        ("Admin", "ADMIN"),
        ("HOP", "HOP"),
        ("Doctor", "DOCTOR"),
        ("Pharmacy", "PHARMACY"),
        ("Inventory", "INVENTORY"),
        ("Lab", "LAB"),
        ("Nursing", "NURSING"),
        ("Customer Care", "CUSTOMER"),
        ("Staff", "STAFF"),
    ]
    
    success_count = 0
    for role_name, env_key in role_mappings:
        username = os.getenv(f"{env_key}_USER")
        password = os.getenv(f"{env_key}_PASS")
        
        if username and password:
            if create_or_update_user(username, password, role_name):
                success_count += 1
        else:
            print(f"⚠️  WARNING: Missing credentials for {role_name} in .env file")
    
    print("\n" + "=" * 80)
    print(f"✅ Quick setup complete! Created/Updated {success_count} users.")
    print("=" * 80 + "\n")


def main():
    """Main entry point"""
    with app.app_context():
        print("\n🏥 EPICONSULT e-CLINIC - User Management System")
        
        # Check if tables exist
        try:
            db.create_all()
            logger.info("Database tables verified/created")
        except Exception as e:
            logger.error(f"Error creating tables: {e}")
            print(f"\n❌ ERROR: Could not initialize database: {e}")
            print("Please check your database configuration in .env file\n")
            sys.exit(1)
        
        # Check if we should do quick setup
        if len(sys.argv) > 1 and sys.argv[1] == '--quick-setup':
            quick_setup()
            return
        
        # Run interactive menu
        try:
            interactive_menu()
        except KeyboardInterrupt:
            print("\n\n👋 Interrupted. Goodbye!\n")
            sys.exit(0)
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            print(f"\n❌ ERROR: {e}\n")
            sys.exit(1)


if __name__ == '__main__':
    main()


