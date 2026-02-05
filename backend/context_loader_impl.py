"""
Refactored context_loader.py - Breaking down the F-grade get_system_prompt_with_context function.

This module extracts helper functions to reduce cyclomatic complexity from F (56) to manageable levels.
"""

import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


def _normalize_role_and_department_ids(
    role_id: Optional[str],
    role_ids: Optional[List[str]],
    department_id: Optional[str],
    department_uuid: Optional[str],
    department_ids: Optional[List[str]]
) -> tuple[List[str], List[str]]:
    """
    Normalize single IDs to lists for unified processing.

    Returns:
        Tuple of (all_role_ids, all_department_ids)
    """
    all_role_ids = role_ids or ([role_id] if role_id else [])

    all_department_ids = []
    if department_ids:
        all_department_ids = department_ids
    elif department_uuid:
        all_department_ids = [department_uuid]
    elif department_id:
        all_department_ids = [department_id]

    return all_role_ids, all_department_ids


def _resolve_company_uuid(
    business_id: Optional[str],
    company_uuid: Optional[str],
    get_supabase_service
) -> Optional[str]:
    """
    Resolve company UUID from business_id slug if needed.

    Returns:
        company_uuid or None
    """
    if company_uuid:
        return company_uuid

    if not business_id:
        return None

    client = get_supabase_service()
    if not client:
        return None

    try:
        result = client.table("companies").select("id").eq("slug", business_id).execute()
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        logger.debug("Failed to resolve business slug %s: %s", business_id, e)

    return None


def _build_role_header_prompt(role_infos: List[Dict[str, Any]]) -> str:
    """
    Build the header section of system prompt based on selected roles.

    Args:
        role_infos: List of role data dictionaries

    Returns:
        Header prompt string
    """
    if len(role_infos) > 1:
        return _build_multiple_roles_prompt(role_infos)
    elif len(role_infos) == 1:
        return _build_single_role_prompt(role_infos[0])
    else:
        return _build_generic_advisor_prompt()


def _build_multiple_roles_prompt(role_infos: List[Dict[str, Any]]) -> str:
    """Build prompt for multiple selected roles."""
    role_names = [r.get('name', 'Unknown') for r in role_infos]
    role_names_str = ", ".join(role_names[:-1]) + " and " + role_names[-1] if len(role_names) > 1 else role_names[0]

    prompt = f"""=== COMBINED ROLES: {', '.join([r.upper() for r in role_names])} ===

You are an AI advisor providing perspectives from multiple roles: {role_names_str}. You are one of several AI models providing independent perspectives on this question.

Consider insights from all of these perspectives when responding:

"""
    for role_info in role_infos:
        role_name = role_info.get('name', 'Unknown')
        role_prompt = role_info.get('system_prompt', '')
        role_desc = role_info.get('description', '')

        prompt += f"--- {role_name.upper()} ---\n"
        if role_prompt:
            prompt += f"{role_prompt}\n\n"
        elif role_desc:
            prompt += f"{role_desc}\n\n"

    prompt += """=== END COMBINED ROLES ===

=== COMPANY CONTEXT ===

"""
    return prompt


def _build_single_role_prompt(role_info: Dict[str, Any]) -> str:
    """Build prompt for single selected role."""
    role_name = role_info.get('name', 'Role')
    role_prompt = role_info.get('system_prompt', '')
    role_desc = role_info.get('description', '')

    if role_prompt:
        return f"""=== ROLE: {role_name.upper()} ===

You are an AI advisor serving as a {role_name}. You are one of several AI models providing independent perspectives on this question.

{role_prompt}

=== END ROLE CONTEXT ===

=== COMPANY CONTEXT ===

"""
    else:
        return f"""You are an AI advisor serving as the {role_name} for this company. You are one of several AI models providing independent perspectives.

Your role: {role_desc}

Focus on aspects relevant to your role. Be practical and actionable.

=== COMPANY CONTEXT ===

"""


def _build_generic_advisor_prompt() -> str:
    """Build prompt for generic advisor (no roles selected)."""
    return """You are an AI advisor. You are one of several AI models providing independent perspectives on this question.

=== COMPANY CONTEXT ===

"""


