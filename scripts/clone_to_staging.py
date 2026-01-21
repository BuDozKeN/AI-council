#!/usr/bin/env python3
"""
Production to Staging Data Clone (Sanitized)

Clones production data to staging with all PII/sensitive data sanitized.
Use this when you need to debug issues with real data structures.

Usage:
    python scripts/clone_to_staging.py

Environment Variables Required:
    SUPABASE_URL - Production Supabase URL
    SUPABASE_SERVICE_KEY - Production service key (read-only recommended)
    STAGING_SUPABASE_URL - Staging Supabase URL
    STAGING_SUPABASE_SERVICE_KEY - Staging service key

Options:
    --company-id UUID    Clone only a specific company (for debugging)
    --limit N            Limit companies to clone (default: all)
    --dry-run            Show what would be cloned without writing
"""

import argparse
import hashlib
import os
import sys
from datetime import datetime
from typing import Any

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase package required. Install with: pip install supabase")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════════════════════
# Sanitization Functions
# ═══════════════════════════════════════════════════════════════════════════════


def sanitize_email(email: str) -> str:
    """Convert real email to test email while preserving uniqueness"""
    if not email:
        return email
    hash_part = hashlib.md5(email.encode()).hexdigest()[:12]
    return f"sanitized-{hash_part}@test.local"


def sanitize_name(name: str) -> str:
    """Sanitize company/person names while preserving length characteristics"""
    if not name:
        return name
    # Keep first letter and length, replace rest
    hash_part = hashlib.md5(name.encode()).hexdigest()[:8]
    return f"Test_{hash_part}"


def sanitize_text(text: str, preserve_length: bool = True) -> str:
    """Sanitize free-text fields"""
    if not text:
        return text
    if preserve_length:
        # Replace with lorem ipsum of similar length
        words = ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur"]
        result = []
        for word in text.split():
            result.append(words[len(word) % len(words)])
        return " ".join(result)
    return "[SANITIZED CONTENT]"


def sanitize_company(company: dict[str, Any]) -> dict[str, Any]:
    """Sanitize company data"""
    return {
        **company,
        "name": sanitize_name(company.get("name", "")),
        "context": sanitize_text(company.get("context", ""), preserve_length=True),
        # Preserve structure fields
        "industry": company.get("industry"),
        "size": company.get("size"),
    }


def sanitize_department(dept: dict[str, Any]) -> dict[str, Any]:
    """Sanitize department data - usually safe to keep as-is"""
    return {
        **dept,
        # Department names are usually generic (Engineering, Sales, etc.)
        # but sanitize description just in case
        "description": sanitize_text(dept.get("description", "")),
    }


def sanitize_role(role: dict[str, Any]) -> dict[str, Any]:
    """Sanitize role data"""
    return {
        **role,
        # Keep role name, sanitize custom prompts
        "system_prompt": sanitize_text(role.get("system_prompt", "")),
    }


def sanitize_conversation(conv: dict[str, Any]) -> dict[str, Any]:
    """Sanitize conversation data"""
    return {
        **conv,
        "title": sanitize_text(conv.get("title", ""), preserve_length=False),
    }


