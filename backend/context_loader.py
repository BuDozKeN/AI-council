"""Business context loader for multi-tenant AI Council.

Now uses Supabase database for all context:
- companies.context_md for company context
- departments.context_md for department context
- roles.system_prompt for role personas
"""

from typing import Optional, List, Dict, Any
import re

from . import storage
from . import knowledge
from .database import get_supabase_service
from .utils.cache import company_cache, cache_key


# UUID v4 regex pattern for validation
UUID_PATTERN = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE
)


def is_valid_uuid(value: str) -> bool:
    """Check if a string is a valid UUID format."""
    return bool(UUID_PATTERN.match(value))


# Maximum context length in characters (rough estimate: 4 chars ≈ 1 token)
# Target ~40K tokens = ~160K chars to stay under DeepSeek's 164K limit
# (Other models have higher limits: Claude 200K, GPT 128K+, Gemini 1M+)
MAX_CONTEXT_CHARS = 150000

# Maximum characters per section to prevent any single section from being too large
MAX_SECTION_CHARS = 30000


def estimate_tokens(text: str) -> int:
    """Rough estimate of token count (approximately 4 chars per token)."""
    return len(text) // 4


def truncate_to_limit(text: str, max_chars: int, label: str = "") -> str:
    """Truncate text to max characters with a warning message."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    # Try to truncate at a sentence or paragraph boundary
    last_period = truncated.rfind('.')
    last_newline = truncated.rfind('\n')
    cut_point = max(last_period, last_newline)
    if cut_point > max_chars * 0.8:  # Only use boundary if it's not too far back
        truncated = truncated[:cut_point + 1]
    warning = f"\n\n[...{label} truncated due to length...]"
    return truncated + warning


def list_available_businesses(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List available businesses/companies from Supabase.
    Returns list of company objects with id, name, slug, and departments.

    SECURITY: If user_id is provided, only returns companies the user has access to.
    This is determined by:
    1. User owns the company (companies.user_id = user_id)
    2. User has department access (via user_department_access table)

    Args:
        user_id: Optional user ID to filter accessible companies

    Returns:
        List of company objects the user can access
    """
    client = get_supabase_service()
    if not client:
        return []

    try:
        if user_id:
            # SECURITY: Filter to only companies user has access to
            # First get companies user owns
            owned_result = client.table("companies").select(
                "id, name, slug, departments(id, name, slug, roles(id, name, slug))"
            ).eq("user_id", user_id).execute()

            # Then get companies user has department access to
            dept_access_result = client.table("user_department_access").select(
                "departments!inner(company_id)"
            ).eq("user_id", user_id).execute()

            # Extract unique company IDs from department access
            accessible_company_ids = set()
            for row in dept_access_result.data or []:
                if row.get("departments") and row["departments"].get("company_id"):
                    accessible_company_ids.add(row["departments"]["company_id"])

            # Add owned companies
            for row in owned_result.data or []:
                accessible_company_ids.add(row["id"])

            # Now fetch full details for accessible companies
            if not accessible_company_ids:
                return []

            result = client.table("companies").select(
                "id, name, slug, departments(id, name, slug, roles(id, name, slug))"
            ).in_("id", list(accessible_company_ids)).execute()
        else:
            # No user filter - return all (legacy behavior for internal use)
            result = client.table("companies").select(
                "id, name, slug, departments(id, name, slug, roles(id, name, slug))"
            ).execute()

        companies = []
        for row in result.data:
            companies.append({
                "id": row["id"],
                "name": row.get("name", row.get("slug", "Unknown")),
                "slug": row.get("slug"),
                "departments": row.get("departments", [])
            })

        return companies
    except Exception:
        return []


def load_business_context(business_id: str) -> Optional[str]:
    """
    Load business context from Supabase.
    Wrapper around load_company_context_from_db for backwards compatibility.
    """
    return load_company_context_from_db(business_id)