def _inject_project_context(
    system_prompt: str,
    project_id: Optional[str],
    access_token: Optional[str],
    storage,
    truncate_to_limit,
    max_section_chars: int
) -> str:
    """
    Add project context to system prompt if project_id is provided.

    Returns:
        Updated system prompt
    """
    if not project_id or not access_token:
        return system_prompt

    project_context = storage.get_project_context(project_id, access_token)
    if not project_context:
        return system_prompt

    project = storage.get_project(project_id, access_token)
    project_name = project.get('name', 'Current Project') if project else 'Current Project'

    # Truncate project context if too large
    project_context = truncate_to_limit(project_context, max_section_chars // 2, "project context")

    system_prompt += f"\n=== PROJECT: {project_name.upper()} ===\n\n"
    system_prompt += "The user is currently working on this specific project/client. "
    system_prompt += "Ensure your advice is relevant to this project's context.\n\n"
    system_prompt += project_context
    system_prompt += "\n\n=== END PROJECT CONTEXT ===\n"

    return system_prompt


def _inject_department_contexts(
    system_prompt: str,
    all_department_ids: List[str],
    get_supabase_service,
    load_department_context_from_db,
    get_department_roles,
    is_valid_uuid
) -> str:
    """
    Add department-specific contexts for all selected departments.

    Returns:
        Updated system prompt
    """
    if not all_department_ids:
        return system_prompt

    client = get_supabase_service()

    for dept_id in all_department_ids:
        dept_context = load_department_context_from_db(dept_id)
        if not dept_context:
            continue

        # Get department name
        dept_name = _get_department_name(client, dept_id)

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

    return system_prompt


def _get_department_name(client, dept_id: str) -> str:
    """Get department name from database."""
    if not client:
        return "Department"

    try:
        result = client.table("departments").select("name, description").eq("id", dept_id).execute()
        if not result.data:
            result = client.table("departments").select("name, description").eq("slug", dept_id).execute()
        if result.data:
            return result.data[0].get("name", "Department")
    except Exception as e:
        logger.debug("Failed to resolve department name for %s: %s", dept_id, e)

    return "Department"


def _inject_playbooks(
    system_prompt: str,
    playbook_ids: Optional[List[str]],
    get_supabase_service,
    truncate_to_limit,
    max_section_chars: int
) -> str:
    """
    Add explicitly selected playbooks to system prompt.

    Returns:
        Updated system prompt
    """
    if not playbook_ids:
        return system_prompt

    client = get_supabase_service()
    if not client:
        return system_prompt

    for playbook_id in playbook_ids:
        try:
            # Get playbook info
            doc_result = client.table("org_documents").select(
                "id, title, doc_type, summary"
            ).eq("id", playbook_id).eq("is_active", True).execute()

            if not doc_result.data:
                continue

            doc = doc_result.data[0]
            doc_title = doc.get("title", "Playbook")
            doc_type = doc.get("doc_type", "document").upper()

            # Get current version content
            version_result = client.table("org_document_versions").select(
                "content"
            ).eq("document_id", playbook_id).eq("is_current", True).execute()

            if version_result.data and version_result.data[0].get("content"):
                content = version_result.data[0]["content"]
                content = truncate_to_limit(content, max_section_chars // 3, f"{doc_type} content")

                system_prompt += f"\n=== {doc_type}: {doc_title.upper()} ===\n\n"
                system_prompt += content
                system_prompt += f"\n\n=== END {doc_type} ===\n"
        except Exception as e:
            logger.warning("Failed to load playbook %s: %s", playbook_id, e)

    return system_prompt


def _add_response_guidance(
    system_prompt: str,
    role_infos: List[Dict[str, Any]],
    all_role_ids: List[str],
    all_department_ids: List[str],
    is_valid_uuid
) -> str:
    """
    Add general response guidance and role-specific instructions.

    Returns:
        Updated system prompt
    """
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

    # Add role-specific guidance
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

    return system_prompt
