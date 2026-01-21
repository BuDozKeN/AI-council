#!/usr/bin/env python3
"""
Environment Variable Parity Checker

Compares environment variables between production and staging to catch drift.
Run this before major deployments to ensure staging mirrors production config.

Usage:
    python scripts/check_env_parity.py

    # With explicit env files
    python scripts/check_env_parity.py --prod .env.production --staging .env.staging

Environment-based (recommended for CI):
    Set PROD_ENV_VARS and STAGING_ENV_VARS as comma-separated lists
"""

import argparse
import os
import sys
from pathlib import Path


# Variables that are EXPECTED to differ between environments
ALLOWED_DIFFERENCES = {
    "ENVIRONMENT",           # production vs staging
    "SUPABASE_URL",          # Different projects
    "SUPABASE_SERVICE_KEY",  # Different keys
    "SUPABASE_ANON_KEY",     # Different keys
    "VITE_SUPABASE_URL",     # Frontend Supabase
    "VITE_SUPABASE_ANON_KEY",
    "SENTRY_DSN",            # Separate Sentry projects
    "VITE_SENTRY_DSN",
    "REDIS_URL",             # May use different instances
    "QDRANT_URL",
    "QDRANT_API_KEY",
    "DATABASE_URL",          # Different databases
    "LOG_LEVEL",             # DEBUG in staging, INFO in prod
    "RENDER_DEPLOY_HOOK",    # Different deploy hooks
}

# Variables that MUST exist in both environments
REQUIRED_IN_BOTH = {
    "OPENROUTER_API_KEY",    # LLM access
    "VITE_API_URL",          # Backend URL
}

# Variables that should ONLY exist in production
PRODUCTION_ONLY = {
    "STRIPE_SECRET_KEY",     # Live Stripe key
    "STRIPE_WEBHOOK_SECRET", # Live webhook
}

# Variables that should ONLY exist in staging
STAGING_ONLY = {
    "STRIPE_TEST_SECRET_KEY",  # Test Stripe key
    "TEST_USER_EMAIL",         # Test credentials
    "TEST_USER_PASSWORD",
}


def parse_env_file(filepath: str) -> dict[str, str]:
    """Parse a .env file into a dictionary"""
    env_vars = {}
    path = Path(filepath)

    if not path.exists():
        print(f"Warning: {filepath} not found")
        return env_vars

    with open(path) as f:
        for line in f:
            line = line.strip()
            # Skip comments and empty lines
            if not line or line.startswith("#"):
                continue
            # Parse KEY=value
            if "=" in line:
                key, _, value = line.partition("=")
                key = key.strip()
                # Skip commented-out variables
                if not key.startswith("#"):
                    env_vars[key] = value.strip()

    return env_vars


def parse_env_list(env_list: str) -> set[str]:
    """Parse comma-separated env var names"""
    if not env_list:
        return set()
    return {v.strip() for v in env_list.split(",") if v.strip()}


def check_parity(
    prod_vars: set[str],
    staging_vars: set[str],
    verbose: bool = False
) -> tuple[bool, list[str]]:
    """
    Check environment variable parity.
    Returns (is_ok, list of issues)
    """
    issues = []

    # Variables in production but not staging
    prod_only = prod_vars - staging_vars - ALLOWED_DIFFERENCES - PRODUCTION_ONLY
    if prod_only:
        issues.append(f"❌ Missing in staging (exist in prod): {sorted(prod_only)}")

    # Variables in staging but not production
    staging_only = staging_vars - prod_vars - ALLOWED_DIFFERENCES - STAGING_ONLY
    if staging_only:
        issues.append(f"⚠️  Extra in staging (not in prod): {sorted(staging_only)}")

    # Required variables missing
    missing_required = REQUIRED_IN_BOTH - (prod_vars & staging_vars)
    if missing_required:
        issues.append(f"❌ Required vars missing from one or both: {sorted(missing_required)}")

    # Check for production-only vars in staging (security issue)
    leaked_prod_vars = PRODUCTION_ONLY & staging_vars
    if leaked_prod_vars:
        issues.append(f"🚨 SECURITY: Production-only vars found in staging: {sorted(leaked_prod_vars)}")

    # Summary
    if verbose:
        print(f"\nProduction variables: {len(prod_vars)}")
        print(f"Staging variables: {len(staging_vars)}")
        print(f"Allowed differences: {len(ALLOWED_DIFFERENCES)}")
        print(f"Common variables: {len(prod_vars & staging_vars)}")

    return len(issues) == 0, issues


def main():
    parser = argparse.ArgumentParser(
        description="Check environment variable parity between production and staging"
    )
    parser.add_argument(
        "--prod",
        default=".env.production",
        help="Path to production env file (default: .env.production)"
    )
    parser.add_argument(
        "--staging",
        default=".env.staging",
        help="Path to staging env file (default: .env.staging)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output"
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on warnings, not just errors"
    )

    args = parser.parse_args()

    # Try environment variables first (for CI)
    prod_env_list = os.environ.get("PROD_ENV_VARS", "")
    staging_env_list = os.environ.get("STAGING_ENV_VARS", "")

    if prod_env_list and staging_env_list:
        print("📋 Using environment variable lists...")
        prod_vars = parse_env_list(prod_env_list)
        staging_vars = parse_env_list(staging_env_list)
    else:
        print(f"📋 Parsing env files...")
        prod_vars = set(parse_env_file(args.prod).keys())
        staging_vars = set(parse_env_file(args.staging).keys())

    if not prod_vars:
        print("⚠️  No production variables found")
        if not staging_vars:
            print("⚠️  No staging variables found")
            print("\nHint: Create .env.production and .env.staging, or set PROD_ENV_VARS/STAGING_ENV_VARS")
            sys.exit(0)  # Not an error if neither exists

    # Check parity
    is_ok, issues = check_parity(prod_vars, staging_vars, args.verbose)

    if issues:
        print("\n🔍 Parity Check Results:")
        for issue in issues:
            print(f"  {issue}")

        has_errors = any("❌" in i or "🚨" in i for i in issues)
        has_warnings = any("⚠️" in i for i in issues)

        if has_errors or (args.strict and has_warnings):
            print("\n❌ Environment parity check FAILED")
            sys.exit(1)
        else:
            print("\n⚠️  Environment parity check passed with warnings")
            sys.exit(0)
    else:
        print("\n✅ Environment parity check PASSED")
        print("   Production and staging have consistent configuration")
        sys.exit(0)


if __name__ == "__main__":
    main()
