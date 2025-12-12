"""
My Company API Router

Unified endpoints for managing company organization:
- Overview (company info + stats)
- Team (departments & roles)
- Playbooks (SOPs, frameworks, policies)
- Decisions (saved council outputs)

Per Council recommendation: ALL data comes from Supabase database.
The filesystem (councils/organisations/) is deprecated for runtime use.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from ..auth import get_current_user
from ..database import get_supabase_with_auth, get_supabase_service


router = APIRouter(prefix="/api/company", tags=["company"])


# ============================================
# PYDANTIC MODELS
# ============================================

class DepartmentCreate(BaseModel):
    """Create a new department."""
    name: str
    slug: str
    description: Optional[str] = None
    purpose: Optional[str] = None


class DepartmentUpdate(BaseModel):
    """Update a department."""
    name: Optional[str] = None
    description: Optional[str] = None
    purpose: Optional[str] = None
    context_md: Optional[str] = None


class RoleCreate(BaseModel):
    """Create a new role."""
    name: str
    slug: str
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    system_prompt: Optional[str] = None


class RoleUpdate(BaseModel):
    """Update a role."""
    name: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    system_prompt: Optional[str] = None


class PlaybookCreate(BaseModel):
    """Create a new playbook (SOP/framework/policy)."""
    title: str
    slug: str
    doc_type: str  # 'sop', 'framework', 'policy'
    content: str
    summary: Optional[str] = None
    department_id: Optional[str] = None
    auto_inject: bool = True
    tags: List[str] = []
    additional_departments: List[str] = []  # Additional department IDs for visibility


class PlaybookUpdate(BaseModel):
    """Update a playbook."""
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    auto_inject: Optional[bool] = None
    change_summary: Optional[str] = None
    tags: Optional[List[str]] = None
    additional_departments: Optional[List[str]] = None  # Replace all additional departments


class DecisionCreate(BaseModel):
    """Save a council decision."""
    title: str
    content: str
    department_id: Optional[str] = None
    source_conversation_id: Optional[str] = None
    source_message_id: Optional[str] = None
    tags: List[str] = []
    council_type: Optional[str] = None  # e.g., "CTO Council", "Legal Council", "Board"


class PromoteDecision(BaseModel):
    """Promote a decision to a playbook."""
    doc_type: str  # 'sop', 'framework', 'policy'
    title: str
    slug: Optional[str] = None  # Auto-generated from title if not provided
    summary: Optional[str] = None


# ============================================
# HELPER FUNCTIONS
# ============================================

def get_client(user):
    """Get authenticated Supabase client."""
    # user is a dict from get_current_user, access with bracket notation
    if isinstance(user, dict):
        access_token = user.get('access_token')
    else:
        access_token = user.access_token
    return get_supabase_with_auth(access_token)


def get_service_client():
    """
    Get Supabase service client (bypasses RLS).
    Used for read-only operations where user is already authenticated.
    """
    client = get_supabase_service()
    if not client:
        raise HTTPException(status_code=500, detail="Service client not configured")
    return client


def resolve_company_id(client, company_id: str) -> str:
    """
    Resolve company_id to UUID.
    Accepts either a UUID or a slug, returns the UUID.
    """
    # Check if it's a valid UUID format
    import re
    uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)

    if uuid_pattern.match(company_id):
        return company_id

    # Otherwise, look up by slug
    result = client.table("companies").select("id").eq("slug", company_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Company not found: {company_id}")

    return result.data["id"]


# ============================================
# OVERVIEW ENDPOINTS
# ============================================

@router.get("/{company_id}/overview")
async def get_company_overview(company_id: str, user=Depends(get_current_user)):
    """
    Get company overview with stats from DATABASE.
    Returns company info + counts of departments, roles, playbooks, decisions.

    Per Council recommendation: ALL data comes from Supabase.
    Uses service client to bypass RLS for read-only company data.
    """
    # Use service client to bypass RLS for read operations
    # User is already authenticated via get_current_user
    client = get_service_client()

    # Resolve company UUID from slug
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=f"Company not found: {company_id}")

    # Get company details from database
    company_result = client.table("companies") \
        .select("*") \
        .eq("id", company_uuid) \
        .single() \
        .execute()

    if not company_result.data:
        raise HTTPException(status_code=404, detail=f"Company not found: {company_id}")

    company_data = company_result.data

    # Count departments
    dept_result = client.table("departments") \
        .select("id", count="exact") \
        .eq("company_id", company_uuid) \
        .execute()
    dept_count = dept_result.count or 0

    # Count roles
    role_result = client.table("roles") \
        .select("id", count="exact") \
        .eq("company_id", company_uuid) \
        .execute()
    role_count = role_result.count or 0

    # Count playbooks
    playbook_result = client.table("org_documents") \
        .select("id", count="exact") \
        .eq("company_id", company_uuid) \
        .execute()
    playbook_count = playbook_result.count or 0

    # Count decisions (now from knowledge_entries table)
    decision_result = client.table("knowledge_entries") \
        .select("id", count="exact") \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .execute()
    decision_count = decision_result.count or 0

    return {
        "company": {
            "id": company_data.get("id"),
            "slug": company_data.get("slug"),
            "name": company_data.get("name", company_id.replace('-', ' ').title()),
            "context_md": company_data.get("context_md", "")
        },
        "stats": {
            "departments": dept_count,
            "roles": role_count,
            "playbooks": playbook_count,
            "decisions": decision_count
        }
    }


class CompanyContextUpdate(BaseModel):
    """Update company context."""
    context_md: str


@router.put("/{company_id}/context")
async def update_company_context(company_id: str, data: CompanyContextUpdate, user=Depends(get_current_user)):
    """
    Update the company context markdown.
    This is the master context document containing mission, goals, strategy, etc.

    Uses service client to bypass RLS since companies table may not have user-level UPDATE policies.
    User authentication is verified via get_current_user dependency.
    """
    # Use service client to bypass RLS for company updates
    # User is already authenticated via get_current_user
    client = get_service_client()

    # Resolve company UUID from slug
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=f"Company not found: {company_id}")

    # Update the company's context_md
    result = client.table("companies") \
        .update({
            "context_md": data.context_md
        }) \
        .eq("id", company_uuid) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Company not found")

    return {"company": result.data[0]}


# ============================================
# TEAM ENDPOINTS (Departments & Roles)
# ============================================

@router.get("/{company_id}/team")
async def get_team(company_id: str, user=Depends(get_current_user)):
    """
    Get all departments with their roles from DATABASE.
    Returns hierarchical structure: departments → roles.

    Per Council recommendation: ALL data comes from Supabase.
    Uses service client to bypass RLS for read-only company data.
    """
    # Use service client to bypass RLS for read operations
    # User is already authenticated via get_current_user
    client = get_service_client()

    # Resolve company UUID from slug
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail=f"Company not found: {company_id}")

    # Get departments from database
    dept_result = client.table("departments") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .order("display_order") \
        .execute()

    if not dept_result.data:
        return {"departments": []}

    # Get all roles for this company
    roles_result = client.table("roles") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .order("display_order") \
        .execute()

    # Group roles by department_id
    roles_by_dept = {}
    for role in (roles_result.data or []):
        dept_id = role.get("department_id")
        if dept_id not in roles_by_dept:
            roles_by_dept[dept_id] = []
        roles_by_dept[dept_id].append(role)

    # Build response
    result = []
    for dept in dept_result.data:
        dept_id = dept.get("id")
        dept_roles = roles_by_dept.get(dept_id, [])

        dept_data = {
            "id": dept_id,
            "name": dept.get("name"),
            "slug": dept.get("slug"),
            "description": dept.get("description", ""),
            "purpose": dept.get("purpose", ""),
            "context_md": dept.get("context_md", ""),
            "roles": []
        }

        for role in dept_roles:
            dept_data["roles"].append({
                "id": role.get("id"),
                "name": role.get("name"),
                "slug": role.get("slug"),
                "title": role.get("title", ""),
                "description": role.get("description", ""),
                "system_prompt": role.get("system_prompt", ""),
                "responsibilities": role.get("responsibilities", "")
            })

        result.append(dept_data)

    return {"departments": result}


@router.post("/{company_id}/departments")
async def create_department(company_id: str, data: DepartmentCreate, user=Depends(get_current_user)):
    """Create a new department."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get current max display_order
    existing = client.table("departments") \
        .select("display_order") \
        .eq("company_id", company_uuid) \
        .order("display_order", desc=True) \
        .limit(1) \
        .execute()

    next_order = (existing.data[0]["display_order"] + 1) if existing.data else 0

    result = client.table("departments").insert({
        "company_id": company_uuid,
        "name": data.name,
        "slug": data.slug,
        "description": data.description,
        "purpose": data.purpose,
        "display_order": next_order
    }).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create department")

    return {"department": result.data[0]}


