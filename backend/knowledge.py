"""Knowledge base for storing council decisions and patterns."""

from typing import Optional, List, Dict, Any
from .database import get_supabase_service, get_supabase_with_auth
from .security import verify_user_company_access, verify_user_entry_access, log_security_event, log_app_event, escape_sql_like_pattern


def create_knowledge_entry(
    user_id: str,
    company_id: str,
    title: str,
    summary: str,  # Legacy: maps to content
    category: str,
    department_id: Optional[str] = None,  # Legacy: single department
    role_id: Optional[str] = None,
    project_id: Optional[str] = None,
    source_conversation_id: Optional[str] = None,
    source_message_id: Optional[str] = None,
    access_token: Optional[str] = None,
    # Structured decision fields
    problem_statement: Optional[str] = None,
    decision_text: Optional[str] = None,
    reasoning: Optional[str] = None,
    status: str = "active",
    # Content fields
    body_md: Optional[str] = None,  # Legacy: prefer content
    content: Optional[str] = None,  # Canonical content field
    question: Optional[str] = None,  # Original user question
    version: str = "v1",
    # New consolidation fields
    auto_inject: bool = False,
    scope: str = "department",  # 'company', 'department', 'project'
    tags: Optional[List[str]] = None,
    department_ids: Optional[List[str]] = None  # Canonical departments
) -> Optional[Dict[str, Any]]:
    """Create a new knowledge entry with structured decision fields.

    Args:
        auto_inject: If True, this entry will be automatically included in council context
        scope: Visibility level - 'company' (all), 'department' (specific), 'project' (specific)
        tags: List of tags for categorization

    Returns:
        The created entry dict, or None if access denied or error
    """
    # Use canonical department_ids array
    dept_ids = department_ids if department_ids else ([department_id] if department_id else [])

    # Use RLS-authenticated client if access_token is available
    if access_token:
        client = get_supabase_with_auth(access_token)
        # Try using the SECURITY DEFINER function for atomic access check + insert
        try:
            result = client.rpc("create_knowledge_entry_safe", {
                "p_company_id": company_id,
                "p_user_id": user_id,
                "p_title": title,
                "p_content": content or body_md or summary or "",
                "p_category": category,
                "p_department_ids": dept_ids,
                "p_project_id": project_id,
                "p_auto_inject": auto_inject,
                "p_scope": scope,
                "p_tags": tags or []
            }).execute()

            if result.data:
                log_app_event("KNOWLEDGE: Created via safe function", user_id=user_id)
                return result.data

        except Exception as e:
            # Fallback to direct insert if function not available
            if "function" not in str(e).lower():
                log_app_event(f"KNOWLEDGE: Safe function failed: {e}", user_id=user_id, level="WARNING")
            # Continue to fallback below

    # SECURITY: Verify user has access to the target company (for fallback path)
    if not verify_user_company_access(user_id, company_id):
        log_security_event("CREATE_BLOCKED", user_id=user_id,
                          resource_type="knowledge_entry", resource_id=company_id,
                          severity="WARNING")
        return None

    client = get_supabase_service()

    # Use canonical content field, fall back to body_md or summary
    canonical_content = content or body_md or summary or ""

    data = {
        "company_id": company_id,
        "department_ids": dept_ids,  # Canonical: use array
        "role_id": role_id,
        "project_id": project_id,
        "category": category,
        "title": title,
        "content": canonical_content,  # Canonical: single content field
        "question": question,  # Original user question
        "source_conversation_id": source_conversation_id,
        "source_message_id": source_message_id,
        "created_by": user_id,
        "is_active": True,
        # Structured fields
        "problem_statement": problem_statement,
        "decision_text": decision_text,
        "reasoning": reasoning,
        "status": status,
        # Version
        "version": version,
        # Consolidation fields
        "auto_inject": auto_inject,
        "scope": scope,
        "tags": tags or []
    }

    result = client.table("knowledge_entries").insert(data).execute()
    return result.data[0] if result.data else None


