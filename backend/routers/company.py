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


class PlaybookUpdate(BaseModel):
    """Update a playbook."""
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    auto_inject: Optional[bool] = None
    change_summary: Optional[str] = None


class DecisionCreate(BaseModel):
    """Save a council decision."""
    title: str
    content: str
    department_id: Optional[str] = None
    source_conversation_id: Optional[str] = None
    source_message_id: Optional[str] = None
    tags: List[str] = []


class PromoteDecision(BaseModel):
    """Promote a decision to a playbook."""
    doc_type: str  # 'sop', 'framework', 'policy'
    title: str
    slug: str
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

    # Count decisions
    decision_result = client.table("decisions") \
        .select("id", count="exact") \
        .eq("company_id", company_uuid) \
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
    user=Depends(get_current_user)
):
    """
    Get all playbooks with current version content.
    Optional filter by doc_type (sop/framework/policy).

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
        playbooks.append(doc)

    return {"playbooks": playbooks}


@router.post("/{company_id}/playbooks")
async def create_playbook(company_id: str, data: PlaybookCreate, user=Depends(get_current_user)):
    """
    Create a new playbook with initial version.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Validate doc_type
    if data.doc_type not in ['sop', 'framework', 'policy']:
        raise HTTPException(status_code=400, detail="doc_type must be 'sop', 'framework', or 'policy'")

    # Create the document
    doc_result = client.table("org_documents").insert({
        "company_id": company_uuid,
        "department_id": data.department_id,
        "doc_type": data.doc_type,
        "title": data.title,
        "slug": data.slug,
        "summary": data.summary,
        "auto_inject": data.auto_inject
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

    playbook = doc_result.data[0]
    playbook["content"] = data.content
    playbook["version"] = 1

    return {"playbook": playbook}


@router.put("/{company_id}/playbooks/{playbook_id}")
async def update_playbook(company_id: str, playbook_id: str, data: PlaybookUpdate, user=Depends(get_current_user)):
    """
    Update a playbook - creates a new version if content changed.
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

    playbook = updated_doc.data
    if updated_version.data:
        playbook["content"] = updated_version.data[0]["content"]
        playbook["version"] = updated_version.data[0]["version"]
    else:
        playbook["content"] = ""
        playbook["version"] = 0

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
    Get all decisions, newest first.
    Optional search by title/content.

    Note: Decisions come from database. If company not in DB yet, returns empty list.
    """
    client = get_client(user)

    # Try to resolve company UUID - may not exist in DB yet
    try:
        company_uuid = resolve_company_id(client, company_id)
    except HTTPException:
        # Company not in database yet - return empty decisions
        return {"decisions": []}

    query = client.table("decisions") \
        .select("*") \
        .eq("company_id", company_uuid)

    if search:
        # Search in title and content
        query = query.or_(f"title.ilike.%{search}%,content.ilike.%{search}%")

    result = query.order("created_at", desc=True).limit(limit).execute()

    return {"decisions": result.data or []}


@router.post("/{company_id}/decisions")
async def create_decision(company_id: str, data: DecisionCreate, user=Depends(get_current_user)):
    """
    Save a new decision from a council session.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    result = client.table("decisions").insert({
        "company_id": company_uuid,
        "department_id": data.department_id,
        "title": data.title,
        "content": data.content,
        "source_conversation_id": data.source_conversation_id,
        "source_message_id": data.source_message_id,
        "tags": data.tags
    }).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to save decision")

    return {"decision": result.data[0]}


@router.post("/{company_id}/decisions/{decision_id}/promote")
async def promote_decision(company_id: str, decision_id: str, data: PromoteDecision, user=Depends(get_current_user)):
    """
    Promote a decision to a playbook (SOP/framework/policy).
    Creates a new playbook pre-filled with the decision content.
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # Get the decision
    decision = client.table("decisions") \
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

    # Create the playbook
    doc_result = client.table("org_documents").insert({
        "company_id": company_uuid,
        "department_id": decision.data.get("department_id"),
        "doc_type": data.doc_type,
        "title": data.title,
        "slug": data.slug,
        "summary": data.summary,
        "auto_inject": True
    }).execute()

    if not doc_result.data:
        raise HTTPException(status_code=400, detail="Failed to create playbook")

    doc_id = doc_result.data[0]["id"]

    # Create initial version with decision content
    client.table("org_document_versions").insert({
        "document_id": doc_id,
        "version": 1,
        "content": decision.data["content"],
        "status": "active",
        "is_current": True,
        "change_summary": f"Promoted from decision: {decision.data['title']}",
        "created_by": user.get('id') if isinstance(user, dict) else user.id
    }).execute()

    # Mark decision as promoted
    client.table("decisions").update({
        "is_promoted": True,
        "promoted_to_id": doc_id
    }).eq("id", decision_id).execute()

    playbook = doc_result.data[0]
    playbook["content"] = decision.data["content"]
    playbook["version"] = 1

    return {
        "playbook": playbook,
        "decision_id": decision_id,
        "promoted": True
    }


@router.get("/{company_id}/decisions/{decision_id}")
async def get_decision(company_id: str, decision_id: str, user=Depends(get_current_user)):
    """Get a single decision."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    result = client.table("decisions") \
        .select("*") \
        .eq("id", decision_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Decision not found")

    return {"decision": result.data}