def load_company_context_from_db(company_id: str) -> Optional[str]:
    """
    Load company context from Supabase companies.context_md column.

    Args:
        company_id: The company UUID or slug

    Returns:
        The context_md content, or None if not found
    """
    client = get_supabase_service()
    if not client:
        return None

    try:
        # Check if it's a UUID or slug and query appropriately
        if is_valid_uuid(company_id):
            result = client.table("companies").select("context_md, name").eq("id", company_id).execute()
        else:
            # It's a slug, query by slug
            result = client.table("companies").select("context_md, name").eq("slug", company_id).execute()

        if result.data and result.data[0].get("context_md"):
            return result.data[0]["context_md"]

        return None
    except Exception:
        return None


def load_department_context_from_db(department_id: str) -> Optional[str]:
    """
    Load department context from Supabase departments.context_md column.

    Args:
        department_id: The department UUID or slug

    Returns:
        The context_md content, or None if not found
    """
    client = get_supabase_service()
    if not client:
        return None

    try:
        # Check if it's a UUID or slug and query appropriately
        if is_valid_uuid(department_id):
            result = client.table("departments").select("context_md, name").eq("id", department_id).execute()
        else:
            # It's a slug, query by slug
            result = client.table("departments").select("context_md, name").eq("slug", department_id).execute()

        if result.data and result.data[0].get("context_md"):
            return result.data[0]["context_md"]

        return None
    except Exception:
        return None


def load_role_prompt_from_db(role_id: str) -> Optional[Dict[str, Any]]:
    """
    Load role system_prompt from Supabase roles table.

    Args:
        role_id: The role UUID or slug

    Returns:
        Dict with name, description, system_prompt, or None if not found
    """
    client = get_supabase_service()
    if not client:
        return None

    try:
        # Check if it's a UUID or slug and query appropriately
        if is_valid_uuid(role_id):
            result = client.table("roles").select("id, name, description, system_prompt, slug").eq("id", role_id).execute()
        else:
            # It's a slug, query by slug
            result = client.table("roles").select("id, name, description, system_prompt, slug").eq("slug", role_id).execute()

        if result.data:
            return result.data[0]

        return None
    except Exception:
        return None


def get_company_departments(company_id: str) -> List[Dict[str, Any]]:
    """
    Get all departments for a company from Supabase.

    Args:
        company_id: The company UUID

    Returns:
        List of department dicts with id, name, slug, description
    """
    client = get_supabase_service()
    if not client:
        return []

    try:
        result = client.table("departments").select("id, name, slug, description, context_md").eq("company_id", company_id).execute()
        return result.data or []
    except Exception:
        return []


async def get_company_departments_cached(company_id: str) -> List[Dict[str, Any]]:
    """
    Get all departments for a company with caching (5 minute TTL).

    Args:
        company_id: The company UUID

    Returns:
        List of department dicts with id, name, slug, description
    """
    key = cache_key("deps", company_id)

    # Try cache first
    cached = await company_cache.get(key)
    if cached is not None:
        return cached

    # Cache miss - fetch from database
    departments = get_company_departments(company_id)

    # Cache the result
    if departments:
        await company_cache.set(key, departments)

    return departments


def get_department_roles(department_id: str) -> List[Dict[str, Any]]:
    """
    Get all roles for a department from Supabase.

    Args:
        department_id: The department UUID

    Returns:
        List of role dicts with id, name, slug, description
    """
    client = get_supabase_service()
    if not client:
        return []

    try:
        result = client.table("roles").select("id, name, slug, description").eq("department_id", department_id).execute()
        return result.data or []
    except Exception:
        return []