@router.put("/{company_id}/departments/{dept_id}")
async def update_department(company_id: str, dept_id: str, data: DepartmentUpdate, user=Depends(get_current_user)):
    """Update a department."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("departments") \
        .update(update_data) \
        .eq("id", dept_id) \
        .eq("company_id", company_uuid) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Department not found")

    return {"department": result.data[0]}


@router.post("/{company_id}/departments/{dept_id}/roles")
async def create_role(company_id: str, dept_id: str, data: RoleCreate, user=Depends(get_current_user)):
    """Create a new role in a department."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get current max display_order for this department
    existing = client.table("roles") \
        .select("display_order") \
        .eq("department_id", dept_id) \
        .order("display_order", desc=True) \
        .limit(1) \
        .execute()

    next_order = (existing.data[0]["display_order"] + 1) if existing.data else 0

    result = client.table("roles").insert({
        "company_id": company_uuid,
        "department_id": dept_id,
        "name": data.name,
        "slug": data.slug,
        "title": data.title or data.name,
        "responsibilities": data.responsibilities,
        "system_prompt": data.system_prompt,
        "display_order": next_order
    }).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create role")

    return {"role": result.data[0]}


@router.put("/{company_id}/departments/{dept_id}/roles/{role_id}")
async def update_role(company_id: str, dept_id: str, role_id: str, data: RoleUpdate, user=Depends(get_current_user)):
    """Update a role."""
    client = get_client(user)

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("roles") \
        .update(update_data) \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Role not found")

    return {"role": result.data[0]}


