"""Supabase-based storage for conversations."""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from .database import get_supabase, get_supabase_with_auth, get_supabase_service
from .security import log_app_event, escape_sql_like_pattern, verify_user_company_access, log_security_event

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
    now = datetime.now(tz=timezone.utc).isoformat()
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


def get_conversation(
    conversation_id: str,
    access_token: Optional[str] = None,
    message_limit: int = 200
) -> Optional[Dict[str, Any]]:
    """
    Load a conversation from storage.

    Args:
        conversation_id: Unique identifier for the conversation
        access_token: User's JWT access token for RLS authentication
        message_limit: Maximum number of messages to return (default 200, max 1000)
                      Set to 0 for unlimited (use with caution).

    Returns:
        Conversation dict or None if not found.
        Includes 'message_count' for total messages and 'messages_truncated' if limited.
    """
    supabase = _get_client(access_token)

    # Enforce message limit to prevent memory issues
    if message_limit > 0:
        message_limit = min(message_limit, 1000)  # Hard cap at 1000 messages

    # First get conversation metadata
    conv_result = supabase.table('conversations').select('*').eq('id', conversation_id).execute()

    if not conv_result.data:
        return None

    conv = conv_result.data[0]

    # Get messages separately with limit and order
    # This prevents unbounded queries on conversations with thousands of messages
    messages_query = supabase.table('messages').select('*').eq(
        'conversation_id', conversation_id
    ).order('created_at', desc=False)  # Oldest first

    if message_limit > 0:
        # Get total count for pagination info
        count_result = supabase.table('messages').select(
            'id', count='exact'
        ).eq('conversation_id', conversation_id).execute()
        total_messages = count_result.count if hasattr(count_result, 'count') else len(count_result.data or [])

        # For limit, we want the MOST RECENT messages, so order desc and take limit, then reverse
        messages_result = supabase.table('messages').select('*').eq(
            'conversation_id', conversation_id
        ).order('created_at', desc=True).limit(message_limit).execute()

        raw_messages = messages_result.data or []
        # Reverse to get chronological order (oldest first)
        raw_messages.reverse()
        messages_truncated = total_messages > message_limit
    else:
        messages_result = messages_query.execute()
        raw_messages = messages_result.data or []
        total_messages = len(raw_messages)
        messages_truncated = False

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

    result = {
        "id": conv['id'],
        "created_at": conv['created_at'],
        "last_updated": conv['updated_at'],
        "title": conv.get('title', 'New Conversation'),
        "archived": conv.get('archived', False),
        "messages": messages,
        "curator_history": conv.get('curator_history') or [],
        "user_id": conv.get('user_id'),
        "message_count": total_messages,
    }

    # Only include truncation info if messages were limited
    if messages_truncated:
        result["messages_truncated"] = True
        result["messages_shown"] = len(messages)

    return result


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
        'updated_at': conversation.get('updated_at', datetime.now(tz=timezone.utc).isoformat()),
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
        escaped_search = escape_sql_like_pattern(search)
        query = query.ilike('title', f'%{escaped_search}%')

    # Order: starred first (descending so True comes first), then by updated_at (recent first)
    # Note: For "activity" sort, we still need to re-sort non-starred by message count in Python
    # since Supabase can't sort by aggregated count in the same query
    query = query.order('is_starred', desc=True).order('updated_at', desc=True)

    # Fetch limit + 1 to check if there are more (minimal over-fetch)
    # We add a small buffer (+5) to account for potential 0-message conversations being filtered
    query = query.range(offset, offset + limit + 5)

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

    # Only re-sort if using "activity" sort mode (by message count)
    # For "date" mode, the DB ordering is already correct
    if sort_by == "activity":
        # Separate starred and non-starred
        starred = [c for c in conversations if c['is_starred']]
        non_starred = [c for c in conversations if not c['is_starred']]

        # Starred stay sorted by date (already correct from DB)
        # Non-starred sort by message count (most messages first), then by date
        non_starred.sort(key=lambda c: (c['message_count'], c['last_updated']), reverse=True)

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
    now = datetime.now(tz=timezone.utc).isoformat()

    supabase.table('conversations').update({
        'is_starred': starred,
        'updated_at': now
    }).eq('id', conversation_id).execute()


