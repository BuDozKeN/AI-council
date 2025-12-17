"""Quick script to check what's in the company, department, project, and role contexts."""
import os
import re
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")

client = create_client(url, key)

company_id = "a0000000-0000-0000-0000-000000000001"

print("=" * 60)
print("CONTEXT SIZE AUDIT")
print("=" * 60)

# Get the AxCouncil company context
result = client.table("companies").select("id, name, context_md").eq("id", company_id).execute()

company_context_len = 0
if result.data:
    company = result.data[0]
    context = company.get("context_md", "") or ""
    company_context_len = len(context)
    print(f"\n1. Company: {company.get('name')}")
    print(f"   context_md: {company_context_len:,} characters")

    # Check for Chairman
    if "Chairman" in context:
        print(f"   *** CONTAINS 'Chairman' ***")
        # Find all occurrences
        matches = list(re.finditer(r'Chairman', context, re.IGNORECASE))
        print(f"   Found {len(matches)} occurrences")
        for i, match in enumerate(matches[:3]):  # Show first 3
            start = max(0, match.start() - 50)
            end = min(len(context), match.end() + 50)
            snippet = context[start:end].replace('\n', ' ')
            print(f"   [{i+1}]: ...{snippet}...")

# Get all departments for this company
dept_result = client.table("departments").select("id, name, context_md").eq("company_id", company_id).execute()

total_dept_context = 0
if dept_result.data:
    print(f"\n2. Departments ({len(dept_result.data)} total):")
    for dept in dept_result.data:
        dept_context = dept.get("context_md", "") or ""
        total_dept_context += len(dept_context)
        print(f"   - {dept.get('name')}: {len(dept_context):,} chars")

        # Check for Chairman in department context
        if "Chairman" in dept_context:
            print(f"     *** CONTAINS 'Chairman' ***")

# Get all roles and their system_prompt sizes
role_result = client.table("roles").select("id, name, department_id, system_prompt").execute()

total_role_context = 0
if role_result.data:
    print(f"\n3. Roles ({len(role_result.data)} total):")
    for role in role_result.data:
        role_prompt = role.get("system_prompt", "") or ""
        total_role_context += len(role_prompt)
        if len(role_prompt) > 1000:  # Only show large ones
            print(f"   - {role.get('name')}: {len(role_prompt):,} chars")

        # Check for Chairman in role prompt
        if "Chairman" in role_prompt:
            print(f"     *** CONTAINS 'Chairman' ***")
    print(f"   Total role system_prompts: {total_role_context:,} chars")

# Get all projects and their context_md sizes
project_result = client.table("projects").select("id, name, context_md").eq("company_id", company_id).execute()

total_project_context = 0
if project_result.data:
    print(f"\n4. Projects ({len(project_result.data)} total):")
    for project in project_result.data:
        project_context = project.get("context_md", "") or ""
        total_project_context += len(project_context)
        print(f"   - {project.get('name')}: {len(project_context):,} chars")

        # Check for Chairman in project context
        if "Chairman" in project_context:
            print(f"     *** CONTAINS 'Chairman' ***")

print(f"\n{'=' * 60}")
print("SUMMARY")
print(f"{'=' * 60}")
print(f"Company context:     {company_context_len:>12,} chars")
print(f"Department contexts: {total_dept_context:>12,} chars")
print(f"Role system_prompts: {total_role_context:>12,} chars")
print(f"Project contexts:    {total_project_context:>12,} chars")
print(f"{'=' * 60}")
total = company_context_len + total_dept_context + total_role_context + total_project_context
print(f"TOTAL:               {total:>12,} chars")
print()
print("Note: Logs show 588K chars. If total above is much smaller,")
print("the extra context is coming from somewhere else (e.g., knowledge entries).")
