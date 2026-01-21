#!/usr/bin/env python3
"""
Staging Database Seeder

Generates realistic test data for the staging environment without
touching production. Useful for testing edge cases and performance.

Usage:
    python scripts/seed_staging.py

Environment Variables Required:
    STAGING_SUPABASE_URL - Staging Supabase project URL
    STAGING_SUPABASE_SERVICE_KEY - Service key with full access

Options:
    --companies N    Number of companies to generate (default: 10)
    --clear          Clear existing data before seeding
    --verbose        Print detailed progress
"""

import argparse
import hashlib
import os
import random
import sys
import uuid
from datetime import datetime, timedelta
from typing import Any

try:
    from faker import Faker
except ImportError:
    print("Error: faker package required. Install with: pip install faker")
    sys.exit(1)

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase package required. Install with: pip install supabase")
    sys.exit(1)

# Initialize Faker for realistic data
fake = Faker()

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

DEPARTMENT_TEMPLATES = [
    {"name": "Engineering", "description": "Software development and technical architecture"},
    {"name": "Product", "description": "Product strategy and roadmap management"},
    {"name": "Marketing", "description": "Brand, content, and demand generation"},
    {"name": "Sales", "description": "Revenue generation and customer acquisition"},
    {"name": "Operations", "description": "Business operations and process optimization"},
    {"name": "Finance", "description": "Financial planning and accounting"},
    {"name": "HR", "description": "People operations and talent management"},
    {"name": "Customer Success", "description": "Customer onboarding and retention"},
    {"name": "Legal", "description": "Compliance and contract management"},
    {"name": "Design", "description": "UX/UI design and user research"},
]

ROLE_TEMPLATES = [
    {
        "name": "Strategic Advisor",
        "system_prompt": "You are a strategic business advisor focused on long-term growth.",
        "model": "claude-3-5-sonnet-20241022",
    },
    {
        "name": "Technical Expert",
        "system_prompt": "You are a technical expert focused on engineering best practices.",
        "model": "gpt-4o",
    },
    {
        "name": "Devil's Advocate",
        "system_prompt": "Challenge assumptions and identify potential risks.",
        "model": "gemini-2.0-flash-exp",
    },
    {
        "name": "Customer Champion",
        "system_prompt": "Advocate for the customer perspective in all decisions.",
        "model": "grok-beta",
    },
    {
        "name": "Data Analyst",
        "system_prompt": "Provide data-driven insights and quantitative analysis.",
        "model": "deepseek-chat",
    },
]

INDUSTRY_OPTIONS = [
    "Technology",
    "Healthcare",
    "Finance",
    "E-commerce",
    "Education",
    "Manufacturing",
    "Media",
    "Real Estate",
]

COMPANY_SIZE_OPTIONS = ["startup", "smb", "mid-market", "enterprise"]


# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════


def generate_uuid() -> str:
    """Generate a UUID string"""
    return str(uuid.uuid4())


def generate_test_email(base: str) -> str:
    """Generate a test email that won't conflict with real users"""
    hash_part = hashlib.md5(base.encode()).hexdigest()[:8]
    return f"staging-{hash_part}@test.axcouncil.local"


def generate_company() -> dict[str, Any]:
    """Generate a realistic company profile"""
    company_name = fake.company()
    industry = random.choice(INDUSTRY_OPTIONS)
    size = random.choice(COMPANY_SIZE_OPTIONS)

    context = f"""
{company_name} is a {size} company in the {industry} industry.

Key Focus Areas:
- {fake.catch_phrase()}
- {fake.bs()}
- {fake.bs()}

Current Challenges:
- {fake.sentence()}
- {fake.sentence()}

Team Size: {random.randint(5, 500)} employees
Founded: {random.randint(2010, 2024)}
    """.strip()

    return {
        "id": generate_uuid(),
        "name": company_name,
        "context": context,
        "industry": industry,
        "size": size,
        "created_at": fake.date_time_between(start_date="-2y", end_date="now").isoformat(),
    }


def generate_departments(company_id: str, count: int = 5) -> list[dict[str, Any]]:
    """Generate departments for a company"""
    selected = random.sample(DEPARTMENT_TEMPLATES, min(count, len(DEPARTMENT_TEMPLATES)))
    departments = []

    for template in selected:
        departments.append(
            {
                "id": generate_uuid(),
                "company_id": company_id,
                "name": template["name"],
                "description": template["description"],
                "is_active": random.random() > 0.1,  # 90% active
                "created_at": fake.date_time_between(
                    start_date="-1y", end_date="now"
                ).isoformat(),
            }
        )

    return departments


