"""
Conversations Router

Endpoints for managing conversations:
- CRUD operations on conversations
- Streaming council sessions
- Chat mode (follow-up with chairman only)
- Export to markdown
- Star/archive/delete operations
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import asyncio
import json
import re
import uuid

from ..auth import get_current_user
from .. import storage
from .. import billing
from .. import leaderboard
from .. import attachments
from .. import image_analyzer
from ..council import (
    stage1_stream_responses,
    stage2_stream_rankings,
    stage3_stream_synthesis,
    chat_stream_response,
    generate_conversation_title
)
from ..context_loader import load_business_context
from ..security import log_app_event

# Import rate limiter from main module
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


router = APIRouter(prefix="/api", tags=["conversations"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    company_id: Optional[str] = None


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str = Field(..., max_length=50000)
    business_id: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    project_id: Optional[str] = Field(None, max_length=100)
    # Multi-select support
    departments: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    playbooks: Optional[List[str]] = None
    # Image attachments
    attachment_ids: Optional[List[str]] = None


class ChatRequest(BaseModel):
    """Request to chat with the chairman only (follow-up mode)."""
    content: str = Field(..., max_length=50000)
    business_id: Optional[str] = None
    department_id: Optional[str] = None
    project_id: Optional[str] = None
    # Multi-select support
    department_ids: Optional[List[str]] = None
    role_ids: Optional[List[str]] = None
    playbook_ids: Optional[List[str]] = None


class RenameRequest(BaseModel):
    """Request to rename a conversation."""
    title: str


class DepartmentUpdateRequest(BaseModel):
    """Request to update a conversation's department."""
    department: str


class StarRequest(BaseModel):
    """Request to star/unstar a conversation."""
    starred: bool = True


class ArchiveRequest(BaseModel):
    """Request to archive/unarchive a conversation."""
    archived: bool = True


class BulkDeleteRequest(BaseModel):
    """Request to delete multiple conversations."""
    conversation_ids: List[str]


class TriageRequest(BaseModel):
    """Request for triage analysis."""
    content: str
    business_id: Optional[str] = None


class TriageContinueRequest(BaseModel):
    """Request to continue triage with additional info."""
    original_query: str
    previous_constraints: Dict[str, Any]
    user_response: str
    business_id: Optional[str] = None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _verify_conversation_ownership(conversation: dict, user: dict) -> None:
    """Verify user owns the conversation. Raises HTTPException if not."""
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/conversations")
async def list_conversations(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("date"),
    department: Optional[str] = None,
    search: Optional[str] = None,
    company_id: Optional[str] = None,
    starred: Optional[bool] = None,
    archived: Optional[bool] = None,
    user: dict = Depends(get_current_user)
):
    """
    List conversations for the current user with pagination, filtering, and search.
    """
    access_token = user.get("access_token")
    result = storage.list_conversations(
        user_id=user["id"],
        limit=limit,
        offset=offset,
        sort_by=sort_by,
        search=search,
        company_id=company_id,
        include_archived=archived if archived is not None else False,
        access_token=access_token
    )
    # Filter by department and starred client-side if specified
    # (storage function doesn't support these filters yet)
    conversations = result.get("conversations", [])
    if department:
        conversations = [c for c in conversations if c.get("department") == department]
    if starred is not None:
        conversations = [c for c in conversations if c.get("is_starred") == starred]
    return {"conversations": conversations, "has_more": result.get("has_more", False)}