@router.get("/{company_id}/departments/{dept_id}/roles/{role_id}")
async def get_role(company_id: str, dept_id: str, role_id: str, user=Depends(get_current_user)):
    """Get a single role with full details including system prompt."""
    client = get_client(user)

    result = client.table("roles") \
        .select("*") \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Role not found")

    return {"role": result.data}


# ============================================
# PLAYBOOKS ENDPOINTS (SOPs, Frameworks, Policies)
# ============================================

@router.get("/{company_id}/playbooks")
async def get_playbooks(
    company_id: str,
    doc_type: Optional[str] = None,
    department_id: Optional[str] = None,
    tag: Optional[str] = None,
    user=Depends(get_current_user)
):
    """
    Get all playbooks with current version content.
    Optional filters:
    - doc_type: sop/framework/policy
    - department_id: filter by owner or visible departments
    - tag: filter by tag

    Note: Playbooks come from database. If company not in DB yet, returns empty list.
    """
    client = get_client(user)

    # Try to resolve company UUID - may not exist in DB yet
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        # Company not in database yet - return empty playbooks
        return {"playbooks": []}

    # First get all documents for this company
    doc_query = client.table("org_documents") \
        .select("*") \
        .eq("company_id", company_uuid)

    if doc_type:
        doc_query = doc_query.eq("doc_type", doc_type)

    if tag:
        # Filter by tag using array contains
        doc_query = doc_query.contains("tags", [tag])

    doc_result = doc_query.order("created_at", desc=True).execute()

    if not doc_result.data:
        return {"playbooks": []}

    # Get current versions for all documents
    doc_ids = [doc["id"] for doc in doc_result.data]
    version_result = client.table("org_document_versions") \
        .select("*") \
        .in_("document_id", doc_ids) \
        .eq("is_current", True) \
        .execute()

    # Create a map of document_id -> version
    version_map = {v["document_id"]: v for v in (version_result.data or [])}

    # Get additional department mappings for all documents
    dept_mapping_result = client.table("org_document_departments") \
        .select("document_id, department_id") \
        .in_("document_id", doc_ids) \
        .execute()

    # Create a map of document_id -> list of additional department_ids
    additional_depts_map = {}
    for mapping in (dept_mapping_result.data or []):
        doc_id = mapping["document_id"]
        if doc_id not in additional_depts_map:
            additional_depts_map[doc_id] = []
        additional_depts_map[doc_id].append(mapping["department_id"])

    # Flatten the response - extract current version content
    playbooks = []
    for doc in doc_result.data:
        version = version_map.get(doc["id"])
        if version:
            doc["content"] = version.get("content", "")
            doc["version"] = version.get("version", 1)
        else:
            doc["content"] = ""
            doc["version"] = 0

        # Add additional departments list
        doc["additional_departments"] = additional_depts_map.get(doc["id"], [])

        # Filter by department if specified (owner OR visible)
        if department_id:
            is_owner = doc.get("department_id") == department_id
            is_visible = department_id in doc["additional_departments"]
            if not (is_owner or is_visible):
                continue

        playbooks.append(doc)

    return {"playbooks": playbooks}