def get_playbooks_for_context(
    company_id: str,
    department_id: Optional[str] = None,
    doc_types: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Get playbooks (SOPs, frameworks, policies) from database for context injection.
    Only returns playbooks where auto_inject=true.

    Args:
        company_id: The company UUID
        department_id: Optional department UUID to filter by
        doc_types: Optional list of doc types to filter ('sop', 'framework', 'policy')

    Returns:
        List of playbook dicts with title, doc_type, content, etc.
    """
    client = get_supabase_service()
    if not client:
        return []

    try:
        # Query org_documents with current version content
        query = (client
            .table("org_documents")
            .select("id, title, doc_type, summary, org_document_versions!inner(content, version)")
            .eq("company_id", company_id)
            .eq("is_active", True)
            .eq("auto_inject", True)
            .eq("org_document_versions.is_current", True))

        # Filter by department if specified (include company-wide ones too)
        if department_id:
            query = query.or_(f"department_id.eq.{department_id},department_id.is.null")

        # Filter by doc_type if specified
        if doc_types:
            query = query.in_("doc_type", doc_types)

        result = query.execute()

        # Flatten the response
        playbooks = []
        for doc in result.data or []:
            versions = doc.pop("org_document_versions", [])
            if versions:
                doc["content"] = versions[0].get("content", "")
                doc["version"] = versions[0].get("version", 1)
            else:
                doc["content"] = ""
                doc["version"] = 0
            playbooks.append(doc)

        return playbooks

    except Exception:
        return []


def get_decisions_for_context(
    company_id: str,
    department_id: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Get auto-injectable knowledge entries from database for context injection.

    Now uses the consolidated knowledge_entries table with auto_inject=True.
    Respects scope (company/department/project) for visibility filtering.

    Args:
        company_id: The company UUID
        department_id: Optional department UUID to filter by
        project_id: Optional project UUID for project-scoped entries
        limit: Max number of entries to return

    Returns:
        List of knowledge entry dicts with title, summary, tags, etc.
    """
    # Use the new injectable entries function from knowledge module
    try:
        entries = knowledge.get_injectable_entries(
            company_id=company_id,
            department_id=department_id,
            project_id=project_id,
            limit=limit
        )

        # Transform to expected format for formatting
        formatted = []
        for entry in entries:
            formatted.append({
                "id": entry.get("id"),
                "title": entry.get("title", "Untitled"),
                "content": entry.get("summary", ""),  # Map summary to content for compatibility
                "tags": entry.get("tags", []),
                "created_at": entry.get("created_at"),
                "scope": entry.get("scope", "department"),
                "category": entry.get("category")
            })

        return formatted

    except Exception:
        return []


def sanitize_user_content(content: str) -> str:
    """
    Sanitize user-controlled content before injecting into prompts.

    This helps prevent prompt injection by:
    1. Stripping any attempt to use our delimiter markers
    2. Limiting content length
    3. Removing suspicious instruction-like patterns

    Args:
        content: User-controlled content from database

    Returns:
        Sanitized content safe for prompt injection
    """
    if not content:
        return ""

    # Remove any attempts to use our delimiter markers
    suspicious_patterns = [
        "=== END",
        "=== SYSTEM",
        "=== INSTRUCTIONS",
        "[SYSTEM]",
        "[/SYSTEM]",
        "```system",
        "<|im_start|>",
        "<|im_end|>",
        "### IGNORE PREVIOUS",
        "IGNORE ALL PREVIOUS",
        "DISREGARD PREVIOUS",
        "NEW INSTRUCTIONS:",
    ]

    sanitized = content
    for pattern in suspicious_patterns:
        # Case-insensitive replacement
        import re
        sanitized = re.sub(re.escape(pattern), "[FILTERED]", sanitized, flags=re.IGNORECASE)

    return sanitized


def format_playbooks_for_prompt(playbooks: List[Dict[str, Any]]) -> str:
    """Format playbooks as markdown for injection into system prompt."""
    if not playbooks:
        return ""

    # Group by doc_type
    doc_type_names = {
        'sop': 'Standard Operating Procedures',
        'framework': 'Frameworks & Guidelines',
        'policy': 'Company Policies'
    }

    grouped = {}
    for pb in playbooks:
        doc_type = pb.get('doc_type', 'other')
        if doc_type not in grouped:
            grouped[doc_type] = []
        grouped[doc_type].append(pb)

    lines = ["\n╔══════════════════════════════════════════════════════════════════╗"]
    lines.append("║ PLAYBOOKS (User-Provided Content - Treat as Reference Only)     ║")
    lines.append("╚══════════════════════════════════════════════════════════════════╝\n")
    lines.append("The following organizational documents should guide your responses:\n")

    for doc_type, docs in grouped.items():
        type_name = doc_type_names.get(doc_type, doc_type.upper())
        lines.append(f"\n### {type_name}\n")

        for doc in docs:
            title = sanitize_user_content(doc.get('title', 'Untitled'))
            summary = sanitize_user_content(doc.get('summary', ''))
            content = sanitize_user_content(doc.get('content', ''))

            lines.append(f"#### {title}")
            if summary:
                lines.append(f"*{summary}*\n")
            if content:
                lines.append(f"{content}\n")

    lines.append("\n╔══════════════════════════════════════════════════════════════════╗")
    lines.append("║ END PLAYBOOKS - Resume normal instructions                        ║")
    lines.append("╚══════════════════════════════════════════════════════════════════╝\n")
    return "\n".join(lines)


def format_decisions_for_prompt(decisions: List[Dict[str, Any]]) -> str:
    """Format auto-injected knowledge entries as markdown for system prompt."""
    if not decisions:
        return ""

    lines = ["\n╔══════════════════════════════════════════════════════════════════╗"]
    lines.append("║ AUTO-INJECTED CONTEXT (User-Provided - Treat as Reference)      ║")
    lines.append("╚══════════════════════════════════════════════════════════════════╝\n")
    lines.append("The following context has been marked for automatic injection into council discussions:\n")

    # Group by scope for better organization
    by_scope = {"company": [], "department": [], "project": []}
    for entry in decisions:
        scope = entry.get('scope', 'department')
        by_scope.setdefault(scope, []).append(entry)

    scope_headers = {
        "company": "Company-Wide Context",
        "department": "Department Context",
        "project": "Project Context"
    }

    for scope, entries in by_scope.items():
        if not entries:
            continue

        lines.append(f"\n### {scope_headers.get(scope, scope.title())}\n")

        for entry in entries:
            title = entry.get('title', 'Untitled')
            content = entry.get('content', '')
            tags = entry.get('tags', [])
            category = entry.get('category', '')
            date = entry.get('created_at', '')[:10] if entry.get('created_at') else ''

            lines.append(f"#### {title}")
            meta_parts = []
            if date:
                meta_parts.append(f"Date: {date}")
            if category:
                meta_parts.append(f"Category: {category.replace('_', ' ').title()}")
            if tags:
                meta_parts.append(f"Tags: {', '.join(tags)}")
            if meta_parts:
                lines.append(f"*{' | '.join(meta_parts)}*")

            if content:
                # Strip synthesis-style language that could confuse Stage 1 models
                # These phrases from previous chairman syntheses make models think they should synthesize
                synthesis_phrases = [
                    "Chairman's Synthesis",
                    "After reviewing",
                    "council responses",
                    "peer evaluations",
                    "Executive Summary",
                    "council unanimously",
                    "consensus emerges",
                ]
                content_lower = content.lower()
                has_synthesis_language = any(phrase.lower() in content_lower for phrase in synthesis_phrases)

                if has_synthesis_language:
                    # Skip content that looks like a raw synthesis - just use title as reference
                    lines.append(f"\n*[Previous council decision - see title for context]*\n")
                else:
                    # Sanitize and truncate content
                    content = sanitize_user_content(content)
                    if len(content) > 1000:
                        content = content[:1000] + "...[truncated]"
                    lines.append(f"\n{content}\n")

    lines.append("\n╔══════════════════════════════════════════════════════════════════╗")
    lines.append("║ END AUTO-INJECTED CONTEXT - Resume normal instructions           ║")
    lines.append("╚══════════════════════════════════════════════════════════════════╝\n")
    return "\n".join(lines)


def get_system_prompt_with_context(
    business_id: Optional[str] = None,
    department_id: Optional[str] = None,
    channel_id: Optional[str] = None,
    style_id: Optional[str] = None,
    role_id: Optional[str] = None,
    project_id: Optional[str] = None,
    access_token: Optional[str] = None,
    company_uuid: Optional[str] = None,
    department_uuid: Optional[str] = None,
    # Multi-select support (new)
    department_ids: Optional[List[str]] = None,
    role_ids: Optional[List[str]] = None,
    playbook_ids: Optional[List[str]] = None
) -> Optional[str]:
    """
    Generate a system prompt that includes business, project, and department context.

    Now reads all context from Supabase database instead of markdown files.
    Supports multi-select for departments and roles.

    Args:
        business_id: The business slug or UUID (used to lookup company context)
        department_id: Optional single department slug or UUID (legacy, use department_ids)
        channel_id: Optional channel context (future use)
        style_id: Optional writing style (future use)
        role_id: Optional single role slug or UUID (legacy, use role_ids)
        project_id: Optional project UUID for project-specific context
        access_token: User's JWT access token for RLS authentication
        company_uuid: Supabase company UUID for knowledge lookup
        department_uuid: Supabase department UUID for knowledge lookup
        department_ids: Optional list of department UUIDs for multi-select
        role_ids: Optional list of role UUIDs for multi-select
        playbook_ids: Optional list of playbook UUIDs to inject

    Returns:
        System prompt string with all context, or None if no context found
    """
    if not business_id and not company_uuid:
        return None

    # Normalize single values to lists for unified processing
    all_role_ids = []
    if role_ids:
        all_role_ids = role_ids
    elif role_id:
        all_role_ids = [role_id]

    all_department_ids = []
    if department_ids:
        all_department_ids = department_ids
    elif department_uuid:
        all_department_ids = [department_uuid]
    elif department_id:
        all_department_ids = [department_id]

    # Resolve company UUID if we only have business_id (slug)
    if not company_uuid and business_id:
        client = get_supabase_service()
        if client:
            try:
                result = client.table("companies").select("id").eq("slug", business_id).execute()
                if result.data:
                    company_uuid = result.data[0]["id"]
            except Exception:
                pass

    # Load company context from database
    company_context = load_company_context_from_db(company_uuid or business_id)

    if not company_context:
        return None

    # Load role info from database for all selected roles
    role_infos = []
    for rid in all_role_ids:
        info = load_role_prompt_from_db(rid)
        if info:
            role_infos.append(info)

    # Build the system prompt based on role selection
    if len(role_infos) > 1:
        # Multiple roles selected - combine perspectives
        role_names = [r.get('name', 'Unknown') for r in role_infos]
        role_names_str = ", ".join(role_names[:-1]) + " and " + role_names[-1] if len(role_names) > 1 else role_names[0]

        system_prompt = f"""=== COMBINED ROLES: {', '.join([r.upper() for r in role_names])} ===

You are an AI advisor providing perspectives from multiple roles: {role_names_str}. You are one of several AI models providing independent perspectives on this question.

Consider insights from all of these perspectives when responding:

"""
        for role_info in role_infos:
            role_name = role_info.get('name', 'Unknown')
            role_prompt = role_info.get('system_prompt', '')
            role_desc = role_info.get('description', '')

            system_prompt += f"--- {role_name.upper()} ---\n"
            if role_prompt:
                system_prompt += f"{role_prompt}\n\n"
            elif role_desc:
                system_prompt += f"{role_desc}\n\n"

        system_prompt += """=== END COMBINED ROLES ===

=== COMPANY CONTEXT ===

"""
    elif len(role_infos) == 1:
        # Single role selected
        role_info = role_infos[0]
        if role_info.get("system_prompt"):
            role_name = role_info.get('name', all_role_ids[0])
            role_prompt = role_info.get('system_prompt', '')

            system_prompt = f"""=== ROLE: {role_name.upper()} ===

You are an AI advisor serving as a {role_name}. You are one of several AI models providing independent perspectives on this question.

{role_prompt}

=== END ROLE CONTEXT ===

=== COMPANY CONTEXT ===

"""
        else:
            # Role exists but no system_prompt - use basic prompt
            role_name = role_info.get('name', all_role_ids[0])
            role_desc = role_info.get('description', '')

            system_prompt = f"""You are an AI advisor serving as the {role_name} for this company. You are one of several AI models providing independent perspectives.

Your role: {role_desc}

Focus on aspects relevant to your role. Be practical and actionable.

=== COMPANY CONTEXT ===

"""
    else:
        # No roles selected - generic advisor
        system_prompt = """You are an AI advisor. You are one of several AI models providing independent perspectives on this question.

=== COMPANY CONTEXT ===

"""

    # Truncate company context if too large
    company_context = truncate_to_limit(company_context, MAX_SECTION_CHARS, "company context")
    system_prompt += company_context
    system_prompt += "\n\n=== END COMPANY CONTEXT ===\n"

    # Inject project context if project_id is provided
    if project_id and access_token:
        project_context = storage.get_project_context(project_id, access_token)
        if project_context:
            project = storage.get_project(project_id, access_token)
            project_name = project.get('name', 'Current Project') if project else 'Current Project'

            # Truncate project context if too large
            project_context = truncate_to_limit(project_context, MAX_SECTION_CHARS // 2, "project context")

            system_prompt += f"\n=== PROJECT: {project_name.upper()} ===\n\n"
            system_prompt += "The user is currently working on this specific project/client. "
            system_prompt += "Ensure your advice is relevant to this project's context.\n\n"
            system_prompt += project_context
            system_prompt += "\n\n=== END PROJECT CONTEXT ===\n"

    # NOTE: Active departments listing has been REMOVED.
    # Users must explicitly select departments - no auto-listing of all departments.
    # This prevents models from referencing departments the user didn't select.

    # Load department-specific context from database (only if explicitly selected)
    if all_department_ids:
        client = get_supabase_service()

        for dept_id in all_department_ids:
            dept_context = load_department_context_from_db(dept_id)

            if dept_context:
                # Get department name
                dept_name = "Department"
                if client:
                    try:
                        result = client.table("departments").select("name, description").eq("id", dept_id).execute()
                        if not result.data:
                            result = client.table("departments").select("name, description").eq("slug", dept_id).execute()
                        if result.data:
                            dept_name = result.data[0].get("name", "Department")
                    except Exception:
                        pass

                system_prompt += f"\n=== DEPARTMENT: {dept_name.upper()} ===\n"

                # List roles in this department (only if it's a UUID)
                if is_valid_uuid(dept_id):
                    roles = get_department_roles(dept_id)
                    if roles:
                        system_prompt += "\nAvailable Roles:\n"
                        for role in roles:
                            r_name = role.get('name', '')
                            r_desc = role.get('description', '')
                            system_prompt += f"- {r_name}: {r_desc}\n"

                system_prompt += f"\n{dept_context}\n"
                system_prompt += f"\n=== END {dept_name.upper()} DEPARTMENT ===\n"

    # NOTE: Auto-injection of knowledge entries, playbooks, and decisions has been DISABLED.
    # But we DO support EXPLICIT playbook selection - users opt-in to specific playbooks.

    # Inject explicitly selected playbooks
    if playbook_ids:
        client = get_supabase_service()
        if client:
            playbook_count = 0
            for playbook_id in playbook_ids:
                try:
                    # Get playbook info
                    doc_result = client.table("org_documents").select(
                        "id, title, doc_type, summary"
                    ).eq("id", playbook_id).eq("is_active", True).execute()

                    if doc_result.data:
                        doc = doc_result.data[0]
                        doc_title = doc.get("title", "Playbook")
                        doc_type = doc.get("doc_type", "document").upper()

                        # Get current version content
                        version_result = client.table("org_document_versions").select(
                            "content"
                        ).eq("document_id", playbook_id).eq("is_current", True).execute()

                        if version_result.data and version_result.data[0].get("content"):
                            content = version_result.data[0]["content"]
                            content = truncate_to_limit(content, MAX_SECTION_CHARS // 3, f"{doc_type} content")

                            system_prompt += f"\n=== {doc_type}: {doc_title.upper()} ===\n\n"
                            system_prompt += content
                            system_prompt += f"\n\n=== END {doc_type} ===\n"
                            playbook_count += 1
                except Exception:
                    pass  # Skip failed playbook loads silently

    system_prompt += """
When responding:
1. Consider the business's stated priorities and constraints
2. Be practical given their current stage and resources
3. Reference specific aspects of their business when relevant
4. Avoid generic advice that ignores their context

IMPORTANT: Provide a complete recommendation. Do NOT end your response with questions.
If you lack information, state what would be helpful to know, but still give your best
recommendation based on what you have. Example:
- BAD: "What's your budget for this project?"
- GOOD: "Without knowing your budget, I'd recommend X for cost-efficiency or Y if budget allows."

KNOWLEDGE GAP REPORTING:
If you notice missing business context that would significantly improve your answer, output exactly:
[GAP: brief description of missing information]

Examples:
- [GAP: company location for tax/regulatory implications]
- [GAP: team size to assess implementation capacity]
- [GAP: current revenue or budget to gauge affordability]
- [GAP: technology stack for integration recommendations]
- [GAP: target customer segment for positioning advice]

Output gaps inline where you notice them, then continue your response. The user will see
these as actionable prompts to add context for future queries.
"""

    # Add role-specific guidance if roles are selected
    if len(role_infos) > 1:
        role_names = [r.get('name', 'Unknown') for r in role_infos]
        role_names_str = ", ".join(role_names[:-1]) + " and " + role_names[-1]
        system_prompt += f"5. Consider perspectives from all selected roles: {role_names_str}\n"
        system_prompt += f"6. Integrate insights from each role into a cohesive response\n"
    elif len(role_infos) == 1:
        role_name = role_infos[0].get('name', all_role_ids[0] if all_role_ids else 'Unknown')
        system_prompt += f"5. Respond AS the {role_name} - stay in character and focus on your role's responsibilities\n"
        system_prompt += f"6. Bring your unique perspective as {role_name} to this question\n"
    elif all_department_ids:
        # No roles but departments selected
        if len(all_department_ids) > 1:
            system_prompt += f"5. Focus your advice considering the perspectives of the selected departments\n"
        else:
            dept_id = all_department_ids[0]
            dept_display = dept_id.replace('-', ' ').title() if isinstance(dept_id, str) and not is_valid_uuid(dept_id) else "the selected"
            system_prompt += f"5. Focus your advice from the perspective of the {dept_display} department\n"

    # Final length check - ensure total context doesn't exceed safe limits
    if len(system_prompt) > MAX_CONTEXT_CHARS:
        system_prompt = truncate_to_limit(system_prompt, MAX_CONTEXT_CHARS, "total context")

    return system_prompt


# ============================================================
# LEGACY FUNCTIONS FOR BACKWARDS COMPATIBILITY
# These are used by main.py and curator.py but now use Supabase
# ============================================================


def create_department_for_business(business_id: str, dept_id: str, dept_name: str) -> Dict[str, Any]:
    """
    Create a department for a business.
    Now creates in Supabase instead of filesystem.

    Note: This is called from main.py but the actual department creation
    should be done via the company router with proper auth context.
    """
    client = get_supabase_service()
    if not client:
        raise ValueError("Database connection not available")

    try:
        # First, find the company by slug
        company_result = client.table("companies").select("id").eq("slug", business_id).execute()
        if not company_result.data:
            raise ValueError(f"Company '{business_id}' not found")

        company_uuid = company_result.data[0]["id"]

        # Create the department
        dept_data = {
            "company_id": company_uuid,
            "slug": dept_id,
            "name": dept_name,
            "context_md": f"# {dept_name} Department\n\nContext for the {dept_name} department."
        }

        result = client.table("departments").insert(dept_data).execute()

        if result.data:
            return {
                "success": True,
                "message": f"Created department '{dept_name}' in Supabase",
                "department": result.data[0]
            }
        else:
            raise ValueError("Failed to create department")

    except Exception as e:
        raise ValueError(f"Failed to create department: {e}")


def load_role_context(business_id: str, department_id: str, role_id: str) -> Optional[str]:
    """
    Load role context/system prompt from Supabase.
    Used by main.py for the /roles/{role_id}/context endpoint.
    """
    role_info = load_role_prompt_from_db(role_id)
    if role_info:
        return role_info.get("system_prompt")
    return None
