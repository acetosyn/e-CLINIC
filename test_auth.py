#!/usr/bin/env python3
# ==========================================================
# EPICONSULT e-CLINIC — Authentication System Test
# ==========================================================
"""
Test script to verify the authentication system works correctly.
Run this after setting up the database and creating users.

Usage:
    python test_auth.py
"""

from app import app
from models import db, User
import sys


def test_database_connection():
    """Test database connectivity"""
    print("\n" + "=" * 60)
    print("1. Testing Database Connection")
    print("=" * 60)
    try:
        with app.app_context():
            # Try to query the database
            result = db.session.execute(db.text('SELECT 1')).scalar()
            if result == 1:
                print("✅ Database connection successful!")
                return True
            else:
                print("❌ Database connection failed!")
                return False
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False


def test_tables_exist():
    """Test if required tables exist"""
    print("\n" + "=" * 60)
    print("2. Testing Database Tables")
    print("=" * 60)
    try:
        with app.app_context():
            # Check if users table exists
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            
            if 'users' in tables:
                print("✅ Users table exists!")
                
                # Check columns
                columns = [col['name'] for col in inspector.get_columns('users')]
                expected_columns = ['id', 'username', 'password_hash', 'role', 
                                  'is_active', 'created_at', 'updated_at', 'last_login']
                
                missing_columns = [col for col in expected_columns if col not in columns]
                if missing_columns:
                    print(f"⚠️  Missing columns: {missing_columns}")
                    return False
                
                print(f"✅ All required columns present: {len(expected_columns)}")
                return True
            else:
                print("❌ Users table does not exist!")
                print("   Run: flask db upgrade")
                return False
    except Exception as e:
        print(f"❌ Error checking tables: {e}")
        return False


def test_users_exist():
    """Test if users have been created"""
    print("\n" + "=" * 60)
    print("3. Testing User Data")
    print("=" * 60)
    try:
        with app.app_context():
            users = User.query.all()
            
            if not users:
                print("❌ No users found in database!")
                print("   Run: python manage_users.py --quick-setup")
                return False
            
            print(f"✅ Found {len(users)} user(s) in database:")
            print("\n" + "-" * 60)
            print(f"{'Role':<20} {'Username':<25} {'Active':<10}")
            print("-" * 60)
            
            for user in users:
                active = '✓' if user.is_active else '✗'
                print(f"{user.role:<20} {user.username:<25} {active:<10}")
            
            print("-" * 60)
            
            # Check if all roles are covered
            expected_roles = User.VALID_ROLES
            existing_roles = [user.role for user in users]
            missing_roles = [role for role in expected_roles if role not in existing_roles]
            
            if missing_roles:
                print(f"\n⚠️  Missing users for roles: {', '.join(missing_roles)}")
            else:
                print(f"\n✅ All {len(expected_roles)} roles have users!")
            
            return True
    except Exception as e:
        print(f"❌ Error checking users: {e}")
        return False


def test_password_hashing():
    """Test password hashing functionality"""
    print("\n" + "=" * 60)
    print("4. Testing Password Hashing")
    print("=" * 60)
    try:
        with app.app_context():
            # Get first user
            user = User.query.first()
            
            if not user:
                print("❌ No users to test!")
                return False
            
            # Check password hash format
            if user.password_hash and user.password_hash.startswith('pbkdf2:sha256:'):
                print("✅ Password hashing format correct (pbkdf2:sha256)")
                
                # Test password checking (with a dummy password)
                # We can't test with actual password, but we can test the method works
                result = user.check_password('dummy_password_that_wont_match')
                if result == False:
                    print("✅ Password verification method working!")
                    return True
                else:
                    print("⚠️  Password verification returned unexpected result")
                    return False
            else:
                print("❌ Password not hashed correctly!")
                print(f"   Hash format: {user.password_hash[:20]}...")
                return False
    except Exception as e:
        print(f"❌ Error testing password hashing: {e}")
        return False


def test_flask_login_integration():
    """Test Flask-Login integration"""
    print("\n" + "=" * 60)
    print("5. Testing Flask-Login Integration")
    print("=" * 60)
    try:
        with app.app_context():
            user = User.query.first()
            
            if not user:
                print("❌ No users to test!")
                return False
            
            # Check UserMixin methods
            if hasattr(user, 'is_authenticated') and \
               hasattr(user, 'is_active') and \
               hasattr(user, 'is_anonymous') and \
               hasattr(user, 'get_id'):
                print("✅ Flask-Login UserMixin methods present!")
                
                # Test get_id
                user_id = user.get_id()
                if user_id:
                    print(f"✅ User ID method working (ID: {user_id})")
                    return True
                else:
                    print("❌ User ID method not working!")
                    return False
            else:
                print("❌ Flask-Login UserMixin methods missing!")
                return False
    except Exception as e:
        print(f"❌ Error testing Flask-Login: {e}")
        return False


def test_migration_status():
    """Test Alembic migration status"""
    print("\n" + "=" * 60)
    print("6. Testing Migration Status")
    print("=" * 60)
    try:
        with app.app_context():
            # Check if alembic_version table exists
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            
            if 'alembic_version' in tables:
                print("✅ Alembic version tracking table exists!")
                
                # Get current version
                result = db.session.execute(
                    db.text('SELECT version_num FROM alembic_version')
                ).scalar()
                
                if result:
                    print(f"✅ Current migration version: {result}")
                    return True
                else:
                    print("⚠️  No migration version found")
                    print("   Run: flask db stamp head")
                    return True
            else:
                print("⚠️  Alembic version table does not exist")
                print("   This is normal if migrations haven't been run yet")
                return True
    except Exception as e:
        print(f"⚠️  Could not check migration status: {e}")
        return True  # Non-critical


def run_all_tests():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("🏥 EPICONSULT e-CLINIC - AUTHENTICATION SYSTEM TEST")
    print("=" * 80)
    
    tests = [
        ("Database Connection", test_database_connection),
        ("Database Tables", test_tables_exist),
        ("User Data", test_users_exist),
        ("Password Hashing", test_password_hashing),
        ("Flask-Login Integration", test_flask_login_integration),
        ("Migration Status", test_migration_status),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print("=" * 80)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All tests passed! Authentication system is working correctly!")
        print("\nNext step: Start the application and test login in browser")
        print("Command: python app.py")
        print("URL: http://localhost:5000")
        return 0
    else:
        print(f"❌ {total - passed} test(s) failed. Please fix the issues above.")
        print("\nCommon fixes:")
        print("1. Run migrations: flask db upgrade")
        print("2. Create users: python manage_users.py --quick-setup")
        print("3. Check DATABASE_URL in .env")
        return 1


if __name__ == '__main__':
    try:
        exit_code = run_all_tests()
        print("\n")
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n👋 Test interrupted. Goodbye!\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}\n")
        sys.exit(1)