# IMPORTANT: Static routes must come BEFORE dynamic routes like /{playbook_id}
@router.get("/{company_id}/playbooks/tags")
async def get_playbook_tags(company_id: str, user=Depends(get_current_user)):
    """
    Get predefined playbook tag categories.

    These are structured categories that align with how the council uses playbooks/SOPs:
    - Category tags define the primary purpose of the playbook
    - The council can reference playbooks by these categories

    Returns predefined categories (not user-created free-form tags).
    """
    # Predefined categories that align with council usage
    # These represent how SOPs/frameworks/policies are typically categorized
    predefined_tags = [
        # Operational categories
        {"tag": "deployment", "description": "Deployment and release procedures"},
        {"tag": "security", "description": "Security protocols and guidelines"},
        {"tag": "onboarding", "description": "Team member onboarding processes"},
        {"tag": "incident-response", "description": "Incident handling and escalation"},
        {"tag": "communication", "description": "Communication standards and protocols"},

        # Process categories
        {"tag": "workflow", "description": "Standard workflows and processes"},
        {"tag": "approval", "description": "Approval and sign-off procedures"},
        {"tag": "compliance", "description": "Compliance and regulatory requirements"},
        {"tag": "quality", "description": "Quality assurance and testing"},

        # Domain categories
        {"tag": "technical", "description": "Technical standards and architecture"},
        {"tag": "business", "description": "Business operations and strategy"},
        {"tag": "hr", "description": "Human resources and personnel"},
        {"tag": "finance", "description": "Financial procedures and budgeting"},
        {"tag": "customer", "description": "Customer-facing processes"},

        # Lifecycle categories
        {"tag": "planning", "description": "Planning and estimation"},
        {"tag": "review", "description": "Review and retrospective processes"},
        {"tag": "maintenance", "description": "Maintenance and updates"},
    ]

    return {"tags": predefined_tags}