@router.post("/conversations")
async def create_conversation(
    request: CreateConversationRequest = None,
    user: dict = Depends(get_current_user)
):
    """Create a new conversation."""
    access_token = user.get("access_token")
    company_id = request.company_id if request else None
    conversation_id = str(uuid.uuid4())
    conversation = storage.create_conversation(
        conversation_id,
        user["id"],
        company_id=company_id,
        access_token=access_token
    )
    return conversation


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    """Get a specific conversation by ID."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    _verify_conversation_ownership(conversation, user)
    return conversation


@router.post("/conversations/{conversation_id}/messages")
@limiter.limit("60/minute;300/hour")
async def send_message(
    request: Request,
    conversation_id: str,
    body: SendMessageRequest,
    user: dict = Depends(get_current_user)
):
    """
    Send a message to the AI Council and stream the multi-stage response.
    This is the main council deliberation endpoint.
    """
    access_token = user.get("access_token")

    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    _verify_conversation_ownership(conversation, user)

    # Check billing limits before running council
    can_query_result = billing.check_can_query(user["id"], access_token=access_token)
    if not can_query_result["can_query"]:
        raise HTTPException(
            status_code=402,
            detail={
                "error": can_query_result["reason"],
                "action": "upgrade_required",
                "remaining": can_query_result["remaining"]
            }
        )

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0
    user_id = user["id"]

    async def event_generator():
        from ..openrouter import set_request_api_key, reset_request_api_key
        from ..byok import get_user_api_key
        from ..routers import company as company_router

        api_key_token = None
        try:
            # Get user's BYOK key if available
            user_api_key = await get_user_api_key(user_id)
            if user_api_key:
                api_key_token = set_request_api_key(user_api_key)

            # Add user message with user_id
            storage.add_user_message(conversation_id, body.content, user_id, access_token=access_token)

            # Process image attachments if provided
            enhanced_query = body.content
            if body.attachment_ids:
                yield f"data: {json.dumps({'type': 'image_analysis_start', 'count': len(body.attachment_ids)})}\n\n"

                # Download all images in parallel for better performance
                async def download_single(attachment_id):
                    return await attachments.download_attachment(
                        user_id=user_id,
                        access_token=access_token,
                        attachment_id=attachment_id,
                    )

                download_results = await asyncio.gather(
                    *[download_single(aid) for aid in body.attachment_ids],
                    return_exceptions=True
                )
                images = [img for img in download_results if img and not isinstance(img, Exception)]

                # Analyze images with vision model
                if images:
                    image_analysis = await image_analyzer.analyze_images(images, body.content)
                    enhanced_query = image_analyzer.format_query_with_images(body.content, image_analysis)
                    yield f"data: {json.dumps({'type': 'image_analysis_complete', 'analyzed': len(images), 'analysis': image_analysis})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'image_analysis_complete', 'analyzed': 0})}\n\n"

            # Start title generation in parallel (don't await yet)
            title_task = None
            title_emitted = False
            if is_first_message:
                title_task = asyncio.create_task(generate_conversation_title(body.content))

            async def check_and_emit_title():
                nonlocal title_emitted
                if title_task and not title_emitted and title_task.done():
                    try:
                        title = title_task.result()
                        storage.update_conversation_title(conversation_id, title, access_token=access_token)
                        title_emitted = True
                        return f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"
                    except Exception:
                        title_emitted = True
                return None

            # Resolve company UUID for knowledge base lookup
            company_uuid = None
            if body.business_id:
                try:
                    company_uuid = storage.resolve_company_id(body.business_id, access_token)
                except Exception:
                    pass

            # Stage 1: Collect responses with streaming
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = []
            async for event in stage1_stream_responses(
                enhanced_query,
                business_id=body.business_id,
                department_id=body.department,
                role_id=body.role,
                conversation_history=None,
                project_id=body.project_id,
                access_token=access_token,
                company_uuid=company_uuid,
                department_ids=body.departments,
                role_ids=body.roles,
                playbook_ids=body.playbooks
            ):
                title_event = await check_and_emit_title()
                if title_event:
                    yield title_event

                if event['type'] == 'stage1_token':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage1_model_complete':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage1_model_error':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage1_all_complete':
                    stage1_results = event['data']
                    yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # Stage 2: Collect rankings with streaming
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            stage2_results = []
            label_to_model = {}
            aggregate_rankings = []
            async for event in stage2_stream_rankings(enhanced_query, stage1_results, business_id=body.business_id):
                title_event = await check_and_emit_title()
                if title_event:
                    yield title_event

                if event['type'] == 'stage2_token':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage2_model_complete':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage2_model_error':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage2_all_complete':
                    stage2_results = event['data']
                    label_to_model = event['label_to_model']
                    aggregate_rankings = event['aggregate_rankings']
                    yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: Synthesize final answer with streaming
            yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
            stage3_result = {}
            async for event in stage3_stream_synthesis(
                enhanced_query,
                stage1_results,
                stage2_results,
                business_id=body.business_id,
                project_id=body.project_id,
                access_token=access_token,
                company_uuid=company_uuid,
                department_ids=body.departments,
                role_ids=body.roles,
                playbook_ids=body.playbooks
            ):
                title_event = await check_and_emit_title()
                if title_event:
                    yield title_event

                if event['type'] == 'stage3_token':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage3_error':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage3_complete':
                    stage3_result = event['data']
                    yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Final check for title if not emitted yet
            if title_task and not title_emitted:
                try:
                    title = await title_task
                    storage.update_conversation_title(conversation_id, title, access_token=access_token)
                    yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"
                except Exception:
                    pass

            # Update department on first message
            if is_first_message and body.department:
                storage.update_conversation_department(conversation_id, body.department, access_token=access_token)

            # Save complete assistant message with metadata
            storage.add_assistant_message(
                conversation_id,
                stage1_results,
                stage2_results,
                stage3_result,
                user_id,
                label_to_model=label_to_model,
                aggregate_rankings=aggregate_rankings,
                access_token=access_token
            )

            # Increment query usage after successful council run
            billing.increment_query_usage(user_id, access_token=access_token)

            # Log usage event for analytics
            if company_uuid:
                try:
                    await company_router.log_usage_event(
                        company_id=company_uuid,
                        event_type="council_session",
                        tokens_input=0,
                        tokens_output=0,
                        model_used="council",
                        session_id=conversation_id
                    )
                except Exception:
                    pass

            # Record rankings to leaderboard
            if aggregate_rankings:
                leaderboard.record_session_rankings(
                    conversation_id=conversation_id,
                    department=body.department or "standard",
                    business_id=body.business_id,
                    aggregate_rankings=aggregate_rankings
                )

            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            log_app_event("STREAM: Exception in event_generator", level="ERROR")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            if api_key_token:
                reset_request_api_key(api_key_token)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        }
    )


@router.post("/conversations/{conversation_id}/chat/stream")
@limiter.limit("60/minute;300/hour")
async def chat_with_chairman(
    request: Request,
    conversation_id: str,
    body: ChatRequest,
    user: dict = Depends(get_current_user)
):
    """
    Send a follow-up chat message and stream a response from the Chairman only.
    Used for iterating on council advice without running full deliberation.
    """
    access_token = user.get("access_token")

    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    _verify_conversation_ownership(conversation, user)

    # Check billing limits
    can_query_result = billing.check_can_query(user["id"], access_token=access_token)
    if can_query_result["remaining"] == 0 and can_query_result["remaining"] != -1:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "No remaining queries. Chat mode requires at least 1 remaining query.",
                "action": "upgrade_required",
                "remaining": 0
            }
        )

    user_id = user["id"]

    async def event_generator():
        from ..openrouter import set_request_api_key, reset_request_api_key
        from ..byok import get_user_api_key

        api_key_token = None
        try:
            user_api_key = await get_user_api_key(user_id)
            if user_api_key:
                api_key_token = set_request_api_key(user_api_key)

            # Build conversation history from existing messages
            history = []
            for msg in conversation.get("messages", []):
                if msg.get("role") == "user":
                    history.append({
                        "role": "user",
                        "content": msg.get("content", "")
                    })
                elif msg.get("role") == "assistant":
                    stage3 = msg.get("stage3", {})
                    content = stage3.get("response") or stage3.get("content", "")
                    if content:
                        history.append({
                            "role": "assistant",
                            "content": content
                        })

            history.append({
                "role": "user",
                "content": body.content
            })

            storage.add_user_message(conversation_id, body.content, user_id, access_token=access_token)

            yield f"data: {json.dumps({'type': 'chat_start'})}\n\n"

            company_uuid = None
            if body.business_id:
                try:
                    company_uuid = storage.resolve_company_id(body.business_id, access_token)
                except Exception:
                    pass

            full_content = ""
            async for event in chat_stream_response(
                history,
                business_id=body.business_id,
                department_id=body.department_id,
                project_id=body.project_id,
                access_token=access_token,
                company_uuid=company_uuid,
                department_ids=body.department_ids,
                role_ids=body.role_ids,
                playbook_ids=body.playbook_ids
            ):
                if event['type'] == 'chat_token':
                    full_content += event['content']
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'chat_error':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'chat_complete':
                    yield f"data: {json.dumps(event)}\n\n"

            storage.add_assistant_message(
                conversation_id,
                stage1=[],
                stage2=[],
                stage3={"model": "chat", "response": full_content},
                user_id=user_id,
                access_token=access_token
            )

            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            if api_key_token:
                reset_request_api_key(api_key_token)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        }
    )


@router.patch("/conversations/{conversation_id}/rename")
async def rename_conversation(
    conversation_id: str,
    request: RenameRequest,
    user: dict = Depends(get_current_user)
):
    """Rename a conversation (must be owner)."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    _verify_conversation_ownership(conversation, user)

    storage.update_conversation_title(conversation_id, request.title, access_token=access_token)
    return {"success": True, "title": request.title}


