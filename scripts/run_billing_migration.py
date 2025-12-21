#!/usr/bin/env python3
"""
Run the atomic billing and usage caps migration against Supabase.

Usage:
  python scripts/run_billing_migration.py

Requires DATABASE_URL environment variable or will prompt for connection string.
"""

import os
import sys

def run_migration():
    try:
        import psycopg2
    except ImportError:
        print("Installing psycopg2-binary...")
        os.system(f"{sys.executable} -m pip install psycopg2-binary")
        import psycopg2

    # Database connection string
    database_url = os.environ.get('DATABASE_URL')

    if not database_url:
        print("\n" + "="*60)
        print("DATABASE_URL not found in environment.")
        print("="*60)
        print("\nYou can find it in:")
        print("  Supabase Dashboard > Settings > Database > Connection string")
        print("\nFormat: postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres")
        print("\n(Or set DATABASE_URL environment variable before running)")
        database_url = input("\nEnter DATABASE_URL: ").strip()

    if not database_url:
        print("No database URL provided. Exiting.")
        return False

    # Read migration file
    migration_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'supabase', 'migrations', '20251221000000_atomic_billing_and_usage_caps.sql'
    )

    if not os.path.exists(migration_path):
        print(f"❌ Migration file not found: {migration_path}")
        return False

    with open(migration_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    print(f"\nConnecting to database...")

    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = True
        cursor = conn.cursor()

        print("Executing billing migration...")
        print("  - Creating increment_query_usage() function")
        print("  - Creating check_and_increment_usage() function")
        print("  - Creating record_token_usage() function")
        print("  - Adding daily usage tracking columns")

        cursor.execute(sql)

        print("\n✅ Migration completed successfully!")

        # Verify functions exist
        cursor.execute("""
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_schema = 'public'
            AND routine_name IN ('increment_query_usage', 'check_and_increment_usage', 'record_token_usage')
        """)
        functions = [row[0] for row in cursor.fetchall()]
        print(f"   - Functions created: {', '.join(functions)}")

        # Check new columns
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'user_profiles'
            AND column_name IN ('queries_used_today', 'daily_reset_at', 'total_tokens_used', 'tokens_used_this_period')
        """)
        columns = [row[0] for row in cursor.fetchall()]
        print(f"   - New columns added: {', '.join(columns)}")

        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("="*60)
    print("BILLING SECURITY MIGRATION")
    print("Fixes: Race conditions, adds usage caps, token tracking")
    print("="*60)
    success = run_migration()
    sys.exit(0 if success else 1)