@router.post("/{company_id}/playbooks")
async def create_playbook(company_id: str, data: PlaybookCreate, user=Depends(get_current_user)):
    """
    Create a new playbook with initial version.
    Supports tags and multi-department visibility.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Validate doc_type
    if data.doc_type not in ['sop', 'framework', 'policy']:
        raise HTTPException(status_code=400, detail="doc_type must be 'sop', 'framework', or 'policy'")

    # Create the document with tags
    doc_result = client.table("org_documents").insert({
        "company_id": company_uuid,
        "department_id": data.department_id,
        "doc_type": data.doc_type,
        "title": data.title,
        "slug": data.slug,
        "summary": data.summary,
        "auto_inject": data.auto_inject,
        "tags": data.tags
    }).execute()

    if not doc_result.data:
        raise HTTPException(status_code=400, detail="Failed to create playbook")

    doc_id = doc_result.data[0]["id"]

    # Create initial version
    version_result = client.table("org_document_versions").insert({
        "document_id": doc_id,
        "version": 1,
        "content": data.content,
        "status": "active",
        "is_current": True,
        "created_by": user.get('id') if isinstance(user, dict) else user.id
    }).execute()

    if not version_result.data:
        # Rollback document creation
        client.table("org_documents").delete().eq("id", doc_id).execute()
        raise HTTPException(status_code=400, detail="Failed to create playbook version")

    # Add additional department visibility
    if data.additional_departments:
        dept_mappings = [
            {"document_id": doc_id, "department_id": dept_id}
            for dept_id in data.additional_departments
        ]
        client.table("org_document_departments").insert(dept_mappings).execute()

    playbook = doc_result.data[0]
    playbook["content"] = data.content
    playbook["version"] = 1
    playbook["additional_departments"] = data.additional_departments

    # Log activity
    await log_activity(
        company_id=company_uuid,
        event_type="playbook",
        title=f"Created: {data.title}",
        description=data.summary[:200] if data.summary else None,
        department_id=data.department_id,
        related_id=doc_id,
        related_type="playbook"
    )

    return {"playbook": playbook}


@router.put("/{company_id}/playbooks/{playbook_id}")
async def update_playbook(company_id: str, playbook_id: str, data: PlaybookUpdate, user=Depends(get_current_user)):
    """
    Update a playbook - creates a new version if content changed.
    Also supports updating tags and multi-department visibility.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get current document
    doc_result = client.table("org_documents") \
        .select("*") \
        .eq("id", playbook_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not doc_result.data:
        raise HTTPException(status_code=404, detail="Playbook not found")

    # Get current version separately
    version_result = client.table("org_document_versions") \
        .select("*") \
        .eq("document_id", playbook_id) \
        .eq("is_current", True) \
        .execute()

    current_version = version_result.data[0] if version_result.data else None
    current_version_num = current_version["version"] if current_version else 0

    # Update document metadata if provided
    doc_updates = {}
    if data.title is not None:
        doc_updates["title"] = data.title
    if data.summary is not None:
        doc_updates["summary"] = data.summary
    if data.auto_inject is not None:
        doc_updates["auto_inject"] = data.auto_inject
    if data.tags is not None:
        doc_updates["tags"] = data.tags

    if doc_updates:
        doc_updates["updated_at"] = datetime.utcnow().isoformat()
        client.table("org_documents").update(doc_updates).eq("id", playbook_id).execute()

    # Create new version if content changed
    if data.content is not None and (not current_version or data.content != current_version.get("content")):
        # Mark current version as not current
        if current_version:
            client.table("org_document_versions") \
                .update({"is_current": False}) \
                .eq("id", current_version["id"]) \
                .execute()

        # Create new version
        new_version = current_version_num + 1
        client.table("org_document_versions").insert({
            "document_id": playbook_id,
            "version": new_version,
            "content": data.content,
            "status": "active",
            "is_current": True,
            "change_summary": data.change_summary,
            "created_by": user.get('id') if isinstance(user, dict) else user.id
        }).execute()

    # Update additional departments if provided (replace all)
    if data.additional_departments is not None:
        # Delete all existing mappings
        client.table("org_document_departments") \
            .delete() \
            .eq("document_id", playbook_id) \
            .execute()

        # Insert new mappings
        if data.additional_departments:
            dept_mappings = [
                {"document_id": playbook_id, "department_id": dept_id}
                for dept_id in data.additional_departments
            ]
            client.table("org_document_departments").insert(dept_mappings).execute()

    # Fetch updated document
    updated_doc = client.table("org_documents") \
        .select("*") \
        .eq("id", playbook_id) \
        .single() \
        .execute()

    updated_version = client.table("org_document_versions") \
        .select("*") \
        .eq("document_id", playbook_id) \
        .eq("is_current", True) \
        .execute()

    # Get additional departments
    dept_result = client.table("org_document_departments") \
        .select("department_id") \
        .eq("document_id", playbook_id) \
        .execute()

    playbook = updated_doc.data
    if updated_version.data:
        playbook["content"] = updated_version.data[0]["content"]
        playbook["version"] = updated_version.data[0]["version"]
    else:
        playbook["content"] = ""
        playbook["version"] = 0

    playbook["additional_departments"] = [d["department_id"] for d in (dept_result.data or [])]

    return {"playbook": playbook}


# ============================================
# DECISIONS ENDPOINTS
# ============================================

@router.get("/{company_id}/decisions")
async def get_decisions(
    company_id: str,
    search: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_user)
):
    """
    Get all decisions (knowledge entries), newest first.
    Optional search by title/content.

    Note: Decisions now come from knowledge_entries table.
    """
    client = get_client(user)

    # Try to resolve company UUID - may not exist in DB yet
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        # Company not in database yet - return empty decisions
        return {"decisions": []}

    query = client.table("knowledge_entries") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .eq("is_active", True)

    if search:
        # Search in title and summary
        query = query.or_(f"title.ilike.%{search}%,summary.ilike.%{search}%")

    result = query.order("created_at", desc=True).limit(limit).execute()

    # Transform to expected format for frontend compatibility
    decisions = []
    for entry in result.data or []:
        decisions.append({
            "id": entry.get("id"),
            "title": entry.get("title"),
            "content": entry.get("summary", ""),  # Map summary to content
            "tags": entry.get("tags", []),
            "category": entry.get("category"),
            "department_id": entry.get("department_id"),
            "project_id": entry.get("project_id"),
            "is_promoted": entry.get("is_promoted", False),
            "promoted_to_id": entry.get("promoted_to_id"),
            "source_conversation_id": entry.get("source_conversation_id"),
            "created_at": entry.get("created_at"),
            "updated_at": entry.get("updated_at"),
            "scope": entry.get("scope", "department"),
            "auto_inject": entry.get("auto_inject", False),
            "council_type": entry.get("council_type")
        })

    return {"decisions": decisions}