def add_user_message(
    conversation_id: str,
    content: str,
    user_id: str,
    access_token: Optional[str] = None,
    attachment_ids: Optional[List[str]] = None,
    image_analysis: Optional[str] = None
):
    """
    Add a user message to a conversation.

    Args:
        conversation_id: Conversation identifier
        content: User message content
        user_id: ID of the user sending the message
        access_token: User's JWT access token for RLS authentication
        attachment_ids: Optional list of attachment IDs associated with this message
        image_analysis: Optional cached image analysis results (for context persistence)
    """
    supabase = _get_client(access_token)
    now = datetime.now(tz=timezone.utc).isoformat()

    # Build message data
    message_data = {
        'conversation_id': conversation_id,
        'role': 'user',
        'content': content,
        'user_id': user_id,
        'created_at': now
    }

    # Add optional fields if provided
    if attachment_ids:
        message_data['attachment_ids'] = attachment_ids
    if image_analysis:
        message_data['image_analysis'] = image_analysis

    # Insert message with user_id
    supabase.table('messages').insert(message_data).execute()

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
    now = datetime.now(tz=timezone.utc).isoformat()

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
    now = datetime.now(tz=timezone.utc).isoformat()

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
    now = datetime.now(tz=timezone.utc).isoformat()

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
    now = datetime.now(tz=timezone.utc).isoformat()

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