@router.patch("/conversations/{conversation_id}/department")
async def update_conversation_department(
    conversation_id: str,
    request: DepartmentUpdateRequest,
    user: dict = Depends(get_current_user)
):
    """Update the department of a conversation (must be owner)."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    _verify_conversation_ownership(conversation, user)

    storage.update_conversation_department(conversation_id, request.department, access_token=access_token)
    return {"success": True, "department": request.department}


@router.post("/conversations/{conversation_id}/star")
async def star_conversation(
    conversation_id: str,
    request: StarRequest,
    user: dict = Depends(get_current_user)
):
    """Star or unstar a conversation (must be owner)."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    _verify_conversation_ownership(conversation, user)

    storage.star_conversation(conversation_id, request.starred, access_token=access_token)
    return {"success": True, "starred": request.starred}


@router.post("/conversations/{conversation_id}/archive")
async def archive_conversation(
    conversation_id: str,
    request: ArchiveRequest,
    user: dict = Depends(get_current_user)
):
    """Archive or unarchive a conversation (must be owner)."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    _verify_conversation_ownership(conversation, user)

    storage.archive_conversation(conversation_id, request.archived, access_token=access_token)
    return {"success": True, "archived": request.archived}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    """Permanently delete a conversation (must be owner)."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    _verify_conversation_ownership(conversation, user)

    success = storage.delete_conversation(conversation_id, access_token=access_token)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