@router.post("/{company_id}/decisions")
async def create_decision(company_id: str, data: DecisionCreate, user=Depends(get_current_user)):
    """
    Save a new decision from a council session.
    Now stores in knowledge_entries table for unified knowledge management.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get user_id for created_by field
    user_id = user.get('id') if isinstance(user, dict) else user.id

    # Build insert data
    insert_data = {
        "company_id": company_uuid,
        "department_id": data.department_id,
        "title": data.title,
        "summary": data.content,  # Map content to summary
        "category": "technical_decision",  # Default category
        "source_conversation_id": data.source_conversation_id,
        "source_message_id": data.source_message_id,
        "tags": data.tags,
        "created_by": user_id,
        "is_active": True,
        "scope": "department",  # Default scope
        "auto_inject": False  # User can enable later
    }

    # Add council_type if provided
    if data.council_type:
        insert_data["council_type"] = data.council_type

    result = client.table("knowledge_entries").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to save decision")

    # Transform response to expected format
    entry = result.data[0]
    decision = {
        "id": entry.get("id"),
        "title": entry.get("title"),
        "content": entry.get("summary", ""),
        "tags": entry.get("tags", []),
        "category": entry.get("category"),
        "department_id": entry.get("department_id"),
        "source_conversation_id": entry.get("source_conversation_id"),
        "created_at": entry.get("created_at"),
        "council_type": entry.get("council_type")
    }

    return {"decision": decision}


@router.post("/{company_id}/decisions/{decision_id}/promote")
async def promote_decision(company_id: str, decision_id: str, data: PromoteDecision, user=Depends(get_current_user)):
    """
    Promote a decision (knowledge entry) to a playbook (SOP/framework/policy).
    Creates a new playbook pre-filled with the decision content.

    Uses service client for knowledge_entries to bypass RLS.
    """
    import re
    # Use service client for knowledge_entries (bypasses RLS)
    service_client = get_supabase_service()

    # User client for company resolution and other tables
    user_client = get_client(user)
    company_uuid = resolve_company_id(user_client, company_id)

    # Get the knowledge entry (decision) - using service client to bypass RLS
    decision = service_client.table("knowledge_entries") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not decision.data:
        raise HTTPException(status_code=404, detail="Decision not found")

    # Validate doc_type
    if data.doc_type not in ['sop', 'framework', 'policy']:
        raise HTTPException(status_code=400, detail="doc_type must be 'sop', 'framework', or 'policy'")

    # Auto-generate slug from title if not provided
    slug = data.slug
    if not slug:
        slug = re.sub(r'[^a-z0-9]+', '-', data.title.lower()).strip('-')

    # Get content from knowledge entry (use summary as content)
    content = decision.data.get("summary", "") or decision.data.get("body_md", "") or ""

    # Create the playbook (user_client for org_documents)
    doc_result = user_client.table("org_documents").insert({
        "company_id": company_uuid,
        "department_id": decision.data.get("department_id"),
        "doc_type": data.doc_type,
        "title": data.title,
        "slug": slug,
        "summary": data.summary or decision.data.get("summary", ""),
        "auto_inject": True
    }).execute()

    if not doc_result.data:
        raise HTTPException(status_code=400, detail="Failed to create playbook")

    doc_id = doc_result.data[0]["id"]

    # Create initial version with decision content (user_client for versions)
    user_client.table("org_document_versions").insert({
        "document_id": doc_id,
        "version": 1,
        "content": content,
        "status": "active",
        "is_current": True,
        "change_summary": f"Promoted from decision: {decision.data['title']}",
        "created_by": user.get('id') if isinstance(user, dict) else user.id
    }).execute()

    # Mark knowledge entry as promoted (service_client to bypass RLS)
    service_client.table("knowledge_entries").update({
        "is_promoted": True,
        "promoted_to_id": doc_id
    }).eq("id", decision_id).execute()

    playbook = doc_result.data[0]
    playbook["content"] = content
    playbook["version"] = 1

    # Log activity - include conversation_id if decision has one
    await log_activity(
        company_id=company_uuid,
        event_type="playbook",
        title=f"Promoted: {data.title}",
        description=f"Promoted from decision: {decision.data['title']}",
        department_id=decision.data.get("department_id"),
        related_id=doc_id,
        related_type="playbook",
        conversation_id=decision.data.get("source_conversation_id")
    )

    return {
        "playbook": playbook,
        "decision_id": decision_id,
        "promoted": True
    }


@router.get("/{company_id}/decisions/{decision_id}")
async def get_decision(company_id: str, decision_id: str, user=Depends(get_current_user)):
    """Get a single decision (knowledge entry)."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    result = client.table("knowledge_entries") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Decision not found")

    # Transform to expected format
    entry = result.data
    decision = {
        "id": entry.get("id"),
        "title": entry.get("title"),
        "content": entry.get("summary", ""),
        "tags": entry.get("tags", []),
        "category": entry.get("category"),
        "department_id": entry.get("department_id"),
        "project_id": entry.get("project_id"),
        "is_promoted": entry.get("is_promoted", False),
        "promoted_to_id": entry.get("promoted_to_id"),
        "source_conversation_id": entry.get("source_conversation_id"),
        "created_at": entry.get("created_at"),
        "updated_at": entry.get("updated_at"),
        "scope": entry.get("scope", "department"),
        "auto_inject": entry.get("auto_inject", False),
        "council_type": entry.get("council_type")
    }

    return {"decision": decision}