def sanitize_knowledge_entry(entry: dict[str, Any]) -> dict[str, Any]:
    """Sanitize knowledge entry data"""
    return {
        **entry,
        "title": sanitize_text(entry.get("title", ""), preserve_length=False),
        "content": sanitize_text(entry.get("content", "")),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Clone Functions
# ═══════════════════════════════════════════════════════════════════════════════


def clone_table(
    prod_client: Client,
    staging_client: Client,
    table: str,
    filter_field: str | None = None,
    filter_value: str | None = None,
    sanitizer: callable = None,
    dry_run: bool = False,
    verbose: bool = False,
) -> int:
    """Clone a table from production to staging"""
    # Build query
    query = prod_client.table(table).select("*")
    if filter_field and filter_value:
        query = query.eq(filter_field, filter_value)

    # Fetch data
    result = query.execute()
    records = result.data

    if verbose:
        print(f"  Found {len(records)} records in {table}")

    if dry_run:
        return len(records)

    # Sanitize and insert
    count = 0
    for record in records:
        if sanitizer:
            record = sanitizer(record)

        try:
            staging_client.table(table).upsert(record).execute()
            count += 1
        except Exception as e:
            if verbose:
                print(f"    Warning: Failed to insert record: {e}")

    return count


def clone_company(
    prod_client: Client,
    staging_client: Client,
    company_id: str,
    dry_run: bool = False,
    verbose: bool = False,
) -> dict[str, int]:
    """Clone a single company with all related data"""
    stats = {}

    # Clone company
    if verbose:
        print(f"  Cloning company {company_id}...")
    stats["companies"] = clone_table(
        prod_client,
        staging_client,
        "companies",
        "id",
        company_id,
        sanitize_company,
        dry_run,
        verbose,
    )

    # Clone related tables
    related_tables = [
        ("departments", sanitize_department),
        ("roles", sanitize_role),
        ("conversations", sanitize_conversation),
        ("knowledge_entries", sanitize_knowledge_entry),
    ]

    for table, sanitizer in related_tables:
        if verbose:
            print(f"  Cloning {table}...")
        stats[table] = clone_table(
            prod_client,
            staging_client,
            table,
            "company_id",
            company_id,
            sanitizer,
            dry_run,
            verbose,
        )

    return stats


def clone_all_companies(
    prod_client: Client,
    staging_client: Client,
    limit: int | None = None,
    dry_run: bool = False,
    verbose: bool = False,
) -> dict[str, int]:
    """Clone all companies (with optional limit)"""
    # Get all company IDs
    query = prod_client.table("companies").select("id")
    if limit:
        query = query.limit(limit)
    result = query.execute()
    company_ids = [c["id"] for c in result.data]

    print(f"📦 Found {len(company_ids)} companies to clone")

    total_stats = {
        "companies": 0,
        "departments": 0,
        "roles": 0,
        "conversations": 0,
        "knowledge_entries": 0,
    }

    for i, company_id in enumerate(company_ids):
        if verbose:
            print(f"\n🏢 Company {i + 1}/{len(company_ids)}: {company_id}")

        stats = clone_company(
            prod_client,
            staging_client,
            company_id,
            dry_run,
            verbose,
        )

        for key, value in stats.items():
            total_stats[key] += value

    return total_stats


# ═══════════════════════════════════════════════════════════════════════════════
# CLI Entry Point
# ═══════════════════════════════════════════════════════════════════════════════


def main():
    parser = argparse.ArgumentParser(
        description="Clone production data to staging (sanitized)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/clone_to_staging.py                     # Clone all companies
  python scripts/clone_to_staging.py --limit 5          # Clone first 5 companies
  python scripts/clone_to_staging.py --company-id UUID  # Clone specific company
  python scripts/clone_to_staging.py --dry-run          # Preview without changes
        """,
    )
    parser.add_argument(
        "--company-id",
        type=str,
        help="Clone only a specific company",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of companies to clone",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be cloned without writing",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print detailed progress",
    )

    args = parser.parse_args()

    # Check environment variables
    prod_url = os.environ.get("SUPABASE_URL")
    prod_key = os.environ.get("SUPABASE_SERVICE_KEY")
    staging_url = os.environ.get("STAGING_SUPABASE_URL")
    staging_key = os.environ.get("STAGING_SUPABASE_SERVICE_KEY")

    missing = []
    if not prod_url:
        missing.append("SUPABASE_URL")
    if not prod_key:
        missing.append("SUPABASE_SERVICE_KEY")
    if not staging_url:
        missing.append("STAGING_SUPABASE_URL")
    if not staging_key:
        missing.append("STAGING_SUPABASE_SERVICE_KEY")

    if missing:
        print("Error: Required environment variables not set:")
        for var in missing:
            print(f"  - {var}")
        sys.exit(1)

    # Safety checks
    if prod_url == staging_url:
        print("❌ ERROR: Production and staging URLs are the same!")
        print("   This would overwrite production data. Aborting.")
        sys.exit(1)

    if "staging" not in staging_url.lower() and "test" not in staging_url.lower():
        print("⚠️  WARNING: The staging URL doesn't contain 'staging' or 'test'")
        print(f"   URL: {staging_url}")
        confirm = input("Are you SURE this is a staging environment? (type 'yes' to continue): ")
        if confirm.lower() != "yes":
            print("Aborted.")
            sys.exit(1)

    # Connect to databases
    print("🔌 Connecting to databases...")
    prod_client = create_client(prod_url, prod_key)
    staging_client = create_client(staging_url, staging_key)

    if args.dry_run:
        print("🔍 DRY RUN MODE - No data will be written\n")

    # Clone data
    if args.company_id:
        print(f"📦 Cloning company {args.company_id}...")
        stats = clone_company(
            prod_client,
            staging_client,
            args.company_id,
            args.dry_run,
            args.verbose,
        )
    else:
        stats = clone_all_companies(
            prod_client,
            staging_client,
            args.limit,
            args.dry_run,
            args.verbose,
        )

    # Print summary
    print("\n" + "═" * 50)
    if args.dry_run:
        print("✅ Dry run complete! Would have cloned:")
    else:
        print("✅ Clone complete!")
    print("   Summary:")
    for table, count in stats.items():
        print(f"   - {table}: {count}")

    if not args.dry_run:
        print(f"\n🔗 Staging data ready at: {staging_url}")


if __name__ == "__main__":
    main()