@router.post("/conversations/bulk-delete")
async def bulk_delete_conversations(
    request: BulkDeleteRequest,
    user: dict = Depends(get_current_user)
):
    """Permanently delete multiple conversations (must be owner of all)."""
    access_token = user.get("access_token")
    deleted = []
    failed = []

    for conv_id in request.conversation_ids:
        try:
            conversation = storage.get_conversation(conv_id, access_token=access_token)
            if conversation is None:
                failed.append({"id": conv_id, "reason": "not found"})
                continue

            if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
                failed.append({"id": conv_id, "reason": "access denied"})
                continue

            success = storage.delete_conversation(conv_id, access_token=access_token)
            if success:
                deleted.append(conv_id)
            else:
                failed.append({"id": conv_id, "reason": "delete failed"})
        except Exception as e:
            failed.append({"id": conv_id, "reason": str(e)})

    return {"deleted": deleted, "failed": failed, "deleted_count": len(deleted)}


@router.get("/conversations/{conversation_id}/export")
async def export_conversation_markdown(
    conversation_id: str,
    user: dict = Depends(get_current_user)
):
    """Export a conversation as a formatted Markdown file (must be owner)."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    _verify_conversation_ownership(conversation, user)

    # Build the markdown content
    md_lines = []
    md_lines.append(f"# {conversation.get('title', 'AI Council Conversation')}")
    md_lines.append("")
    md_lines.append(f"**Date:** {conversation.get('created_at', 'Unknown')[:10]}")
    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")

    for msg in conversation.get("messages", []):
        if msg.get("role") == "user":
            md_lines.append("## Question")
            md_lines.append("")
            md_lines.append(msg.get("content", ""))
            md_lines.append("")

        elif msg.get("role") == "assistant":
            stage3 = msg.get("stage3", {})
            if stage3:
                md_lines.append("## AI Council Answer")
                md_lines.append("")
                md_lines.append(stage3.get("response") or stage3.get("content", ""))
                md_lines.append("")

            stage1 = msg.get("stage1", [])
            if stage1:
                md_lines.append("### Individual Model Responses")
                md_lines.append("")
                md_lines.append("<details>")
                md_lines.append("<summary>Click to expand individual responses</summary>")
                md_lines.append("")
                for resp in stage1:
                    model_name = resp.get("model", "Unknown Model")
                    resp_content = resp.get("response") or resp.get("content", "")
                    md_lines.append(f"#### {model_name}")
                    md_lines.append("")
                    md_lines.append(resp_content)
                    md_lines.append("")
                md_lines.append("</details>")
                md_lines.append("")

            stage2 = msg.get("stage2", [])
            if stage2:
                md_lines.append("### Peer Rankings")
                md_lines.append("")
                md_lines.append("<details>")
                md_lines.append("<summary>Click to expand peer rankings</summary>")
                md_lines.append("")
                for ranking in stage2:
                    model_name = ranking.get("model", "Unknown Model")
                    parsed = ranking.get("parsed_ranking", [])
                    if parsed:
                        md_lines.append(f"**{model_name}:** {', '.join(parsed)}")
                    else:
                        md_lines.append(f"**{model_name}:** (no parsed ranking)")
                md_lines.append("")
                md_lines.append("</details>")
                md_lines.append("")

            md_lines.append("---")
            md_lines.append("")

    md_lines.append("*Generated by AI Council*")

    markdown_content = "\n".join(md_lines)

    # Create a safe filename from the title
    safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in conversation.get('title', 'conversation'))
    safe_title = safe_title.strip().replace(' ', '-')[:50]
    filename = f"{safe_title}.md"

    return Response(
        content=markdown_content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# =============================================================================
# TRIAGE ENDPOINTS
# =============================================================================

@router.post("/triage/analyze")
@limiter.limit("30/minute")
async def analyze_triage(
    request: Request,
    body: TriageRequest,
    user: dict = Depends(get_current_user)
):
    """
    Analyze a user's question for the 4 required constraints.
    Returns whether ready to proceed or what questions to ask.
    """
    from .. import triage

    business_context = None
    if body.business_id:
        business_context = load_business_context(body.business_id)

    result = await triage.analyze_for_triage(
        body.content,
        business_context=business_context
    )

    return result


@router.post("/triage/continue")
@limiter.limit("30/minute")
async def continue_triage_conversation(
    request: Request,
    body: TriageContinueRequest,
    user: dict = Depends(get_current_user)
):
    """Continue triage conversation with user's additional information."""
    from .. import triage

    business_context = None
    if body.business_id:
        business_context = load_business_context(body.business_id)

    result = await triage.continue_triage(
        original_query=body.original_query,
        previous_constraints=body.previous_constraints,
        user_response=body.user_response,
        business_context=business_context
    )

    return result