def generate_roles(company_id: str, count: int = 3) -> list[dict[str, Any]]:
    """Generate AI roles for a company"""
    selected = random.sample(ROLE_TEMPLATES, min(count, len(ROLE_TEMPLATES)))
    roles = []

    for template in selected:
        roles.append(
            {
                "id": generate_uuid(),
                "company_id": company_id,
                "name": template["name"],
                "system_prompt": template["system_prompt"],
                "model": template["model"],
                "is_active": True,
                "created_at": fake.date_time_between(
                    start_date="-1y", end_date="now"
                ).isoformat(),
            }
        )

    return roles


def generate_conversations(
    company_id: str, count: int = 5
) -> list[dict[str, Any]]:
    """Generate sample conversations"""
    conversations = []

    topics = [
        "Should we expand to new market?",
        "How to improve customer retention?",
        "Tech stack evaluation for new project",
        "Hiring strategy for Q2",
        "Product roadmap prioritization",
        "Budget allocation review",
        "Competitive analysis",
        "Process improvement ideas",
    ]

    for _ in range(count):
        topic = random.choice(topics)
        created_at = fake.date_time_between(start_date="-6m", end_date="now")

        conversations.append(
            {
                "id": generate_uuid(),
                "company_id": company_id,
                "title": topic,
                "status": random.choice(["completed", "in_progress", "draft"]),
                "created_at": created_at.isoformat(),
                "updated_at": (
                    created_at + timedelta(hours=random.randint(1, 24))
                ).isoformat(),
            }
        )

    return conversations


def generate_knowledge_entries(
    company_id: str, count: int = 3
) -> list[dict[str, Any]]:
    """Generate saved knowledge entries"""
    entries = []

    entry_types = [
        ("Decision", "Strategic decision about {}"),
        ("Insight", "Key insight regarding {}"),
        ("Best Practice", "Best practice for {}"),
        ("Lesson Learned", "Lesson learned from {}"),
    ]

    topics = [
        "market expansion",
        "product development",
        "team scaling",
        "technology choices",
        "customer feedback",
        "competitive positioning",
    ]

    for _ in range(count):
        entry_type, template = random.choice(entry_types)
        topic = random.choice(topics)

        entries.append(
            {
                "id": generate_uuid(),
                "company_id": company_id,
                "title": template.format(topic),
                "content": fake.paragraph(nb_sentences=5),
                "entry_type": entry_type.lower().replace(" ", "_"),
                "tags": random.sample(topics, k=random.randint(1, 3)),
                "created_at": fake.date_time_between(
                    start_date="-6m", end_date="now"
                ).isoformat(),
            }
        )

    return entries


# ═══════════════════════════════════════════════════════════════════════════════
# Edge Case Data Generators
# ═══════════════════════════════════════════════════════════════════════════════