@router.post("/{company_id}/decisions/{decision_id}/archive")
async def archive_decision(company_id: str, decision_id: str, user=Depends(get_current_user)):
    """
    Archive (soft delete) a decision.
    Sets is_active=False rather than permanently deleting.
    Uses POST instead of DELETE for better compatibility.
    Uses service client to bypass RLS on knowledge_entries table.
    """
    # Use service client for knowledge_entries (bypasses RLS)
    service_client = get_supabase_service()

    # Still need user client to resolve company
    user_client = get_client(user)
    company_uuid = resolve_company_id(user_client, company_id)

    # Verify decision exists and belongs to company
    check = service_client.table("knowledge_entries") \
        .select("id") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .eq("is_active", True) \
        .single() \
        .execute()

    if not check.data:
        raise HTTPException(status_code=404, detail="Decision not found")

    # Soft delete by setting is_active=False
    result = service_client.table("knowledge_entries") \
        .update({"is_active": False}) \
        .eq("id", decision_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to archive decision")

    return {"success": True, "message": "Decision archived"}


# ============================================
# ACTIVITY ENDPOINTS
# ============================================

@router.get("/{company_id}/activity")
async def get_activity_logs(
    company_id: str,
    limit: int = 50,
    event_type: Optional[str] = None,
    user=Depends(get_current_user)
):
    """
    Get activity logs for a company.
    Optional filter by event_type (decision, playbook, role, department, council_session).
    """
    # Use service client for read operations
    client = get_service_client()

    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        return {"logs": []}

    query = client.table("activity_logs") \
        .select("*") \
        .eq("company_id", company_uuid) \
        .order("created_at", desc=True) \
        .limit(limit)

    if event_type:
        query = query.eq("event_type", event_type)

    result = query.execute()

    return {"logs": result.data or []}


async def log_activity(
    company_id: str,
    event_type: str,
    title: str,
    description: Optional[str] = None,
    department_id: Optional[str] = None,
    related_id: Optional[str] = None,
    related_type: Optional[str] = None,
    conversation_id: Optional[str] = None,
    message_id: Optional[str] = None
):
    """
    Helper function to log an activity event.
    Call this from other endpoints when something notable happens.

    Args:
        company_id: Company UUID
        event_type: Type of event (decision, playbook, role, department, council_session)
        title: Short title for the activity
        description: Optional longer description
        department_id: Optional department UUID
        related_id: Optional UUID of related entity
        related_type: Optional type of related entity
        conversation_id: Optional UUID of source conversation (for tracing back to council discussion)
        message_id: Optional UUID of specific message in conversation
    """
    client = get_service_client()

    try:
        client.table("activity_logs").insert({
            "company_id": company_id,
            "event_type": event_type,
            "title": title,
            "description": description,
            "department_id": department_id,
            "related_id": related_id,
            "related_type": related_type,
            "conversation_id": conversation_id,
            "message_id": message_id
        }).execute()
    except Exception as e:
        # Don't fail the main operation if logging fails
        print(f"Warning: Failed to log activity: {e}")
