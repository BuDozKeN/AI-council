#!/usr/bin/env python3
"""
Quick script to create a project using service key (no login required).
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Project data
PROJECT_DATA = {
    "name": "Login Page Redesign",
    "description": "WOW-factor login with Aceternity + Tailwind",
    "context_md": """# Login Page Redesign

## Goals & Objectives
- Create a premium first impression that makes users say "WOW"
- Zero friction - so intuitive that even someone who doesn't know computers can use it
- Time to first interaction: < 2 seconds
- Pass the "mother test" - anyone can sign in without help

## Technical Stack
- React 19 with Vite
- Tailwind CSS v4
- Shadcn/ui components (already integrated)
- Supabase Auth (existing integration)

## Available Aceternity Components (FREE - MIT License)
These can be installed via shadcn CLI:
- Aurora Background - animated gradient background
- Spotlight - cursor-following light effect
- Text Generate Effect - typewriter-style text animation
- Flip Words - rotating word animation
- Signup Form - pre-built auth form
- Background Beams - animated beam lines
- Lamp Effect - glowing lamp animation

## Constraints
- Only use FREE Aceternity components
- Must work with existing Supabase Auth flow
- Support both Login and Sign Up modes
- Include password recovery flow
- Animations must not block user input

## Success Criteria
- User thinks "this looks premium" within 3 seconds
- Clear, obvious path to sign in or sign up
- Smooth transition to main app after auth
- Mobile responsive
"""
}


def main():
    print("=== AxCouncil Project Creator (Service Key) ===\n")

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY not found in .env")
        return

    # Create service client (bypasses RLS)
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Get company (axcouncil)
    print("Finding AxCouncil company...")
    companies = client.table("companies").select("id, name, slug").eq("slug", "axcouncil").execute()

    if not companies.data:
        # Try without slug filter
        companies = client.table("companies").select("id, name, slug").execute()
        if not companies.data:
            print("ERROR: No companies found")
            return

    company = companies.data[0]
    print(f"Using company: {company['name']} (ID: {company['id']})")

    # Get a user_id from the company
    users = client.table("user_profiles").select("user_id").limit(1).execute()
    if not users.data:
        print("ERROR: No users found")
        return

    user_id = users.data[0]['user_id']
    print(f"Using user_id: {user_id}")

    # Check if project already exists
    existing = client.table("projects")\
        .select("id, name")\
        .eq("company_id", company['id'])\
        .eq("name", PROJECT_DATA["name"])\
        .execute()

    if existing.data:
        print(f"\nProject '{PROJECT_DATA['name']}' already exists!")
        print(f"Project ID: {existing.data[0]['id']}")
        return

    # Create project
    print(f"\nCreating project: {PROJECT_DATA['name']}...")

    result = client.table("projects").insert({
        "company_id": company['id'],
        "user_id": user_id,
        "name": PROJECT_DATA["name"],
        "description": PROJECT_DATA["description"],
        "context_md": PROJECT_DATA["context_md"]
    }).execute()

    if result.data:
        project = result.data[0]
        print(f"\nSUCCESS! Project created.")
        print(f"Project ID: {project['id']}")
        print(f"Name: {project['name']}")
        print("\nRefresh the AxCouncil UI and select this project from the dropdown.")
    else:
        print("ERROR: Failed to create project")


if __name__ == "__main__":
    main()
