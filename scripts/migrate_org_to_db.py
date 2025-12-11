#!/usr/bin/env python3
"""
Phase 2: Migrate organization data from files to database.

This script reads the file-based organization structure (config.json + markdown files)
and migrates it to the new Supabase database tables.

Usage:
    python scripts/migrate_org_to_db.py

Or with a specific company:
    python scripts/migrate_org_to_db.py --company axcouncil
"""

import json
import sys
import argparse
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.database import get_supabase_service, get_supabase


def get_client():
    """Get the best available Supabase client (service preferred for migrations)."""
    client = get_supabase_service()
    if client:
        print("[INFO] Using service client (bypasses RLS)")
        return client

    client = get_supabase()
    print("[WARN] Using anon client - RLS may restrict operations")
    return client


def load_config(company_slug: str) -> dict:
    """Load config.json for a company."""
    config_path = Path(__file__).parent.parent / "councils" / "organisations" / company_slug / "config.json"

    if not config_path.exists():
        raise FileNotFoundError(f"Config not found: {config_path}")

    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_role_markdown(company_slug: str, dept_slug: str, role_slug: str) -> str | None:
    """Load the markdown system prompt for a role."""
    role_path = (
        Path(__file__).parent.parent / "councils" / "organisations" / company_slug /
        "departments" / dept_slug / "roles" / f"{role_slug}.md"
    )

    if role_path.exists():
        with open(role_path, 'r', encoding='utf-8') as f:
            return f.read()

    return None


def load_department_context(company_slug: str, dept_slug: str) -> str | None:
    """Load the context.md for a department."""
    context_path = (
        Path(__file__).parent.parent / "councils" / "organisations" / company_slug /
        "departments" / dept_slug / "context.md"
    )

    if context_path.exists():
        with open(context_path, 'r', encoding='utf-8') as f:
            return f.read()

    return None


def get_company_uuid(client, company_slug: str) -> str | None:
    """Look up company UUID by slug."""
    result = client.table("companies").select("id").eq("slug", company_slug).execute()

    if result.data and len(result.data) > 0:
        return result.data[0]["id"]

    return None


def migrate_company(client, company_slug: str, dry_run: bool = False):
    """Migrate a single company's organization data."""
    print(f"\n{'='*60}")
    print(f"Migrating: {company_slug}")
    print(f"{'='*60}")

    # Get company UUID
    company_id = get_company_uuid(client, company_slug)
    if not company_id:
        print(f"[ERROR] Company '{company_slug}' not found in database")
        print("[TIP] Make sure the company exists in the 'companies' table")
        return False

    print(f"[OK] Found company: {company_id}")

    # Load config
    try:
        config = load_config(company_slug)
    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        return False

    departments = config.get("departments", [])
    print(f"[INFO] Found {len(departments)} departments in config.json")

    # Check for existing data
    existing_depts = client.table("departments").select("id").eq("company_id", company_id).execute()
    if existing_depts.data and len(existing_depts.data) > 0:
        print(f"[WARN] Company already has {len(existing_depts.data)} departments in DB")
        response = input("Delete existing data and re-migrate? (y/N): ")
        if response.lower() != 'y':
            print("[SKIP] Skipping migration")
            return False

        # Delete existing data (cascades to roles)
        if not dry_run:
            client.table("departments").delete().eq("company_id", company_id).execute()
            print("[OK] Deleted existing departments")

    # Migrate departments and roles
    for dept_order, dept in enumerate(departments):
        dept_slug = dept.get("id", "")
        dept_name = dept.get("name", dept_slug)
        dept_desc = dept.get("description", "")

        # Load department context as purpose
        dept_context = load_department_context(company_slug, dept_slug)
        dept_purpose = dept_context[:500] if dept_context else None  # Truncate for purpose field

        print(f"\n[DEPT] {dept_name} ({dept_slug})")

        if dry_run:
            print(f"  [DRY RUN] Would insert department")
        else:
            # Insert department
            dept_result = client.table("departments").insert({
                "company_id": company_id,
                "name": dept_name,
                "slug": dept_slug,
                "description": dept_desc,
                "purpose": dept_purpose,
                "display_order": dept_order
            }).execute()

            if not dept_result.data:
                print(f"  [ERROR] Failed to insert department")
                continue

            dept_id = dept_result.data[0]["id"]
            print(f"  [OK] Created department: {dept_id}")

        # Migrate roles
        roles = dept.get("roles", [])
        for role_order, role in enumerate(roles):
            role_slug = role.get("id", "")
            role_name = role.get("name", role_slug)
            role_desc = role.get("description", "")

            # Load system prompt from markdown
            system_prompt = load_role_markdown(company_slug, dept_slug, role_slug)
            prompt_status = f"({len(system_prompt)} chars)" if system_prompt else "(no file)"

            print(f"    [ROLE] {role_name} ({role_slug}) {prompt_status}")

            if dry_run:
                print(f"      [DRY RUN] Would insert role")
            else:
                # Insert role
                role_result = client.table("roles").insert({
                    "company_id": company_id,
                    "department_id": dept_id,
                    "name": role_name,
                    "slug": role_slug,
                    "title": role_name,
                    "responsibilities": role_desc,
                    "system_prompt": system_prompt,
                    "display_order": role_order
                }).execute()

                if role_result.data:
                    print(f"      [OK] Created role: {role_result.data[0]['id']}")
                else:
                    print(f"      [ERROR] Failed to insert role")

    print(f"\n[DONE] Migration complete for {company_slug}")
    return True


def list_available_companies() -> list[str]:
    """List all available company folders."""
    orgs_path = Path(__file__).parent.parent / "councils" / "organisations"

    if not orgs_path.exists():
        return []

    return [d.name for d in orgs_path.iterdir() if d.is_dir() and (d / "config.json").exists()]


def main():
    parser = argparse.ArgumentParser(description="Migrate organization data from files to database")
    parser.add_argument("--company", "-c", help="Company slug to migrate (default: all)")
    parser.add_argument("--dry-run", "-n", action="store_true", help="Show what would be done without making changes")
    parser.add_argument("--list", "-l", action="store_true", help="List available companies")
    args = parser.parse_args()

    if args.list:
        companies = list_available_companies()
        print("Available companies:")
        for c in companies:
            print(f"  - {c}")
        return

    print("="*60)
    print("Organization Migration: Files → Database")
    print("="*60)

    if args.dry_run:
        print("[MODE] DRY RUN - no changes will be made")

    # Get Supabase client
    try:
        client = get_client()
    except Exception as e:
        print(f"[ERROR] Failed to connect to Supabase: {e}")
        print("[TIP] Make sure SUPABASE_URL and SUPABASE_KEY are set in .env")
        sys.exit(1)

    # Get companies to migrate
    if args.company:
        companies = [args.company]
    else:
        companies = list_available_companies()

    if not companies:
        print("[ERROR] No companies found to migrate")
        print("[TIP] Check that councils/organisations/ contains company folders with config.json")
        sys.exit(1)

    print(f"[INFO] Will migrate {len(companies)} company(s): {', '.join(companies)}")

    # Migrate each company
    success_count = 0
    for company_slug in companies:
        try:
            if migrate_company(client, company_slug, dry_run=args.dry_run):
                success_count += 1
        except Exception as e:
            print(f"[ERROR] Migration failed for {company_slug}: {e}")

    print(f"\n{'='*60}")
    print(f"Migration complete: {success_count}/{len(companies)} companies migrated")
    print("="*60)


if __name__ == "__main__":
    main()
