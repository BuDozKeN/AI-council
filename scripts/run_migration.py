#!/usr/bin/env python3
"""
Run the company_members migration against Supabase.

Usage:
  python scripts/run_migration.py

Requires DATABASE_URL environment variable or will prompt for password.
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
    # Format: postgresql://postgres:[PASSWORD]@db.ywoodvmtbkinopixoyfc.supabase.co:5432/postgres
    database_url = os.environ.get('DATABASE_URL')

    if not database_url:
        print("\nDatabase URL not found in environment.")
        print("You can find it in Supabase Dashboard > Settings > Database > Connection string")
        print("\nFormat: postgresql://postgres:[PASSWORD]@db.ywoodvmtbkinopixoyfc.supabase.co:5432/postgres")
        database_url = input("\nEnter DATABASE_URL: ").strip()

    if not database_url:
        print("No database URL provided. Exiting.")
        return False

    # Read migration file
    migration_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'supabase', 'migrations', '20251220300000_company_members_and_usage.sql'
    )

    with open(migration_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    print(f"\nConnecting to database...")

    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = True
        cursor = conn.cursor()

        print("Executing migration...")
        cursor.execute(sql)

        print("\n✅ Migration completed successfully!")

        # Verify
        cursor.execute("SELECT COUNT(*) FROM company_members")
        count = cursor.fetchone()[0]
        print(f"   - company_members table created with {count} existing owners migrated")

        cursor.execute("SELECT COUNT(*) FROM usage_events")
        count = cursor.fetchone()[0]
        print(f"   - usage_events table created ({count} events)")

        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        return False

if __name__ == '__main__':
    success = run_migration()
    sys.exit(0 if success else 1)
