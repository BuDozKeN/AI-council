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


def _get_client(access_token: Optional[str] = None):
    """Get appropriate Supabase client based on whether we have an access token."""
    if access_token:
        return get_supabase_with_auth(access_token)
    return get_supabase()


def create_conversation(conversation_id: str, user_id: str, access_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new conversation.

    Args:
        conversation_id: Unique identifier for the conversation
        user_id: ID of the user creating the conversation
        access_token: User's JWT access token for RLS authentication

    Returns:
        New conversation dict
    """
    supabase = _get_client(access_token)
    now = datetime.utcnow().isoformat() + 'Z'
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
    include_archived: bool = False
) -> Dict[str, Any]:
    """
    List conversations for a specific user with at least one message (metadata only).

    Sorted by: starred first, then by message_count (most active), then by last_updated.
    This ensures frequently used conversations appear at the top.

    Args:
        user_id: ID of the user to list conversations for
        access_token: User's JWT access token for RLS authentication
        limit: Maximum number of conversations to return (default 20)
        offset: Number of conversations to skip for pagination
        search: Optional search string to filter by title
        include_archived: Whether to include archived conversations (default False)

    Returns:
        Dict with 'conversations' list and 'has_more' boolean for pagination
    """
    supabase = _get_client(access_token)

    # Build query - get conversations with message count
    query = supabase.table('conversations').select(
        '*, messages(count)'
    ).eq('user_id', user_id)

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

    # Sort: starred first, then by message count (descending), then by last_updated (descending)
    conversations.sort(key=lambda c: (
        not c['is_starred'],  # False (not starred) sorts after True (starred)
        -c['message_count'],  # Higher message count first
        c['last_updated']     # More recent first (will be reversed by negative)
    ), reverse=False)

    # Re-sort starred by last_updated within starred group
    starred = [c for c in conversations if c['is_starred']]
    non_starred = [c for c in conversations if not c['is_starred']]
    starred.sort(key=lambda c: c['last_updated'], reverse=True)
    non_starred.sort(key=lambda c: (-c['message_count'], c['last_updated']), reverse=False)
    # For non_starred, sort by message_count desc, then last_updated desc
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
    access_token: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Create a new project."""
    # Resolve slug to UUID if needed
    company_uuid = resolve_company_id(company_id_or_slug, access_token)

    client = _get_client(access_token)
    result = client.table("projects").insert({
        "company_id": company_uuid,
        "user_id": user_id,
        "name": name,
        "description": description,
        "context_md": context_md
    }).execute()
    return result.data[0] if result.data else None


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