def get_conversations_by_ids(
    conversation_ids: List[str],
    access_token: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Batch fetch multiple conversations by ID.

    Args:
        conversation_ids: List of conversation IDs to fetch
        access_token: User's JWT access token for RLS authentication

    Returns:
        List of conversation dicts (only metadata, no messages)
    """
    if not conversation_ids:
        return []

    supabase = _get_client(access_token)

    # Batch fetch all conversations in one query
    result = supabase.table('conversations') \
        .select('id, user_id, title, created_at') \
        .in_('id', conversation_ids) \
        .execute()

    return result.data or []


def bulk_delete_conversations(
    conversation_ids: List[str],
    access_token: Optional[str] = None
) -> int:
    """
    Batch delete multiple conversations.

    Args:
        conversation_ids: List of conversation IDs to delete
        access_token: User's JWT access token for RLS authentication

    Returns:
        Number of conversations deleted
    """
    if not conversation_ids:
        return 0

    supabase = _get_client(access_token)

    # Delete messages first (foreign key constraint) - batch delete
    supabase.table('messages').delete().in_('conversation_id', conversation_ids).execute()

    # Delete conversations - batch delete
    supabase.table('conversations').delete().in_('id', conversation_ids).execute()

    return len(conversation_ids)


# ============================================
# PROJECT FUNCTIONS
# ============================================

def get_projects(company_id_or_slug: str, access_token: str) -> List[Dict[str, Any]]:
    """Get all active projects for a company."""
    try:
        # Resolve slug to UUID if needed
        company_uuid = resolve_company_id(company_id_or_slug, access_token)

        client = _get_client(access_token)
        # Include context_md so frontend can merge decisions without extra API call
        result = client.table("projects")\
            .select("id, name, description, status, created_at, context_md")\
            .eq("company_id", company_uuid)\
            .eq("status", "active")\
            .order("created_at", desc=True)\
            .execute()
        return result.data if result.data else []
    except Exception:
        raise


def get_project(project_id: str, access_token: str) -> Optional[Dict[str, Any]]:
    """Get a single project by ID."""
    client = _get_client(access_token)
    try:
        # Use limit(1) instead of single() to avoid exception on 0 rows
        result = client.table("projects")\
            .select("*")\
            .eq("id", project_id)\
            .limit(1)\
            .execute()
        return result.data[0] if result.data else None
    except Exception as e:
        log_app_event(f"PROJECT: get_project_by_id failed: {type(e).__name__}", resource_id=project_id, level="ERROR")
        return None


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
    log_app_event("PROJECT: Create started", user_id=user_id, name=name)

    # Resolve slug to UUID if needed
    try:
        company_uuid = resolve_company_id(company_id_or_slug, access_token)
    except Exception as e:
        log_app_event(f"PROJECT: Error resolving company: {type(e).__name__}", user_id=user_id, level="ERROR")
        raise

    # Use RLS-authenticated client - the database will enforce access control
    # via the create_project_safe SECURITY DEFINER function or RLS policies
    client = _get_client(access_token) if access_token else get_supabase_service()
    if not client:
        log_app_event("PROJECT: No client available", user_id=user_id, level="ERROR")
        return None

    # Handle department assignment - use department_ids array only
    dept_ids_array = []
    if department_ids and len(department_ids) > 0:
        dept_ids_array = department_ids
    elif department_id:
        dept_ids_array = [department_id]

    try:
        # Try using the SECURITY DEFINER function for atomic access check + insert
        result = client.rpc("create_project_safe", {
            "p_company_id": company_uuid,
            "p_user_id": user_id,
            "p_name": name,
            "p_description": description,
            "p_context_md": context_md,
            "p_department_ids": dept_ids_array,
            "p_source": source,
            "p_source_conversation_id": source_conversation_id
        }).execute()

        if result.data:
            log_app_event("PROJECT: Created successfully via safe function", user_id=user_id, resource_id=result.data.get("id"))
            return result.data
        else:
            log_app_event("PROJECT: Create returned no data", user_id=user_id, level="WARNING")
            return None

    except Exception as e:
        # Fallback to direct insert with access verification if function not available
        if "function" in str(e).lower() or "does not exist" in str(e).lower():
            log_app_event("PROJECT: Falling back to direct insert (function not available)", user_id=user_id)

            # SECURITY: Verify user has access to the target company before creating
            if not verify_user_company_access(user_id, company_uuid):
                log_security_event("CREATE_BLOCKED", user_id=user_id,
                                  resource_type="project", resource_id=company_uuid,
                                  severity="WARNING")
                return None

            insert_data = {
                "company_id": company_uuid,
                "user_id": user_id,
                "name": name,
                "description": description,
                "context_md": context_md,
                "source": source,
                "department_ids": dept_ids_array
            }
            if source_conversation_id:
                insert_data["source_conversation_id"] = source_conversation_id

            result = client.table("projects").insert(insert_data).execute()
            log_app_event("PROJECT: Created successfully via fallback", user_id=user_id, resource_id=result.data[0]["id"] if result.data else None)
            return result.data[0] if result.data else None

        log_app_event(f"PROJECT: Create failed: {type(e).__name__}: {e}", user_id=user_id, level="ERROR")
        raise


def get_project_context(project_id: str, access_token: str) -> Optional[str]:
    """Get just the context_md for a project."""
    if not project_id:
        return None
    client = _get_client(access_token)
    try:
        # Use limit(1) instead of single() to avoid exception on 0 rows (deleted project)
        result = client.table("projects")\
            .select("context_md")\
            .eq("id", project_id)\
            .limit(1)\
            .execute()
        return result.data[0].get("context_md") if result.data else None
    except Exception as e:
        log_app_event(f"PROJECT: get_project_context failed: {type(e).__name__}", resource_id=project_id, level="ERROR")
        return None


def update_project(
    project_id: str,
    access_token: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    context_md: Optional[str] = None,
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    department_ids: Optional[List[str]] = None,
    source_conversation_id: Optional[str] = None,
    user_id: Optional[str] = None  # Required for security verification
) -> Optional[Dict[str, Any]]:
    """Update a project's fields.

    Uses RLS-authenticated client - access control enforced by database policies.
    """
    # Use RLS-authenticated client - database enforces access control
    client = _get_client(access_token) if access_token else get_supabase_service()
    if not client:
        log_app_event("PROJECT: No client available for update", user_id=user_id, level="ERROR")
        return None

    # RLS will block access if user doesn't have permission
    # The update will simply return no rows if access is denied

    # Build update payload with only provided fields
    now = datetime.now(tz=timezone.utc).isoformat()
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

    # Handle department assignment - use department_ids array only
    if department_ids is not None:
        update_data["department_ids"] = department_ids if department_ids else []
    elif department_id is not None:
        update_data["department_ids"] = [department_id] if department_id else []

    if source_conversation_id is not None:
        update_data["source_conversation_id"] = source_conversation_id if source_conversation_id else None

    result = client.table("projects")\
        .update(update_data)\
        .eq("id", project_id)\
        .execute()

    if result.data:
        log_app_event("PROJECT: Updated", user_id=user_id, resource_id=project_id)

    return result.data[0] if result.data else None


def touch_project_last_accessed(project_id: str, access_token: str) -> bool:
    """Update last_accessed_at to now for a project.

    Uses RLS-authenticated client - access control enforced by database policies.
    """
    if not project_id:
        return False
    try:
        # Use RLS-authenticated client
        client = _get_client(access_token) if access_token else get_supabase_service()
        if not client:
            return False
        now = datetime.now(tz=timezone.utc).isoformat()
        client.table("projects")\
            .update({"last_accessed_at": now})\
            .eq("id", project_id)\
            .execute()
        return True
    except Exception as e:
        log_app_event(f"PROJECT: touch_project_access failed: {type(e).__name__}", resource_id=project_id, level="ERROR")
        return False


def delete_project(project_id: str, access_token: str) -> Optional[dict]:
    """Delete a project by ID. Returns the deleted project data or None if failed."""
    if not project_id:
        return None
    try:
        client = _get_client(access_token)

        # First verify the project exists and user has access
        check_result = client.table("projects").select("id, name, user_id, company_id").eq("id", project_id).execute()
        if not check_result.data:
            return None
        project_data = check_result.data[0]

        # Unlink any knowledge_entries that reference this project
        client.table("knowledge_entries")\
            .update({"project_id": None})\
            .eq("project_id", project_id)\
            .execute()

        # Delete the project
        client.table("projects")\
            .delete()\
            .eq("id", project_id)\
            .execute()

        # Verify deletion actually happened
        verify_result = client.table("projects").select("id").eq("id", project_id).execute()
        if verify_result.data:
            return None  # RLS may be blocking delete

        return project_data
    except Exception as e:
        log_app_event(f"PROJECT: delete_project failed: {type(e).__name__}", resource_id=project_id, level="ERROR")
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
            .select("id, name, description, status, created_at, updated_at, last_accessed_at, context_md, department_ids")\
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
            dept_ids = project.get("department_ids") or []

            # Build list of department names from department_ids array
            project["department_names"] = [
                dept_map[did].get("name") for did in dept_ids
                if did in dept_map
            ]
            # Set department_name to first one for backwards compat
            project["department_name"] = project["department_names"][0] if project["department_names"] else None

            # Get decision count and first decision's user question (for "what was asked")
            try:
                count_result = client.table("knowledge_entries")\
                    .select("id", count="exact")\
                    .eq("project_id", project["id"])\
                    .eq("is_active", True)\
                    .execute()
                project["decision_count"] = count_result.count or 0

                # Get the first decision's question (the question that created this project)
                first_decision = client.table("knowledge_entries")\
                    .select("question")\
                    .eq("project_id", project["id"])\
                    .eq("is_active", True)\
                    .order("created_at", desc=False)\
                    .limit(1)\
                    .execute()
                if first_decision.data and len(first_decision.data) > 0:
                    project["source_question"] = first_decision.data[0].get("question")
                else:
                    project["source_question"] = None
            except Exception:
                project["decision_count"] = 0
                project["source_question"] = None

        return projects
    except Exception:
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
        log_app_event(f"STORAGE: Error getting user profile: {type(e).__name__}", user_id=user_id, level="ERROR")
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

        now = datetime.now(tz=timezone.utc).isoformat()

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
        log_app_event(f"STORAGE: Error updating user profile: {type(e).__name__}", user_id=user_id, level="ERROR")
        return None
