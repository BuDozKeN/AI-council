"""Supabase-based storage for conversations."""

from datetime import datetime
from typing import List, Dict, Any, Optional
from .database import get_supabase, get_supabase_with_auth, get_supabase_service

# Default company ID for AxCouncil (cached after first lookup)
_default_company_id: Optional[str] = None


def get_default_company_id(access_token: Optional[str] = None) -> str:
    """Get or lookup the default company ID (AxCouncil)."""
    global _default_company_id
    if _default_company_id is None:
        # Use authenticated client if token provided, otherwise anon
        supabase = get_supabase_with_auth(access_token) if access_token else get_supabase()
        result = supabase.table('companies').select('id').eq('slug', 'axcouncil').execute()
        if result.data:
            _default_company_id = result.data[0]['id']
        else:
            # If AxCouncil doesn't exist, create it
            result = supabase.table('companies').insert({
                'name': 'AxCouncil',
                'slug': 'axcouncil'
            }).execute()
            _default_company_id = result.data[0]['id']
    return _default_company_id


def resolve_company_id(company_id_or_slug: str, access_token: Optional[str] = None, create_if_missing: bool = True) -> str:
    """
    Resolve a company identifier to its UUID.
    If it's already a UUID, return it. If it's a slug, look up the UUID.
    If create_if_missing is True and the company doesn't exist, create it.
    """
    # Check if it looks like a UUID (contains dashes and is 36 chars)
    if len(company_id_or_slug) == 36 and '-' in company_id_or_slug:
        return company_id_or_slug

    # It's a slug, look up the UUID
    client = _get_client(access_token)
    result = client.table('companies').select('id').eq('slug', company_id_or_slug).execute()
    if result.data:
        return result.data[0]['id']

    # Company doesn't exist - create it if allowed
    if create_if_missing:
        # Create a friendly name from the slug
        name = company_id_or_slug.replace('-', ' ').title()
        result = client.table('companies').insert({
            'name': name,
            'slug': company_id_or_slug
        }).execute()
        if result.data:
            return result.data[0]['id']

    raise ValueError(f"Company not found: {company_id_or_slug}")


def resolve_department_id(
    department_id_or_slug: Optional[str],
    company_id: str,
    access_token: Optional[str] = None
) -> Optional[str]:
    """
    Resolve a department identifier to its UUID.
    If it's already a UUID, return it. If it's a slug, look up the UUID.

    Args:
        department_id_or_slug: Department UUID or slug (e.g., 'technology')
        company_id: The company UUID (required for slug lookup)
        access_token: User's JWT for authenticated queries

    Returns:
        Department UUID or None if not provided/found
    """
    if not department_id_or_slug:
        return None

    # Check if it looks like a UUID (contains dashes and is 36 chars)
    if len(department_id_or_slug) == 36 and '-' in department_id_or_slug:
        return department_id_or_slug

    # It's a slug, look up the UUID
    client = _get_client(access_token)
    result = (client
        .table('departments')
        .select('id')
        .eq('company_id', company_id)
        .eq('slug', department_id_or_slug)
        .execute())

    if result.data:
        return result.data[0]['id']

    # Not found - return None rather than raising (department is optional)
    print(f"Warning: Department not found: {department_id_or_slug} in company {company_id}")
    return None


def _get_client(access_token: Optional[str] = None):
    """Get appropriate Supabase client based on whether we have an access token."""
    if access_token:
        return get_supabase_with_auth(access_token)
    return get_supabase()


