#!/usr/bin/env python3
"""
Git History Cleanup Script

Removes sensitive files from git history using git-filter-repo.
This is necessary after accidentally committing secrets like .env.local.

IMPORTANT: This rewrites git history. All collaborators must re-clone after running.

Usage:
    python scripts/clean_git_history.py

Prerequisites:
    pip install git-filter-repo

    Or on Windows with scoop:
    scoop install git-filter-repo
"""

import subprocess
import sys
import os
from pathlib import Path


# Files to remove from git history
FILES_TO_REMOVE = [
    ".env.local",
    ".env.production",
    ".env.development",
    # Add any other sensitive files that were accidentally committed
]

# Paths to remove (directories)
PATHS_TO_REMOVE = [
    ".vercel/",
]


def check_prerequisites():
    """Check if git-filter-repo is installed."""
    try:
        subprocess.run(
            ["git", "filter-repo", "--version"],
            capture_output=True,
            check=True
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def check_clean_working_tree():
    """Ensure working tree is clean before rewriting history."""
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True,
        text=True
    )
    if result.stdout.strip():
        print("ERROR: Working tree is not clean. Commit or stash changes first.")
        print(result.stdout)
        return False
    return True


def create_backup():
    """Create a backup branch before rewriting history."""
    import datetime
    backup_name = f"backup-before-cleanup-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}"
    subprocess.run(["git", "branch", backup_name], check=True)
    print(f"Created backup branch: {backup_name}")
    return backup_name


def remove_files_from_history(files: list, paths: list):
    """Remove specified files and paths from entire git history."""

    # Build the filter-repo command
    args = ["git", "filter-repo", "--force"]

    for file in files:
        args.extend(["--invert-paths", "--path", file])

    for path in paths:
        args.extend(["--invert-paths", "--path", path])

    print(f"Running: {' '.join(args)}")

    result = subprocess.run(args, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"ERROR: git filter-repo failed")
        print(result.stderr)
        return False

    print(result.stdout)
    return True


def verify_removal(files: list):
    """Verify files are no longer in git history."""
    print("\nVerifying removal...")

    all_clean = True
    for file in files:
        result = subprocess.run(
            ["git", "log", "--all", "--full-history", "--", file],
            capture_output=True,
            text=True
        )
        if result.stdout.strip():
            print(f"WARNING: {file} still appears in history!")
            all_clean = False
        else:
            print(f"OK: {file} removed from history")

    return all_clean


def print_next_steps():
    """Print instructions for after cleanup."""
    print("""
================================================================================
GIT HISTORY CLEANUP COMPLETE
================================================================================

IMPORTANT: You have rewritten git history. You must now:

1. Force push to remote (this will affect all collaborators):

   git push origin --force --all
   git push origin --force --tags

2. Notify all collaborators to re-clone the repository:

   They should NOT pull - they must delete and re-clone:

   rm -rf AI-council
   git clone <repository-url>

3. If you have GitHub branch protection, temporarily disable it:
   - Go to Settings > Branches > Branch protection rules
   - Disable "Require pull request reviews"
   - Force push
   - Re-enable protection

4. Invalidate any secrets that were exposed:
   - OpenRouter API key: https://openrouter.ai/settings/keys
   - Stripe keys: https://dashboard.stripe.com/apikeys
   - Supabase keys: Supabase Dashboard > Settings > API

5. Consider running GitHub's secret scanning:
   - Settings > Security > Code security and analysis
   - Enable "Secret scanning"

================================================================================
""")


def main():
    # Change to repo root
    repo_root = Path(__file__).parent.parent
    os.chdir(repo_root)

    print("=" * 60)
    print("Git History Cleanup Script")
    print("=" * 60)
    print()

    # Check prerequisites
    if not check_prerequisites():
        print("""
ERROR: git-filter-repo is not installed.

Install it with one of these methods:

  pip install git-filter-repo

  # Or on Windows with scoop:
  scoop install git-filter-repo

  # Or on macOS with Homebrew:
  brew install git-filter-repo
""")
        sys.exit(1)

    # Check working tree
    if not check_clean_working_tree():
        sys.exit(1)

    # Show what will be removed
    print("Files to remove from history:")
    for f in FILES_TO_REMOVE:
        print(f"  - {f}")
    for p in PATHS_TO_REMOVE:
        print(f"  - {p}")
    print()

    # Confirm
    response = input("This will PERMANENTLY rewrite git history. Continue? [y/N]: ")
    if response.lower() != 'y':
        print("Aborted.")
        sys.exit(0)

    # Create backup
    backup_branch = create_backup()

    # Remove files
    print("\nRemoving files from history...")
    if not remove_files_from_history(FILES_TO_REMOVE, PATHS_TO_REMOVE):
        print(f"\nCleanup failed. Restore from backup: git checkout {backup_branch}")
        sys.exit(1)

    # Verify
    verify_removal(FILES_TO_REMOVE)

    # Print next steps
    print_next_steps()


if __name__ == "__main__":
    main()