def generate_edge_case_company() -> dict[str, Any]:
    """Generate a company with edge case data for testing"""
    edge_cases = [
        # Unicode and special characters
        {
            "name": "Acme & Sons (株式会社)",
            "context": "Company with unicode: émojis 🚀, symbols ™®©, and CJK 中文日本語",
        },
        # Very long content
        {
            "name": "Verbose Corp",
            "context": fake.paragraph(nb_sentences=50),  # Very long context
        },
        # Minimal content
        {
            "name": "Minimal Inc",
            "context": "",  # Empty context
        },
        # SQL injection attempt (should be safely stored)
        {
            "name": "Test'; DROP TABLE companies; --",
            "context": "Testing SQL injection handling",
        },
        # XSS attempt (should be safely stored)
        {
            "name": "<script>alert('xss')</script>",
            "context": "Testing XSS handling <img onerror='alert(1)' src='x'>",
        },
        # Newlines and formatting
        {
            "name": "Multi\nLine\tCompany",
            "context": "Context with\nnewlines\tand\ttabs",
        },
    ]

    edge_case = random.choice(edge_cases)
    return {
        "id": generate_uuid(),
        "name": edge_case["name"],
        "context": edge_case["context"],
        "industry": "Testing",
        "size": "edge_case",
        "created_at": datetime.now().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Main Seeding Functions
# ═══════════════════════════════════════════════════════════════════════════════


def clear_staging_data(client: Client, verbose: bool = False) -> None:
    """Clear all data from staging tables"""
    tables = [
        "knowledge_entries",
        "conversations",
        "roles",
        "departments",
        "companies",
    ]

    for table in tables:
        if verbose:
            print(f"  Clearing {table}...")
        try:
            # Delete all rows (staging only - never run against production!)
            client.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        except Exception as e:
            print(f"  Warning: Could not clear {table}: {e}")


def seed_staging(
    client: Client,
    num_companies: int = 10,
    include_edge_cases: bool = True,
    verbose: bool = False,
) -> dict[str, int]:
    """Seed staging database with test data"""
    stats = {
        "companies": 0,
        "departments": 0,
        "roles": 0,
        "conversations": 0,
        "knowledge_entries": 0,
    }

    # Generate regular companies
    for i in range(num_companies):
        if verbose:
            print(f"  Creating company {i + 1}/{num_companies}...")

        # Create company
        company = generate_company()
        try:
            client.table("companies").insert(company).execute()
            stats["companies"] += 1
        except Exception as e:
            print(f"  Warning: Could not create company: {e}")
            continue

        # Create related data
        company_id = company["id"]

        # Departments
        departments = generate_departments(company_id, random.randint(3, 8))
        for dept in departments:
            try:
                client.table("departments").insert(dept).execute()
                stats["departments"] += 1
            except Exception as e:
                if verbose:
                    print(f"  Warning: Could not create department: {e}")

        # Roles
        roles = generate_roles(company_id, random.randint(2, 5))
        for role in roles:
            try:
                client.table("roles").insert(role).execute()
                stats["roles"] += 1
            except Exception as e:
                if verbose:
                    print(f"  Warning: Could not create role: {e}")

        # Conversations
        conversations = generate_conversations(company_id, random.randint(3, 10))
        for conv in conversations:
            try:
                client.table("conversations").insert(conv).execute()
                stats["conversations"] += 1
            except Exception as e:
                if verbose:
                    print(f"  Warning: Could not create conversation: {e}")

        # Knowledge entries
        entries = generate_knowledge_entries(company_id, random.randint(2, 5))
        for entry in entries:
            try:
                client.table("knowledge_entries").insert(entry).execute()
                stats["knowledge_entries"] += 1
            except Exception as e:
                if verbose:
                    print(f"  Warning: Could not create knowledge entry: {e}")

    # Add edge case companies for testing
    if include_edge_cases:
        if verbose:
            print("  Creating edge case test data...")

        for _ in range(3):  # Add 3 edge case companies
            edge_company = generate_edge_case_company()
            try:
                client.table("companies").insert(edge_company).execute()
                stats["companies"] += 1
            except Exception as e:
                if verbose:
                    print(f"  Warning: Could not create edge case company: {e}")

    return stats


# ═══════════════════════════════════════════════════════════════════════════════
# CLI Entry Point
# ═══════════════════════════════════════════════════════════════════════════════


def main():
    parser = argparse.ArgumentParser(
        description="Seed staging database with test data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/seed_staging.py                    # Seed with 10 companies
  python scripts/seed_staging.py --companies 50    # Seed with 50 companies
  python scripts/seed_staging.py --clear           # Clear and reseed
  python scripts/seed_staging.py --verbose         # Show detailed progress
        """,
    )
    parser.add_argument(
        "--companies",
        type=int,
        default=10,
        help="Number of companies to generate (default: 10)",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing data before seeding",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print detailed progress",
    )
    parser.add_argument(
        "--no-edge-cases",
        action="store_true",
        help="Skip edge case test data",
    )

    args = parser.parse_args()

    # Check environment variables
    staging_url = os.environ.get("STAGING_SUPABASE_URL")
    staging_key = os.environ.get("STAGING_SUPABASE_SERVICE_KEY")

    if not staging_url or not staging_key:
        print("Error: Required environment variables not set")
        print("  STAGING_SUPABASE_URL")
        print("  STAGING_SUPABASE_SERVICE_KEY")
        print("\nSet these in your .env file or export them:")
        print("  export STAGING_SUPABASE_URL=https://xxx.supabase.co")
        print("  export STAGING_SUPABASE_SERVICE_KEY=eyJ...")
        sys.exit(1)

    # Safety check - ensure we're not targeting production
    if "staging" not in staging_url.lower() and "test" not in staging_url.lower():
        print("⚠️  WARNING: The Supabase URL doesn't contain 'staging' or 'test'")
        print(f"   URL: {staging_url}")
        confirm = input("Are you SURE this is a staging environment? (type 'yes' to continue): ")
        if confirm.lower() != "yes":
            print("Aborted.")
            sys.exit(1)

    # Connect to staging
    print(f"🔌 Connecting to staging Supabase...")
    client = create_client(staging_url, staging_key)

    # Clear if requested
    if args.clear:
        print("🗑️  Clearing existing staging data...")
        clear_staging_data(client, args.verbose)

    # Seed data
    print(f"🌱 Seeding staging with {args.companies} companies...")
    stats = seed_staging(
        client,
        num_companies=args.companies,
        include_edge_cases=not args.no_edge_cases,
        verbose=args.verbose,
    )

    # Print summary
    print("\n✅ Staging seeded successfully!")
    print("   Summary:")
    for table, count in stats.items():
        print(f"   - {table}: {count}")


if __name__ == "__main__":
    main()