def create_conversation(conversation_id: str, user_id: str, access_token: Optional[str] = None, company_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new conversation.

    Args:
        conversation_id: Unique identifier for the conversation
        user_id: ID of the user creating the conversation
        access_token: User's JWT access token for RLS authentication
        company_id: Company ID to associate with this conversation (uses default if not provided)

    Returns:
        New conversation dict
    """
    supabase = _get_client(access_token)
    now = datetime.utcnow().isoformat() + 'Z'
    # Use provided company_id or fall back to default
    if not company_id:
        company_id = get_default_company_id(access_token)

    # Insert into conversations table with user_id
    result = supabase.table('conversations').insert({
        'id': conversation_id,
        'company_id': company_id,
        'user_id': user_id,
        'title': 'New Conversation',
        'created_at': now,
        'updated_at': now,
        'archived': False
    }).execute()

    if not result.data:
        raise Exception(f"Failed to create conversation {conversation_id}")

    # Return in the format the app expects
    return {
        "id": conversation_id,
        "created_at": now,
        "last_updated": now,
        "title": "New Conversation",
        "messages": [],
        "user_id": user_id
    }


def get_conversation(conversation_id: str, access_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Load a conversation from storage.

    Args:
        conversation_id: Unique identifier for the conversation
        access_token: User's JWT access token for RLS authentication

    Returns:
        Conversation dict or None if not found
    """
    supabase = _get_client(access_token)

    # Single query with embedded messages - much faster than 2 separate queries
    conv_result = supabase.table('conversations').select(
        '*, messages(*)'
    ).eq('id', conversation_id).execute()

    if not conv_result.data:
        return None

    conv = conv_result.data[0]

    # Sort messages by created_at (Supabase returns them unsorted in embedded queries)
    raw_messages = conv.get('messages', [])
    raw_messages.sort(key=lambda m: m.get('created_at', ''))

    messages = []
    for msg in raw_messages:
        if msg['role'] == 'user':
            messages.append({
                "role": "user",
                "content": msg['content']
            })
        else:
            # Assistant message
            message = {
                "role": "assistant",
                "stage1": msg.get('stage1') or [],
                "stage2": msg.get('stage2') or [],
                "stage3": msg.get('stage3') or {}
            }
            if msg.get('label_to_model'):
                message['label_to_model'] = msg['label_to_model']
            if msg.get('aggregate_rankings'):
                message['aggregate_rankings'] = msg['aggregate_rankings']
            messages.append(message)

    return {
        "id": conv['id'],
        "created_at": conv['created_at'],
        "last_updated": conv['updated_at'],
        "title": conv.get('title', 'New Conversation'),
        "archived": conv.get('archived', False),
        "messages": messages,
        "curator_history": conv.get('curator_history') or [],
        "user_id": conv.get('user_id')
    }


def save_conversation(conversation: Dict[str, Any], access_token: Optional[str] = None):
    """
    Save a conversation to storage.
    Note: This is mainly for updating metadata. Messages are saved separately.

    Args:
        conversation: Conversation dict to save
        access_token: User's JWT access token for RLS authentication
    """
    supabase = _get_client(access_token)

    supabase.table('conversations').update({
        'title': conversation.get('title', 'New Conversation'),
        'updated_at': conversation.get('updated_at', datetime.utcnow().isoformat() + 'Z'),
        'archived': conversation.get('archived', False),
        'curator_history': conversation.get('curator_history')
    }).eq('id', conversation['id']).execute()


def list_conversations(
    user_id: str,
    access_token: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
    search: Optional[str] = None,
    include_archived: bool = False,
    sort_by: str = "date",
    company_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    List conversations for a specific user with at least one message (metadata only).

    Args:
        user_id: ID of the user to list conversations for
        access_token: User's JWT access token for RLS authentication
        limit: Maximum number of conversations to return (default 10)
        offset: Number of conversations to skip for pagination
        search: Optional search string to filter by title
        include_archived: Whether to include archived conversations (default False)
        sort_by: Sort order - "date" (most recent first) or "activity" (most messages first)
        company_id: Optional company ID to filter conversations by

    Returns:
        Dict with 'conversations' list and 'has_more' boolean for pagination
    """
    supabase = _get_client(access_token)

    # Build query - get conversations with message count
    query = supabase.table('conversations').select(
        '*, messages(count)'
    ).eq('user_id', user_id)

    # Filter by company if provided
    if company_id:
        query = query.eq('company_id', company_id)

    # Filter out archived by default
    if not include_archived:
        query = query.eq('is_archived', False)

    # Apply search filter if provided (case-insensitive title search)
    if search:
        query = query.ilike('title', f'%{search}%')

    # Order: starred first (descending so True comes first), then by updated_at (recent first)
    # We fetch limit + 20 to allow for filtering out empty conversations and sorting
    query = query.order('is_starred', desc=True).order('updated_at', desc=True).range(offset, offset + limit + 20)

    result = query.execute()

    conversations = []
    for conv in result.data or []:
        # Get message count from the joined data
        messages_data = conv.get('messages', [])
        message_count = messages_data[0].get('count', 0) if messages_data else 0

        # Skip conversations with 0 messages (but don't auto-delete - they might be in progress)
        if message_count == 0:
            continue

        conversations.append({
            "id": conv['id'],
            "created_at": conv['created_at'],
            "last_updated": conv['updated_at'],
            "title": conv.get('title', 'New Conversation'),
            "message_count": message_count,
            "is_starred": conv.get('is_starred', False),
            "is_archived": conv.get('is_archived', False),
            "department": conv.get('department', 'standard')
        })

    # Separate starred and non-starred
    starred = [c for c in conversations if c['is_starred']]
    non_starred = [c for c in conversations if not c['is_starred']]

    # Sort starred always by date (most recent first)
    starred.sort(key=lambda c: c['last_updated'], reverse=True)

    # Sort non-starred based on sort_by preference
    if sort_by == "activity":
        # Sort by message count (most messages first), then by date
        non_starred.sort(key=lambda c: (c['message_count'], c['last_updated']), reverse=True)
    else:
        # Default: sort by date (most recent first)
        non_starred.sort(key=lambda c: c['last_updated'], reverse=True)

    conversations = starred + non_starred

    # Check if there are more conversations
    has_more = len(conversations) > limit

    # Apply limit
    conversations = conversations[:limit]

    return {
        "conversations": conversations,
        "has_more": has_more
    }


def star_conversation(conversation_id: str, starred: bool, access_token: Optional[str] = None):
    """
    Star or unstar a conversation.

    Args:
        conversation_id: Conversation identifier
        starred: Whether to star (True) or unstar (False)
        access_token: User's JWT access token for RLS authentication
    """
    supabase = _get_client(access_token)
    now = datetime.utcnow().isoformat() + 'Z'

    supabase.table('conversations').update({
        'is_starred': starred,
        'updated_at': now
    }).eq('id', conversation_id).execute()


def add_user_message(conversation_id: str, content: str, user_id: str, access_token: Optional[str] = None):
    """
    Add a user message to a conversation.

    Args:
        conversation_id: Conversation identifier
        content: User message content
        user_id: ID of the user sending the message
        access_token: User's JWT access token for RLS authentication
    """
    supabase = _get_client(access_token)
    now = datetime.utcnow().isoformat() + 'Z'

    # Insert message with user_id
    supabase.table('messages').insert({
        'conversation_id': conversation_id,
        'role': 'user',
        'content': content,
        'user_id': user_id,
        'created_at': now
    }).execute()

    # Update conversation last_updated
    supabase.table('conversations').update({
        'updated_at': now
    }).eq('id', conversation_id).execute()


def add_assistant_message(
    conversation_id: str,
    stage1: List[Dict[str, Any]],
    stage2: List[Dict[str, Any]],
    stage3: Dict[str, Any],
    user_id: str,
    label_to_model: Optional[Dict[str, str]] = None,
    aggregate_rankings: Optional[List[Dict[str, Any]]] = None,
    access_token: Optional[str] = None
):
    """
    Add an assistant message with all 3 stages to a conversation.

    Args:
        conversation_id: Conversation identifier
        stage1: List of individual model responses
        stage2: List of model rankings
        stage3: Final synthesized response
        user_id: ID of the user who owns this conversation
        label_to_model: Optional mapping of anonymous labels to model names
        aggregate_rankings: Optional list of aggregate rankings from peer review
        access_token: User's JWT access token for RLS authentication
    """
    supabase = _get_client(access_token)
    now = datetime.utcnow().isoformat() + 'Z'

    # Build message data with user_id
    message_data = {
        'conversation_id': conversation_id,
        'role': 'assistant',
        'stage1': stage1,
        'stage2': stage2,
        'stage3': stage3,
        'user_id': user_id,
        'created_at': now
    }

    if label_to_model is not None:
        message_data['label_to_model'] = label_to_model
    if aggregate_rankings is not None:
        message_data['aggregate_rankings'] = aggregate_rankings

    # Insert message
    supabase.table('messages').insert(message_data).execute()

    # Update conversation last_updated
    supabase.table('conversations').update({
        'updated_at': now
    }).eq('id', conversation_id).execute()


def update_conversation_title(conversation_id: str, title: str, access_token: Optional[str] = None):
    """
    Update the title of a conversation.

    Args:
        conversation_id: Conversation identifier
        title: New title for the conversation
        access_token: User's JWT access token for RLS authentication
    """
    supabase = _get_client(access_token)
    now = datetime.utcnow().isoformat() + 'Z'

    supabase.table('conversations').update({
        'title': title,
        'updated_at': now
    }).eq('id', conversation_id).execute()


def archive_conversation(conversation_id: str, archived: bool = True, access_token: Optional[str] = None):
    """
    Archive or unarchive a conversation.

    Args:
        conversation_id: Conversation identifier
        archived: True to archive, False to unarchive
        access_token: User's JWT access token for RLS authentication
    """
    supabase = _get_client(access_token)
    now = datetime.utcnow().isoformat() + 'Z'

    supabase.table('conversations').update({
        'archived': archived,
        'updated_at': now
    }).eq('id', conversation_id).execute()


def update_conversation_department(conversation_id: str, department: str, access_token: Optional[str] = None):
    """
    Update the department of a conversation.

    Args:
        conversation_id: Conversation identifier
        department: Department ID (e.g., 'technology', 'marketing', 'standard')
        access_token: User's JWT access token for RLS authentication
    """
    supabase = _get_client(access_token)
    now = datetime.utcnow().isoformat() + 'Z'

    supabase.table('conversations').update({
        'department': department,
        'updated_at': now
    }).eq('id', conversation_id).execute()


def delete_conversation(conversation_id: str, access_token: Optional[str] = None) -> bool:
    """
    Permanently delete a conversation.

    Args:
        conversation_id: Conversation identifier
        access_token: User's JWT access token for RLS authentication

    Returns:
        True if deleted, False if not found
    """
    supabase = _get_client(access_token)

    # Check if exists
    result = supabase.table('conversations').select('id').eq('id', conversation_id).execute()
    if not result.data:
        return False

    # Delete messages first (foreign key constraint)
    supabase.table('messages').delete().eq('conversation_id', conversation_id).execute()

    # Delete conversation
    supabase.table('conversations').delete().eq('id', conversation_id).execute()

    return True


def save_curator_run(
    conversation_id: str,
    business_id: str,
    suggestions_count: int,
    accepted_count: int,
    rejected_count: int,
    access_token: Optional[str] = None
):
    """
    Record that the curator was run on this conversation.

    Args:
        conversation_id: Conversation identifier
        business_id: Business context that was analyzed
        suggestions_count: Total suggestions generated
        accepted_count: Number of suggestions accepted
        rejected_count: Number of suggestions rejected
        access_token: User's JWT access token for RLS authentication
    """
    supabase = _get_client(access_token)
    now = datetime.utcnow().isoformat() + 'Z'

    # Get current conversation
    result = supabase.table('conversations').select('curator_history').eq('id', conversation_id).execute()

    if not result.data:
        raise ValueError(f"Conversation {conversation_id} not found")

    curator_history = result.data[0].get('curator_history') or []
    curator_history.append({
        "analyzed_at": now,
        "business_id": business_id,
        "suggestions_count": suggestions_count,
        "accepted_count": accepted_count,
        "rejected_count": rejected_count
    })

    supabase.table('conversations').update({
        'curator_history': curator_history,
        'updated_at': now
    }).eq('id', conversation_id).execute()


def get_curator_history(conversation_id: str, access_token: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
    """
    Get curator run history for a conversation.

    Args:
        conversation_id: Conversation identifier
        access_token: User's JWT access token for RLS authentication

    Returns:
        List of curator run records or None if conversation not found
    """
    supabase = _get_client(access_token)

    try:
        result = supabase.table('conversations').select('curator_history').eq('id', conversation_id).execute()

        if not result.data:
            return None

        return result.data[0].get('curator_history') or []
    except Exception as e:
        # Column may not exist yet - return empty list
        print(f"[STORAGE] curator_history query failed: {e}", flush=True)
        return []


# ============================================
# PROJECT FUNCTIONS
# ============================================

def get_projects(company_id_or_slug: str, access_token: str) -> List[Dict[str, Any]]:
    """Get all active projects for a company."""
    try:
        # Resolve slug to UUID if needed
        company_uuid = resolve_company_id(company_id_or_slug, access_token)

        client = _get_client(access_token)
        # Simplified query - order by created_at desc to avoid potential column issues
        result = client.table("projects")\
            .select("id, name, description, status, created_at")\
            .eq("company_id", company_uuid)\
            .eq("status", "active")\
            .order("created_at", desc=True)\
            .execute()
        # Note: removed debug print - it crashes on Windows with Unicode characters
        return result.data if result.data else []
    except Exception as e:
        # Encode error message safely for Windows console
        error_msg = str(e).encode('ascii', 'replace').decode('ascii')
        print(f"[STORAGE ERROR] get_projects failed: {type(e).__name__}: {error_msg}", flush=True)
        raise


def get_project(project_id: str, access_token: str) -> Optional[Dict[str, Any]]:
    """Get a single project by ID."""
    client = _get_client(access_token)
    result = client.table("projects")\
        .select("*")\
        .eq("id", project_id)\
        .single()\
        .execute()
    return result.data if result.data else None


def create_project(
    company_id_or_slug: str,
    user_id: str,
    name: str,
    description: Optional[str] = None,
    context_md: Optional[str] = None,
    department_id: Optional[str] = None,
    department_ids: Optional[List[str]] = None,
    source_conversation_id: Optional[str] = None,
    source: str = "manual",  # 'manual', 'council', or 'import'
    access_token: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Create a new project."""
    print(f"[CREATE_PROJECT] Starting: company={company_id_or_slug}, name={name}", flush=True)

    # Resolve slug to UUID if needed
    try:
        company_uuid = resolve_company_id(company_id_or_slug, access_token)
        print(f"[CREATE_PROJECT] Resolved company_uuid={company_uuid}", flush=True)
    except Exception as e:
        print(f"[CREATE_PROJECT] ERROR resolving company: {type(e).__name__}: {e}", flush=True)
        raise

    # Use service client to bypass RLS - user auth is validated by the endpoint
    client = get_supabase_service()
    print(f"[CREATE_PROJECT] service_client={client is not None}", flush=True)
    if not client:
        # Fall back to user client if service key not configured
        print("[CREATE_PROJECT] WARNING: No service client, falling back to user client", flush=True)
        client = _get_client(access_token)
    insert_data = {
        "company_id": company_uuid,
        "user_id": user_id,
        "name": name,
        "description": description,
        "context_md": context_md,
        "source": source
    }
    # Handle department assignment - prefer department_ids array if provided
    if department_ids and len(department_ids) > 0:
        insert_data["department_ids"] = department_ids
        # Also set legacy department_id to first department for backwards compatibility
        insert_data["department_id"] = department_ids[0]
    elif department_id:
        insert_data["department_id"] = department_id
        insert_data["department_ids"] = [department_id]

    if source_conversation_id:
        insert_data["source_conversation_id"] = source_conversation_id

    print(f"[CREATE_PROJECT] Inserting: {insert_data}", flush=True)
    try:
        result = client.table("projects").insert(insert_data).execute()
        print(f"[CREATE_PROJECT] Insert result: {result.data}", flush=True)
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"[CREATE_PROJECT] ERROR inserting: {type(e).__name__}: {e}", flush=True)
        raise


def get_project_context(project_id: str, access_token: str) -> Optional[str]:
    """Get just the context_md for a project."""
    if not project_id:
        return None
    client = _get_client(access_token)
    result = client.table("projects")\
        .select("context_md")\
        .eq("id", project_id)\
        .single()\
        .execute()
    return result.data.get("context_md") if result.data else None


def update_project(
    project_id: str,
    access_token: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    context_md: Optional[str] = None,
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    department_ids: Optional[List[str]] = None,
    source_conversation_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Update a project's fields."""
    # Use service client to bypass RLS - user auth is validated by the endpoint
    client = get_supabase_service()
    print(f"[UPDATE_PROJECT] project_id={project_id}, service_client={client is not None}", flush=True)
    if not client:
        # Fall back to user client if service key not configured
        print("[UPDATE_PROJECT] WARNING: No service client, falling back to user client", flush=True)
        client = _get_client(access_token)

    # Build update payload with only provided fields
    now = datetime.utcnow().isoformat() + 'Z'
    update_data = {"updated_at": now}
    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description
    if context_md is not None:
        update_data["context_md"] = context_md
    if status is not None:
        if status not in ("active", "completed", "archived"):
            raise ValueError(f"Invalid status: {status}")
        update_data["status"] = status

    # Handle department assignment - prefer department_ids array if provided
    if department_ids is not None:
        update_data["department_ids"] = department_ids if department_ids else []
        # Also set legacy department_id to first department for backwards compatibility
        update_data["department_id"] = department_ids[0] if department_ids else None
    elif department_id is not None:
        # Legacy single department update
        update_data["department_id"] = department_id if department_id else None
        update_data["department_ids"] = [department_id] if department_id else []

    if source_conversation_id is not None:
        update_data["source_conversation_id"] = source_conversation_id if source_conversation_id else None

    print(f"[UPDATE_PROJECT] update_data={update_data}", flush=True)
    result = client.table("projects")\
        .update(update_data)\
        .eq("id", project_id)\
        .execute()
    print(f"[UPDATE_PROJECT] result.data={result.data}", flush=True)
    return result.data[0] if result.data else None


def touch_project_last_accessed(project_id: str, access_token: str) -> bool:
    """Update last_accessed_at to now for a project."""
    if not project_id:
        return False
    try:
        # Use service client to bypass RLS - user auth is validated by the endpoint
        client = get_supabase_service()
        if not client:
            client = _get_client(access_token)
        now = datetime.utcnow().isoformat() + 'Z'
        client.table("projects")\
            .update({"last_accessed_at": now})\
            .eq("id", project_id)\
            .execute()
        return True
    except Exception as e:
        print(f"[STORAGE] Failed to touch project last_accessed: {e}", flush=True)
        return False


def delete_project(project_id: str, access_token: str) -> Optional[dict]:
    """Delete a project by ID. Returns the deleted project data or None if failed."""
    if not project_id:
        print(f"[DELETE_PROJECT] No project_id provided", flush=True)
        return None
    try:
        print(f"[DELETE_PROJECT] Starting delete for project: {project_id}", flush=True)
        client = _get_client(access_token)

        # First verify the project exists and user has access
        check_result = client.table("projects").select("id, name, user_id, company_id").eq("id", project_id).execute()
        if not check_result.data:
            print(f"[DELETE_PROJECT] Project not found or no access: {project_id}", flush=True)
            return None
        project_data = check_result.data[0]
        print(f"[DELETE_PROJECT] Found project: {project_data}", flush=True)

        # Unlink any knowledge_entries that reference this project
        unlink_result = client.table("knowledge_entries")\
            .update({"project_id": None})\
            .eq("project_id", project_id)\
            .execute()
        print(f"[DELETE_PROJECT] Unlinked {len(unlink_result.data or [])} knowledge entries", flush=True)

        # Delete the project
        delete_result = client.table("projects")\
            .delete()\
            .eq("id", project_id)\
            .execute()
        print(f"[DELETE_PROJECT] Delete result: {delete_result.data}", flush=True)

        # Verify deletion actually happened
        verify_result = client.table("projects").select("id").eq("id", project_id).execute()
        if verify_result.data:
            print(f"[DELETE_PROJECT] WARNING: Project still exists after delete! RLS may be blocking.", flush=True)
            return None

        print(f"[DELETE_PROJECT] SUCCESS: Project {project_id} deleted", flush=True)
        return project_data
    except Exception as e:
        import traceback
        print(f"[DELETE_PROJECT] Failed to delete project: {e}", flush=True)
        print(f"[DELETE_PROJECT] Traceback: {traceback.format_exc()}", flush=True)
        return None


def get_projects_with_stats(
    company_id_or_slug: str,
    access_token: str,
    status_filter: Optional[str] = None,
    include_archived: bool = False
) -> List[Dict[str, Any]]:
    """
    Get projects with decision counts for the Projects Tab.

    Args:
        company_id_or_slug: Company ID or slug
        access_token: User's JWT
        status_filter: Filter by specific status ('active', 'completed', 'archived')
        include_archived: If True, include archived projects (default: False)
    """
    try:
        company_uuid = resolve_company_id(company_id_or_slug, access_token)
        client = _get_client(access_token)

        query = client.table("projects")\
            .select("id, name, description, status, created_at, updated_at, last_accessed_at, context_md, department_id, department_ids")\
            .eq("company_id", company_uuid)

        if status_filter:
            query = query.eq("status", status_filter)
        elif not include_archived:
            query = query.neq("status", "archived")

        # Order by last_accessed_at for recently used first
        result = query.order("last_accessed_at", desc=True).execute()

        projects = result.data if result.data else []

        # Get departments for name lookup
        dept_result = client.table("departments")\
            .select("id, name, slug")\
            .eq("company_id", company_uuid)\
            .execute()
        dept_map = {d["id"]: d for d in (dept_result.data or [])}

        # Enrich projects with decision counts and department names
        for project in projects:
            # Add department info - support both single department_id and array department_ids
            dept_ids = project.get("department_ids") or []
            dept_id = project.get("department_id")

            # Build list of department names from department_ids array
            if dept_ids and len(dept_ids) > 0:
                project["department_names"] = [
                    dept_map[did].get("name") for did in dept_ids
                    if did in dept_map
                ]
                # Also set department_name to first one for backwards compatibility
                if project["department_names"]:
                    project["department_name"] = project["department_names"][0]
                else:
                    project["department_name"] = None
            # Fallback to single department_id for old projects
            elif dept_id and dept_id in dept_map:
                project["department_name"] = dept_map[dept_id].get("name")
                project["department_names"] = [dept_map[dept_id].get("name")]
            else:
                project["department_name"] = None
                project["department_names"] = []

            # Get decision count and first decision's user question (for "what was asked")
            try:
                count_result = client.table("knowledge_entries")\
                    .select("id", count="exact")\
                    .eq("project_id", project["id"])\
                    .eq("is_active", True)\
                    .execute()
                project["decision_count"] = count_result.count or 0

                # Get the first decision's user_question (the question that created this project)
                first_decision = client.table("knowledge_entries")\
                    .select("user_question")\
                    .eq("project_id", project["id"])\
                    .eq("is_active", True)\
                    .order("created_at", desc=False)\
                    .limit(1)\
                    .execute()
                if first_decision.data and len(first_decision.data) > 0:
                    project["source_question"] = first_decision.data[0].get("user_question")
                else:
                    project["source_question"] = None
            except Exception:
                project["decision_count"] = 0
                project["source_question"] = None

        return projects
    except Exception as e:
        error_msg = str(e).encode('ascii', 'replace').decode('ascii')
        print(f"[STORAGE ERROR] get_projects_with_stats failed: {type(e).__name__}: {error_msg}", flush=True)
        raise


# ============================================
# USER PROFILE FUNCTIONS
# ============================================

def get_user_profile(user_id: str, access_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Get user profile data.

    Args:
        user_id: User's UUID from auth
        access_token: User's JWT access token for authentication

    Returns:
        Profile dict or None if not found
    """
    supabase = _get_client(access_token)

    try:
        result = supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        print(f"Error getting user profile: {e}", flush=True)
        return None


def update_user_profile(user_id: str, profile_data: Dict[str, Any], access_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Update or create user profile.

    Args:
        user_id: User's UUID from auth
        profile_data: Dict with profile fields (display_name, company, phone, bio)
        access_token: User's JWT access token for authentication

    Returns:
        Updated profile dict or None on error
    """
    supabase = _get_client(access_token)

    try:
        # Check if profile exists
        existing = supabase.table('user_profiles').select('id').eq('user_id', user_id).execute()

        now = datetime.utcnow().isoformat()

        if existing.data:
            # Update existing profile
            result = supabase.table('user_profiles').update({
                **profile_data,
                'updated_at': now
            }).eq('user_id', user_id).execute()
        else:
            # Create new profile
            result = supabase.table('user_profiles').insert({
                'user_id': user_id,
                **profile_data,
                'created_at': now,
                'updated_at': now
            }).execute()

        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error updating user profile: {e}", flush=True)
        return None