def get_knowledge_entries(
    company_id: str,
    department_id: Optional[str] = None,
    project_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = "active",
    search: Optional[str] = None,
    limit: int = 50,
    access_token: Optional[str] = None,
    user_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get knowledge entries for a company with filtering options.

    Args:
        user_id: If provided, verifies user has access to the company (recommended for security)
    """
    # SECURITY: Verify user has access to the company if user_id provided
    if user_id and not verify_user_company_access(user_id, company_id):
        log_security_event("READ_BLOCKED", user_id=user_id,
                          resource_type="knowledge_entries", resource_id=company_id,
                          severity="WARNING")
        return []

    client = get_supabase_service()

    query = (client
        .table("knowledge_entries")
        .select("*")
        .eq("company_id", company_id)
        .eq("is_active", True)
        .order("updated_at", desc=True)
        .limit(limit))

    # Filter by status if provided (None = all statuses)
    if status:
        query = query.eq("status", status)

    # Filter by project
    if project_id:
        query = query.eq("project_id", project_id)
    elif department_id:
        # Get entries that include this department in their department_ids array
        # Uses PostgreSQL array containment operator
        query = query.contains("department_ids", [department_id])

    # Filter by category
    if category:
        query = query.eq("category", category)

    # Search in title, problem_statement, and decision_text
    if search:
        escaped_search = escape_sql_like_pattern(search)
        search_pattern = f"%{escaped_search}%"
        query = query.or_(
            f"title.ilike.{search_pattern},"
            f"problem_statement.ilike.{search_pattern},"
            f"decision_text.ilike.{search_pattern}"
        )

    result = query.execute()
    return result.data or []


def get_injectable_entries(
    company_id: str,
    department_id: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """Get knowledge entries marked for auto-injection.

    Returns entries where auto_inject=True, filtered by scope:
    - company: all entries visible
    - department: only if department matches or entry has no department
    - project: only if project matches
    """
    client = get_supabase_service()

    query = (client
        .table("knowledge_entries")
        .select("*")
        .eq("company_id", company_id)
        .eq("is_active", True)
        .eq("auto_inject", True)
        .order("created_at", desc=True)
        .limit(limit))

    result = query.execute()
    entries = result.data or []

    # Filter by scope in Python (more flexible than complex SQL)
    filtered = []
    for entry in entries:
        scope = entry.get("scope", "department")
        entry_dept = entry.get("department_id")
        entry_proj = entry.get("project_id")

        if scope == "company":
            # Company-wide entries always included
            filtered.append(entry)
        elif scope == "department":
            # Department entries if matching or entry is company-wide (null dept)
            if entry_dept is None or entry_dept == department_id:
                filtered.append(entry)
        elif scope == "project":
            # Project entries only if project matches
            if entry_proj == project_id:
                filtered.append(entry)

    return filtered


def get_knowledge_for_context(
    company_id: str,
    department_id: Optional[str] = None,
    role_id: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = 15,
    auto_inject_only: bool = False
) -> str:
    """Get knowledge entries formatted as markdown for context injection.

    Uses a decision-focused format that clearly communicates:
    - What problem was being solved
    - What decision was made
    - Why it was made

    Args:
        auto_inject_only: If True, only return entries marked for auto-injection
    """
    if auto_inject_only:
        entries = get_injectable_entries(
            company_id=company_id,
            department_id=department_id,
            project_id=project_id,
            limit=limit
        )
    else:
        entries = get_knowledge_entries(
            company_id=company_id,
            department_id=department_id,
            project_id=project_id,
            limit=limit
        )

    if not entries:
        return ""

    # Format as markdown section with decision-focused structure
    lines = ["\n\n---\n\n## Prior Decisions (Apply These Standards)\n"]

    for entry in entries:
        date = entry["created_at"][:10]
        status = entry.get("status", "active")

        # Skip superseded/deprecated entries unless explicitly active
        if status not in ("active", None):
            lines.append(f"### ~~{entry['title']}~~ ({date}) [SUPERSEDED]")
            lines.append("*This decision has been superseded. See newer entries.*\n")
            continue

        lines.append(f"### {entry['title']} ({date})")

        # Use new structured fields if available, fall back to summary
        problem = entry.get("problem_statement")
        decision = entry.get("decision_text")
        reasoning = entry.get("reasoning")

        if problem or decision or reasoning:
            # New structured format
            if problem:
                lines.append(f"**Problem:** {problem}")
            if decision:
                lines.append(f"**Decision:** {decision}")
            if reasoning:
                lines.append(f"**Reasoning:** {reasoning}")
            lines.append("")
        else:
            # Fall back to old summary format for backwards compatibility
            lines.append(f"*Category: {entry['category']}*\n")
            lines.append(f"{entry['summary']}\n")

    return "\n".join(lines)


def update_knowledge_entry(
    entry_id: str,
    user_id: str,
    updates: Dict[str, Any],
    access_token: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Update a knowledge entry with the provided fields.

    Returns:
        The updated entry dict, or None if access denied or entry not found
    """
    # Filter out None values and empty updates
    if not updates:
        return None

    # SECURITY: Use RLS-authenticated client when possible
    if access_token:
        client = get_supabase_with_auth(access_token)
        # RLS will enforce access control
    else:
        # Fallback: Verify access manually when no token available
        if not verify_user_entry_access(user_id, entry_id, "knowledge_entries"):
            log_security_event("UPDATE_BLOCKED", user_id=user_id,
                              resource_type="knowledge_entry", resource_id=entry_id,
                              severity="WARNING")
            return None
        client = get_supabase_service()

    # The updated_at will be handled by the database trigger
    result = (client
        .table("knowledge_entries")
        .update(updates)
        .eq("id", entry_id)
        .execute())

    return result.data[0] if result.data else None


def get_knowledge_count_for_conversation(
    conversation_id: str,
    company_id: str
) -> int:
    """Get count of knowledge entries saved from a specific conversation."""
    client = get_supabase_service()

    result = (client
        .table("knowledge_entries")
        .select("id", count="exact")
        .eq("source_conversation_id", conversation_id)
        .eq("company_id", company_id)
        .eq("is_active", True)
        .execute())

    return result.count if result.count is not None else 0


def deactivate_knowledge_entry(
    entry_id: str,
    user_id: str,
    access_token: Optional[str] = None
) -> bool:
    """Soft delete a knowledge entry.

    Returns:
        True if deleted successfully, False if access denied or entry not found
    """
    # SECURITY: Use RLS-authenticated client when possible
    if access_token:
        client = get_supabase_with_auth(access_token)
        # RLS will enforce access control (only admins can delete)
    else:
        # Fallback: Verify access manually when no token available
        if not verify_user_entry_access(user_id, entry_id, "knowledge_entries"):
            log_security_event("DELETE_BLOCKED", user_id=user_id,
                              resource_type="knowledge_entry", resource_id=entry_id,
                              severity="WARNING")
            return False
        client = get_supabase_service()

    result = (client
        .table("knowledge_entries")
        .update({"is_active": False})
        .eq("id", entry_id)
        .execute())

    return len(result.data) > 0 if result.data else False


def generate_project_report(
    project_id: str,
    project_name: str,
    company_id: str,
    include_executive_summary: bool = True
) -> Dict[str, Any]:
    """
    Generate a professional report of all decisions made for a project.
    Returns structured data that can be rendered as HTML/PDF.

    The report is client-friendly - no mention of "AI Council" or internal tooling.
    """
    entries = get_knowledge_entries(
        company_id=company_id,
        project_id=project_id,
        limit=100  # Get all entries for the report
    )

    if not entries:
        return {
            "project_name": project_name,
            "generated_at": None,
            "entry_count": 0,
            "categories": {},
            "timeline": [],
            "executive_summary": "No decisions have been recorded for this project yet."
        }

    # Group entries by category
    categories: dict[str, list[dict[str, Any]]] = {}
    category_names = {
        'technical_decision': 'Technical Decisions',
        'ux_pattern': 'UX & Design Patterns',
        'feature': 'Features & Functionality',
        'policy': 'Policies & Guidelines',
        'process': 'Processes & Workflows'
    }

    for entry in entries:
        cat = entry.get('category', 'general')
        cat_display = category_names.get(cat, cat.replace('_', ' ').title())

        if cat_display not in categories:
            categories[cat_display] = []

        categories[cat_display].append({
            "title": entry.get('title', 'Untitled'),
            "summary": entry.get('summary', ''),
            "date": entry.get('created_at', '')[:10],
            "department": entry.get('department_id', 'General')
        })

    # Build timeline (chronological order)
    timeline = sorted(entries, key=lambda x: x.get('created_at', ''))
    timeline_items = [
        {
            "date": e.get('created_at', '')[:10],
            "title": e.get('title', 'Untitled'),
            "category": category_names.get(e.get('category', 'general'), 'Decision')
        }
        for e in timeline
    ]

    # Generate executive summary
    exec_summary = ""
    if include_executive_summary and entries:
        total = len(entries)
        date_range_start = timeline_items[0]['date'] if timeline_items else 'N/A'
        date_range_end = timeline_items[-1]['date'] if timeline_items else 'N/A'

        exec_summary = f"""This report summarizes {total} key decisions and recommendations made during the {project_name} project engagement, spanning from {date_range_start} to {date_range_end}.

The decisions cover the following areas:
"""
        for cat_name, cat_entries in categories.items():
            exec_summary += f"• {cat_name}: {len(cat_entries)} decision(s)\n"

        exec_summary += "\nEach decision includes the rationale and recommended approach based on thorough analysis and industry best practices."

    from datetime import datetime

    return {
        "project_name": project_name,
        "generated_at": datetime.utcnow().isoformat() + 'Z',
        "entry_count": len(entries),
        "categories": categories,
        "timeline": timeline_items,
        "executive_summary": exec_summary
    }
