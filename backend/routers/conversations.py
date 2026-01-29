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
from typing import Optional, List, Dict, Any, Literal
import asyncio
import json
import logging
import uuid

from ..auth import get_current_user, get_effective_user
from .. import storage
from .. import billing
from .. import leaderboard
from .. import attachments
from .. import image_analyzer
from ..i18n import t, get_locale_from_request
from ..council import (
    stage1_stream_responses,
    stage2_stream_rankings,
    stage3_stream_synthesis,
    chat_stream_response,
    generate_conversation_title,
    get_cached_council_response,
    cache_council_response,
)
from ..context_loader import load_business_context
from ..security import log_app_event
from .company.utils import (
    save_session_usage,
    check_rate_limits,
    increment_rate_counters,
    calculate_cost_cents,
    create_budget_alert,
    log_activity
)

# Import shared rate limiter (ensures limits are tracked globally)
from ..rate_limit import limiter


router = APIRouter(prefix="/conversations", tags=["conversations"])
logger = logging.getLogger(__name__)


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
    # LLM behavior modifier (per-conversation): "creative", "cautious", "concise", "detailed"
    modifier: Optional[Literal['creative', 'cautious', 'concise', 'detailed']] = None
    # LLM preset override (per-message): "conservative", "balanced", "creative"
    # If provided, overrides the department's default preset for this request
    preset_override: Optional[Literal['conservative', 'balanced', 'creative']] = None


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
    # Image attachments
    attachment_ids: Optional[List[str]] = None


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

def _verify_conversation_ownership(conversation: dict, user: dict, locale: str = 'en') -> None:
    """Verify user owns the conversation. Raises HTTPException if not."""
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail=t('errors.forbidden', locale))


def _build_council_conversation_history(conversation: dict) -> List[Dict[str, str]]:
    """
    Build conversation history for council follow-up queries.

    Includes previous user questions and comprehensive council responses
    (Stage 1 expert insights + Stage 3 synthesis) so the council can
    provide contextual follow-up analysis.

    Returns:
        List of {"role": "user/assistant", "content": "..."} messages
    """
    history = []

    for msg in conversation.get("messages", []):
        if msg.get("role") == "user":
            content = msg.get("content", "")

            # Reconstruct enhanced content from cached image analysis
            if msg.get("image_analysis"):
                content = image_analyzer.format_query_with_images(
                    content,
                    msg["image_analysis"]
                )

            history.append({
                "role": "user",
                "content": content
            })
        elif msg.get("role") == "assistant":
            # Build comprehensive council response summary
            parts = []

            # Include Stage 1 expert responses (summarized)
            stage1 = msg.get("stage1", [])
            if stage1:
                parts.append("## Previous Council Expert Responses\n")
                for expert in stage1:
                    model_name = expert.get("model", "Unknown Expert")
                    # Use a friendly name for the model
                    friendly_name = model_name.split("/")[-1] if "/" in model_name else model_name
                    response = expert.get("response", "")
                    if response:
                        # Include full response for context (truncate if extremely long)
                        if len(response) > 3000:
                            response = response[:3000] + "... [truncated]"
                        parts.append(f"### {friendly_name}\n{response}\n")

            # Include Stage 3 synthesis (the chairman's final answer)
            stage3 = msg.get("stage3", {})
            synthesis = stage3.get("response") or stage3.get("content", "")
            if synthesis:
                parts.append("## Previous Council Synthesis (Final Answer)\n")
                parts.append(synthesis)

            if parts:
                history.append({
                    "role": "assistant",
                    "content": "\n".join(parts)
                })

    return history


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("")
@limiter.limit("100/minute;500/hour")
async def list_conversations(request: Request, limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("date"),
    department: Optional[str] = None,
    search: Optional[str] = None,
    company_id: Optional[str] = None,
    starred: Optional[bool] = None,
    archived: Optional[bool] = None,
    user: dict = Depends(get_effective_user)  # Supports impersonation
):
    """
    List conversations for the current user with pagination, filtering, and search.
    When impersonating, returns the impersonated user's conversations.
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


@router.post("")
@limiter.limit("30/minute;100/hour")
async def create_conversation(request: Request, create_request: CreateConversationRequest | None = None,
    user: dict = Depends(get_current_user)
):
    """Create a new conversation."""
    access_token = user.get("access_token")
    company_id = create_request.company_id if create_request else None
    conversation_id = str(uuid.uuid4())
    conversation = storage.create_conversation(
        conversation_id,
        user["id"],
        company_id=company_id,
        access_token=access_token
    )
    return conversation


@router.get("/{conversation_id}")
@limiter.limit("100/minute;500/hour")
async def get_conversation(request: Request, conversation_id: str, user: dict = Depends(get_effective_user)):
    """Get a specific conversation by ID. Supports impersonation."""
    locale = get_locale_from_request(request)
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail=t('errors.conversation_not_found', locale))

    _verify_conversation_ownership(conversation, user, locale)
    return conversation


@router.post("/{conversation_id}/messages")
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
    locale = get_locale_from_request(request)
    access_token = user.get("access_token")

    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail=t('errors.conversation_not_found', locale))

    _verify_conversation_ownership(conversation, user, locale)

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

            # Process image attachments if provided (before saving to get analysis)
            enhanced_query = body.content
            image_analysis_result = None
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

                # Check for total failure (user sent attachments but none could be downloaded)
                if body.attachment_ids and not images:
                    failed_count = len([r for r in download_results if isinstance(r, Exception)])
                    error_details = [str(r) for r in download_results if isinstance(r, Exception)]

                    logger.warning(
                        f"All {failed_count} image downloads failed for user {user_id}",
                        extra={"attachment_ids": body.attachment_ids, "errors": error_details}
                    )

                    # Notify frontend of complete failure
                    yield f"data: {json.dumps({'type': 'image_analysis_error', 'message': 'Unable to process images. Continuing without image context.', 'failed_count': len(body.attachment_ids)})}\n\n"

                # Analyze images with vision model
                elif images:
                    image_analysis = await image_analyzer.analyze_images(images, body.content)
                    image_analysis_result = image_analysis  # Cache for database storage
                    enhanced_query = image_analyzer.format_query_with_images(body.content, image_analysis)

                    # Check for partial failure
                    partial_failures = len(body.attachment_ids) - len(images)
                    if partial_failures > 0:
                        logger.warning(f"{partial_failures} of {len(body.attachment_ids)} images failed to download for user {user_id}")

                    yield f"data: {json.dumps({'type': 'image_analysis_complete', 'analyzed': len(images), 'failed': partial_failures, 'analysis': image_analysis})}\n\n"

                else:
                    # No attachments provided (shouldn't reach here, but defensive)
                    yield f"data: {json.dumps({'type': 'image_analysis_complete', 'analyzed': 0})}\n\n"

            # Add user message with attachments and analysis (after processing)
            storage.add_user_message(
                conversation_id,
                body.content,
                user_id,
                access_token=access_token,
                attachment_ids=body.attachment_ids,
                image_analysis=image_analysis_result
            )

            # Resolve company UUID for knowledge base lookup (needed for title tracking and rate limits)
            company_uuid = None
            if body.business_id:
                try:
                    company_uuid = storage.resolve_company_id(body.business_id, access_token)
                except Exception:
                    pass

            # Start title generation in parallel (don't await yet)
            # Pass company_uuid for internal LLM usage tracking
            title_task = None
            title_emitted = False
            log_app_event("TITLE_GEN_CHECK", level="INFO", is_first_message=is_first_message, conversation_id=conversation_id, msg_count=len(conversation["messages"]))
            if is_first_message:
                log_app_event("TITLE_GEN_START", level="INFO", conversation_id=conversation_id, query=body.content[:50])
                title_task = asyncio.create_task(generate_conversation_title(body.content, company_id=company_uuid))

            async def check_and_emit_title():
                nonlocal title_emitted
                if title_task and not title_emitted and title_task.done():
                    try:
                        title = title_task.result()
                        log_app_event("TITLE_GEN_COMPLETE", level="INFO", conversation_id=conversation_id, title=title)
                        storage.update_conversation_title(conversation_id, title, access_token=access_token)
                        title_emitted = True
                        return f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"
                    except Exception as e:
                        log_app_event("TITLE_GEN_ERROR", level="ERROR", conversation_id=conversation_id, error=str(e))
                        title_emitted = True
                return None

            # Check rate limits before starting council session
            if company_uuid:
                rate_check = await check_rate_limits(company_uuid)
                if not rate_check['allowed']:
                    exceeded = rate_check['exceeded']
                    details = rate_check['details']
                    error_msg = f"Rate limit exceeded: {', '.join(exceeded)}"
                    log_app_event("RATE_LIMIT_EXCEEDED", level="WARNING", company_id=company_uuid, exceeded=exceeded)
                    yield f"data: {json.dumps({'type': 'error', 'message': error_msg, 'rate_limited': True, 'details': details})}\n\n"
                    return
                # Emit warnings if approaching limits
                if rate_check['warnings']:
                    yield f"data: {json.dumps({'type': 'rate_warning', 'warnings': rate_check['warnings'], 'details': rate_check['details']})}\n\n"

            # Track token usage across all stages
            total_usage = {
                'prompt_tokens': 0,
                'completion_tokens': 0,
                'total_tokens': 0,
                'cache_creation_input_tokens': 0,
                'cache_read_input_tokens': 0,
                'by_model': {}
            }

            def aggregate_usage(usage_data):
                """Aggregate usage from a model response."""
                if not usage_data:
                    return
                total_usage['prompt_tokens'] += usage_data.get('prompt_tokens', 0)
                total_usage['completion_tokens'] += usage_data.get('completion_tokens', 0)
                total_usage['total_tokens'] += usage_data.get('total_tokens', 0)
                total_usage['cache_creation_input_tokens'] += usage_data.get('cache_creation_input_tokens', 0)
                total_usage['cache_read_input_tokens'] += usage_data.get('cache_read_input_tokens', 0)
                # Track per-model usage
                model = usage_data.get('model', 'unknown')
                if model not in total_usage['by_model']:
                    total_usage['by_model'][model] = {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0}
                total_usage['by_model'][model]['prompt_tokens'] += usage_data.get('prompt_tokens', 0)
                total_usage['by_model'][model]['completion_tokens'] += usage_data.get('completion_tokens', 0)
                total_usage['by_model'][model]['total_tokens'] += usage_data.get('total_tokens', 0)

            # Build conversation history for follow-up council queries
            # This includes previous questions and council responses so
            # the experts can provide contextual follow-up analysis
            council_history = _build_council_conversation_history(conversation)

            # =========================================================================
            # REDIS CACHE CHECK - Return cached response if available
            # =========================================================================
            if company_uuid:
                cached_response = await get_cached_council_response(
                    company_id=company_uuid,
                    user_query=enhanced_query,
                    department_ids=body.departments,
                    role_ids=body.roles,
                )
                if cached_response:
                    log_app_event("COUNCIL_CACHE_HIT", level="INFO", company_id=company_uuid, conversation_id=conversation_id)

                    # Extract cached data
                    cached_stage1 = cached_response.get('stage1_results', [])
                    cached_stage2 = cached_response.get('stage2_results', [])
                    cached_stage3 = cached_response.get('stage3_result', {})
                    cached_metadata = cached_response.get('metadata', {})
                    cached_label_to_model = cached_metadata.get('label_to_model', {})
                    cached_aggregate_rankings = cached_metadata.get('aggregate_rankings', [])

                    # Stream cached results to frontend (mimics normal flow but instant)
                    yield f"data: {json.dumps({'type': 'cache_hit', 'cached': True})}\n\n"

                    # Stage 1 cached
                    yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
                    yield f"data: {json.dumps({'type': 'stage1_complete', 'data': cached_stage1, 'cached': True})}\n\n"

                    # Stage 2 cached
                    yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
                    yield f"data: {json.dumps({'type': 'stage2_complete', 'data': cached_stage2, 'metadata': {'label_to_model': cached_label_to_model, 'aggregate_rankings': cached_aggregate_rankings}, 'cached': True})}\n\n"

                    # Stage 3 cached
                    yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
                    yield f"data: {json.dumps({'type': 'stage3_complete', 'data': cached_stage3, 'cached': True})}\n\n"

                    # Check and emit title if ready
                    title_event = await check_and_emit_title()
                    if title_event:
                        yield title_event

                    # Save assistant message with cached results
                    storage.add_assistant_message(
                        conversation_id,
                        cached_stage1,
                        cached_stage2,
                        cached_stage3,
                        user_id,
                        label_to_model=cached_label_to_model,
                        aggregate_rankings=cached_aggregate_rankings,
                        access_token=access_token
                    )

                    # Still increment query usage (cached responses still count as a query)
                    billing.increment_query_usage(user_id, access_token=access_token)

                    # Final title check
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

                    yield f"data: {json.dumps({'type': 'complete', 'cached': True})}\n\n"
                    return  # Exit early - cached response served

            # Stage 1: Collect responses with streaming
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = []
            async for event in stage1_stream_responses(
                enhanced_query,
                business_id=body.business_id,
                department_id=body.department,
                role_id=body.role,
                conversation_history=council_history,
                project_id=body.project_id,
                access_token=access_token,
                company_uuid=company_uuid,
                department_ids=body.departments,
                role_ids=body.roles,
                playbook_ids=body.playbooks,
                conversation_modifier=body.modifier,
                preset_override=body.preset_override,
            ):
                title_event = await check_and_emit_title()
                if title_event:
                    yield title_event

                if event['type'] == 'stage1_token':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage1_model_complete':
                    # Capture usage data from this model
                    aggregate_usage(event.get('usage'))
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
            async for event in stage2_stream_rankings(enhanced_query, stage1_results, business_id=body.business_id, department_uuid=body.departments[0] if body.departments else None, preset_override=body.preset_override):
                title_event = await check_and_emit_title()
                if title_event:
                    yield title_event

                if event['type'] == 'stage2_token':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage2_model_complete':
                    # Capture usage data from this model
                    aggregate_usage(event.get('usage'))
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
                playbook_ids=body.playbooks,
                conversation_history=council_history,
                preset_override=body.preset_override,
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
                    # Capture usage data from chairman
                    aggregate_usage(event['data'].get('usage'))
                    yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Final check for title if not emitted yet
            log_app_event("TITLE_FINAL_CHECK", level="INFO", has_task=bool(title_task), title_emitted=title_emitted)
            if title_task and not title_emitted:
                try:
                    title = await title_task
                    log_app_event("TITLE_FINAL_EMIT", level="INFO", conversation_id=conversation_id, title=title)
                    storage.update_conversation_title(conversation_id, title, access_token=access_token)
                    yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"
                except Exception as e:
                    log_app_event("TITLE_FINAL_ERROR", level="ERROR", conversation_id=conversation_id, error=str(e))

            # Update department on first message
            if is_first_message and body.department:
                storage.update_conversation_department(conversation_id, body.department, access_token=access_token)

            # Save complete assistant message with metadata
            try:
                log_app_event("COUNCIL_SAVE_START", level="INFO", conversation_id=conversation_id, stage1_count=len(stage1_results), stage2_count=len(stage2_results), has_stage3=bool(stage3_result))
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
                log_app_event("COUNCIL_SAVE_SUCCESS", level="INFO", conversation_id=conversation_id)
            except Exception as save_error:
                log_app_event("COUNCIL_SAVE_ERROR", level="ERROR", conversation_id=conversation_id, error=str(save_error), stage1_count=len(stage1_results), stage2_count=len(stage2_results), has_stage3=bool(stage3_result))
                raise

            # Increment query usage after successful council run
            billing.increment_query_usage(user_id, access_token=access_token)

            # =========================================================================
            # REDIS CACHE STORE - Cache successful council response for future queries
            # =========================================================================
            if company_uuid and stage1_results and stage3_result:
                try:
                    cache_stored = await cache_council_response(
                        company_id=company_uuid,
                        user_query=enhanced_query,
                        stage1_results=stage1_results,
                        stage2_results=stage2_results,
                        stage3_result=stage3_result,
                        metadata={
                            'label_to_model': label_to_model,
                            'aggregate_rankings': aggregate_rankings,
                        },
                        department_ids=body.departments,
                        role_ids=body.roles,
                    )
                    if cache_stored:
                        log_app_event("COUNCIL_CACHE_STORED", level="INFO", company_id=company_uuid, conversation_id=conversation_id)
                except Exception as cache_err:
                    # Don't fail the request if caching fails - just log it
                    log_app_event("COUNCIL_CACHE_STORE_ERROR", level="WARNING", error=str(cache_err))

            # Log usage event for analytics with actual token counts
            # NOTE: These functions internally skip in mock mode (MOCK_LLM=true)
            if company_uuid:
                try:
                    await company_router.log_usage_event(
                        company_id=company_uuid,
                        event_type="council_session",
                        tokens_input=total_usage['prompt_tokens'],
                        tokens_output=total_usage['completion_tokens'],
                        model_used="council",
                        session_id=conversation_id
                    )
                except Exception:
                    pass

                # Save detailed session usage for LLM ops dashboard
                try:
                    await save_session_usage(
                        company_id=company_uuid,
                        conversation_id=conversation_id,
                        usage_data=total_usage,
                        session_type='council'
                    )
                except Exception:
                    pass

                # Log activity for the Activity tab
                try:
                    # Use generated title, or truncate user message as fallback
                    activity_title = title if title else (body.content[:80] + '...' if len(body.content) > 80 else body.content)
                    await log_activity(
                        company_id=company_uuid,
                        event_type="council_session",
                        title=activity_title,
                        action="created",
                        conversation_id=conversation_id,
                        department_id=body.department
                    )
                except Exception:
                    pass  # Don't fail if activity logging fails

                # Increment rate limit counters and check for budget alerts
                try:
                    cost_cents = calculate_cost_cents(total_usage)
                    counters = await increment_rate_counters(
                        company_id=company_uuid,
                        sessions=1,
                        tokens=total_usage.get('total_tokens', 0),
                        cost_cents=cost_cents
                    )

                    # Check for warning thresholds and create alerts (only if counters returned)
                    if counters:
                        rate_check = await check_rate_limits(company_uuid)
                        for warning in rate_check.get('warnings', []):
                            details = rate_check['details'].get(warning, {})
                            await create_budget_alert(
                                company_id=company_uuid,
                                alert_type=f"{warning}_warning",
                                current_value=details.get('current', 0),
                                limit_value=details.get('limit', 0)
                            )
                except Exception:
                    pass

            # Log token usage summary
            if total_usage['total_tokens'] > 0:
                log_app_event(
                    "COUNCIL_USAGE",
                    level="INFO",
                    total_tokens=total_usage['total_tokens'],
                    prompt_tokens=total_usage['prompt_tokens'],
                    completion_tokens=total_usage['completion_tokens'],
                    cache_read_tokens=total_usage['cache_read_input_tokens'],
                    cache_creation_tokens=total_usage['cache_creation_input_tokens'],
                    models_used=list(total_usage['by_model'].keys())
                )

            # Record rankings to leaderboard
            if aggregate_rankings:
                leaderboard.record_session_rankings(
                    conversation_id=conversation_id,
                    department=body.department or "standard",
                    business_id=body.business_id,
                    aggregate_rankings=aggregate_rankings
                )

            # Emit usage summary to frontend
            yield f"data: {json.dumps({'type': 'usage', 'data': total_usage})}\n\n"

            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            import traceback
            # Log full error details for debugging (internal only)
            log_app_event(
                "STREAM_ERROR",
                level="ERROR",
                error=str(e),
                error_type=type(e).__name__,
                traceback=traceback.format_exc()
            )
            # Return sanitized error to user - never expose internal details
            yield f"data: {json.dumps({'type': 'error', 'message': 'An error occurred processing your request. Please try again.'})}\n\n"
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


@router.post("/{conversation_id}/chat/stream")
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
    locale = get_locale_from_request(request)
    access_token = user.get("access_token")

    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail=t('errors.conversation_not_found', locale))

    _verify_conversation_ownership(conversation, user, locale)

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
        from ..routers import company as company_router

        api_key_token = None
        try:
            user_api_key = await get_user_api_key(user_id)
            if user_api_key:
                api_key_token = set_request_api_key(user_api_key)

            # Build conversation history from existing messages
            history = []
            for msg in conversation.get("messages", []):
                if msg.get("role") == "user":
                    content = msg.get("content", "")

                    # Reconstruct enhanced content from cached image analysis
                    if msg.get("image_analysis"):
                        content = image_analyzer.format_query_with_images(
                            content,
                            msg["image_analysis"]
                        )

                    history.append({
                        "role": "user",
                        "content": content
                    })
                elif msg.get("role") == "assistant":
                    stage3 = msg.get("stage3", {})
                    content = stage3.get("response") or stage3.get("content", "")
                    if content:
                        history.append({
                            "role": "assistant",
                            "content": content
                        })

            # Process image attachments if provided (before saving to get analysis)
            enhanced_content = body.content
            image_analysis_result = None
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

                # Check for total failure (user sent attachments but none could be downloaded)
                if body.attachment_ids and not images:
                    failed_count = len([r for r in download_results if isinstance(r, Exception)])
                    error_details = [str(r) for r in download_results if isinstance(r, Exception)]

                    logger.warning(
                        f"All {failed_count} image downloads failed for user {user_id}",
                        extra={"attachment_ids": body.attachment_ids, "errors": error_details}
                    )

                    # Notify frontend of complete failure
                    yield f"data: {json.dumps({'type': 'image_analysis_error', 'message': 'Unable to process images. Continuing without image context.', 'failed_count': len(body.attachment_ids)})}\n\n"

                # Analyze images with vision model
                elif images:
                    image_analysis = await image_analyzer.analyze_images(images, body.content)
                    image_analysis_result = image_analysis  # Cache for database storage
                    enhanced_content = image_analyzer.format_query_with_images(body.content, image_analysis)

                    # Check for partial failure
                    partial_failures = len(body.attachment_ids) - len(images)
                    if partial_failures > 0:
                        logger.warning(f"{partial_failures} of {len(body.attachment_ids)} images failed to download for user {user_id}")

                    yield f"data: {json.dumps({'type': 'image_analysis_complete', 'analyzed': len(images), 'failed': partial_failures, 'analysis': image_analysis})}\n\n"

                else:
                    # No attachments provided (shouldn't reach here, but defensive)
                    yield f"data: {json.dumps({'type': 'image_analysis_complete', 'analyzed': 0})}\n\n"

            history.append({
                "role": "user",
                "content": enhanced_content
            })

            # Add user message with attachments and analysis (after processing)
            storage.add_user_message(
                conversation_id,
                body.content,
                user_id,
                access_token=access_token,
                attachment_ids=body.attachment_ids,
                image_analysis=image_analysis_result
            )

            yield f"data: {json.dumps({'type': 'chat_start'})}\n\n"

            company_uuid = None
            if body.business_id:
                try:
                    company_uuid = storage.resolve_company_id(body.business_id, access_token)
                except Exception:
                    pass

            full_content = ""
            chat_usage = None
            chat_model = None
            async for event in chat_stream_response(
                history,
                business_id=body.business_id,
                department_id=body.department_id,
                project_id=body.project_id,
                access_token=access_token,
                company_uuid=company_uuid,
                department_ids=body.department_ids,
                role_ids=body.role_ids,
                playbook_ids=body.playbook_ids,
                attachment_ids=body.attachment_ids
            ):
                if event['type'] == 'chat_token':
                    full_content += event['content']
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'chat_error':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'chat_complete':
                    # Extract usage data from chat_complete event
                    chat_data = event.get('data', {})
                    chat_usage = chat_data.get('usage')
                    chat_model = chat_data.get('model')
                    yield f"data: {json.dumps(event)}\n\n"

            storage.add_assistant_message(
                conversation_id,
                stage1=[],
                stage2=[],
                stage3={"model": chat_model or "chat", "response": full_content},
                user_id=user_id,
                access_token=access_token
            )

            # Track chat usage for analytics (mirrors council session tracking)
            if chat_usage and company_uuid:
                # Build usage data structure matching council format
                total_usage = {
                    'prompt_tokens': chat_usage.get('prompt_tokens', 0),
                    'completion_tokens': chat_usage.get('completion_tokens', 0),
                    'total_tokens': chat_usage.get('total_tokens', 0),
                    'cache_read_input_tokens': chat_usage.get('cache_read_input_tokens', 0),
                    'cache_creation_input_tokens': chat_usage.get('cache_creation_input_tokens', 0),
                    'by_model': {}
                }
                if chat_model:
                    total_usage['by_model'][chat_model] = {
                        'prompt_tokens': chat_usage.get('prompt_tokens', 0),
                        'completion_tokens': chat_usage.get('completion_tokens', 0),
                        'total_tokens': chat_usage.get('total_tokens', 0)
                    }

                # Log usage event for analytics
                try:
                    await company_router.log_usage_event(
                        company_id=company_uuid,
                        event_type="chat_session",
                        tokens_input=total_usage['prompt_tokens'],
                        tokens_output=total_usage['completion_tokens'],
                        model_used=chat_model or "chat",
                        session_id=conversation_id
                    )
                except Exception as e:
                    log_app_event("CHAT_USAGE: Failed to log usage event", level="WARNING", error=str(e))

                # Save detailed session usage for LLM ops dashboard
                try:
                    await save_session_usage(
                        company_id=company_uuid,
                        conversation_id=conversation_id,
                        usage_data=total_usage,
                        session_type='chat'
                    )
                except Exception as e:
                    log_app_event("CHAT_USAGE: Failed to save session usage", level="WARNING", error=str(e))

                # Increment rate limit counters
                try:
                    cost_cents = calculate_cost_cents(total_usage)
                    counters = await increment_rate_counters(
                        company_id=company_uuid,
                        sessions=1,
                        tokens=total_usage.get('total_tokens', 0),
                        cost_cents=cost_cents
                    )

                    # Check for warning thresholds and create alerts
                    if counters:
                        rate_check = await check_rate_limits(company_uuid)
                        for warning in rate_check.get('warnings', []):
                            details = rate_check['details'].get(warning, {})
                            await create_budget_alert(
                                company_id=company_uuid,
                                alert_type=f"{warning}_warning",
                                current_value=details.get('current', 0),
                                limit_value=details.get('limit', 0)
                            )
                except Exception as e:
                    log_app_event("CHAT_USAGE: Failed to increment rate counters", level="WARNING", error=str(e))

                # Log token usage summary
                if total_usage['total_tokens'] > 0:
                    log_app_event(
                        "CHAT_USAGE",
                        level="INFO",
                        total_tokens=total_usage['total_tokens'],
                        prompt_tokens=total_usage['prompt_tokens'],
                        completion_tokens=total_usage['completion_tokens'],
                        model=chat_model
                    )

                # Emit usage summary to frontend
                yield f"data: {json.dumps({'type': 'usage', 'data': total_usage})}\n\n"

            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            import traceback
            # Log full error details for debugging (internal only)
            log_app_event(
                "CHAT_STREAM_ERROR",
                level="ERROR",
                error=str(e),
                error_type=type(e).__name__,
                traceback=traceback.format_exc()
            )
            # Return sanitized error to user - never expose internal details
            yield f"data: {json.dumps({'type': 'error', 'message': 'An error occurred processing your request. Please try again.'})}\n\n"
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


@router.patch("/{conversation_id}/rename")
@limiter.limit("30/minute;100/hour")
async def rename_conversation(request: Request, conversation_id: str,
    rename_request: RenameRequest,
    user: dict = Depends(get_current_user)
):
    """Rename a conversation (must be owner)."""
    locale = get_locale_from_request(request)
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail=t('errors.conversation_not_found', locale))

    _verify_conversation_ownership(conversation, user, locale)

    storage.update_conversation_title(conversation_id, rename_request.title, access_token=access_token)
    return {"success": True, "title": rename_request.title}


@router.patch("/{conversation_id}/department")
@limiter.limit("30/minute;100/hour")
async def update_conversation_department(request: Request, conversation_id: str,
    dept_request: DepartmentUpdateRequest,
    user: dict = Depends(get_current_user)
):
    """Update the department of a conversation (must be owner)."""
    locale = get_locale_from_request(request)
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail=t('errors.conversation_not_found', locale))

    _verify_conversation_ownership(conversation, user, locale)

    storage.update_conversation_department(conversation_id, dept_request.department, access_token=access_token)
    return {"success": True, "department": dept_request.department}


@router.post("/{conversation_id}/star")
@limiter.limit("30/minute;100/hour")
async def star_conversation(request: Request, conversation_id: str,
    star_request: StarRequest,
    user: dict = Depends(get_current_user)
):
    """Star or unstar a conversation (must be owner)."""
    locale = get_locale_from_request(request)
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail=t('errors.conversation_not_found', locale))

    _verify_conversation_ownership(conversation, user, locale)

    storage.star_conversation(conversation_id, star_request.starred, access_token=access_token)
    return {"success": True, "starred": star_request.starred}


@router.post("/{conversation_id}/archive")
@limiter.limit("30/minute;100/hour")
async def archive_conversation(request: Request, conversation_id: str,
    archive_request: ArchiveRequest,
    user: dict = Depends(get_current_user)
):
    """Archive or unarchive a conversation (must be owner)."""
    locale = get_locale_from_request(request)
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail=t('errors.conversation_not_found', locale))

    _verify_conversation_ownership(conversation, user, locale)

    storage.archive_conversation(conversation_id, archive_request.archived, access_token=access_token)
    return {"success": True, "archived": archive_request.archived}


@router.delete("/{conversation_id}")
@limiter.limit("20/minute;50/hour")
async def delete_conversation(request: Request, conversation_id: str, user: dict = Depends(get_current_user)):
    """Permanently delete a conversation (must be owner)."""
    locale = get_locale_from_request(request)
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail=t('errors.conversation_not_found', locale))

    _verify_conversation_ownership(conversation, user, locale)

    success = storage.delete_conversation(conversation_id, access_token=access_token)
    if not success:
        raise HTTPException(status_code=404, detail=t('errors.conversation_not_found', locale))
    return {"success": True}


@router.post("/bulk-delete")
@limiter.limit("10/minute;30/hour")
async def bulk_delete_conversations(request: Request, delete_request: BulkDeleteRequest,
    user: dict = Depends(get_current_user)
):
    """Permanently delete multiple conversations (must be owner of all)."""
    access_token = user.get("access_token")
    failed = []

    # Performance: Batch fetch all conversations in one query (avoids N+1)
    conversations = storage.get_conversations_by_ids(delete_request.conversation_ids, access_token=access_token)
    conv_map = {c["id"]: c for c in conversations}

    # Check authorization and collect IDs to delete
    authorized_ids = []
    for conv_id in delete_request.conversation_ids:
        conversation = conv_map.get(conv_id)
        if conversation is None:
            failed.append({"id": conv_id, "reason": "not found"})
        elif conversation.get("user_id") and conversation.get("user_id") != user["id"]:
            failed.append({"id": conv_id, "reason": "access denied"})
        else:
            authorized_ids.append(conv_id)

    # Performance: Batch delete all authorized conversations (2 queries instead of 2N)
    deleted = []
    if authorized_ids:
        try:
            storage.bulk_delete_conversations(authorized_ids, access_token=access_token)
            deleted = authorized_ids
        except Exception as e:
            # If batch delete fails, report all as failed
            for conv_id in authorized_ids:
                failed.append({"id": conv_id, "reason": str(e)})

    return {"deleted": deleted, "failed": failed, "deleted_count": len(deleted)}


@router.get("/{conversation_id}/export")
@limiter.limit("10/minute;30/hour")
async def export_conversation_markdown(request: Request, conversation_id: str,
    user: dict = Depends(get_current_user)
):
    """Export a conversation as a formatted Markdown file (must be owner)."""
    locale = get_locale_from_request(request)
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail=t('errors.conversation_not_found', locale))

    _verify_conversation_ownership(conversation, user, locale)

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
# GDPR DATA EXPORT (Article 20 - Right to Data Portability)
# =============================================================================

@router.get("/export/all")
@limiter.limit("5/minute;10/hour")
async def export_all_user_data(request: Request, user: dict = Depends(get_current_user),
    format: Literal["json", "zip"] = Query(default="json", description="Export format")
):
    """
    Export ALL user data for GDPR Article 20 compliance (right to data portability).

    Returns a comprehensive JSON export of:
    - All conversations with messages
    - All knowledge entries
    - User profile information
    - Company memberships

    This endpoint is rate-limited to prevent abuse.
    """
    locale = get_locale_from_request(request)
    user_id = user.get("id")
    access_token = user.get("access_token")

    if not user_id:
        raise HTTPException(status_code=401, detail=t('errors.user_not_found', locale))

    try:
        from ..database import get_supabase_with_auth
    except ImportError:
        from backend.database import get_supabase_with_auth

    supabase = get_supabase_with_auth(access_token)

    export_data: Dict[str, Any] = {
        "export_version": "1.0",
        "export_date": None,
        "user": {},
        "companies": [],
        "conversations": [],
        "knowledge_entries": [],
    }

    # Get current timestamp
    from datetime import datetime, timezone
    export_data["export_date"] = datetime.now(timezone.utc).isoformat()

    # 1. Export user profile
    try:
        user_result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        if user_result.data:
            # Exclude sensitive fields
            profile = user_result.data
            export_data["user"] = {
                "id": profile.get("id"),
                "email": profile.get("email"),
                "full_name": profile.get("full_name"),
                "avatar_url": profile.get("avatar_url"),
                "created_at": profile.get("created_at"),
                "updated_at": profile.get("updated_at"),
            }
    except Exception:
        # Profile table might not exist or user might not have profile
        export_data["user"] = {"id": user_id, "email": user.get("email")}

    # 2. Export companies the user owns
    try:
        companies_result = supabase.table("companies").select("*").eq("user_id", user_id).execute()
        if companies_result.data:
            for company in companies_result.data:
                company_export = {
                    "id": company.get("id"),
                    "name": company.get("name"),
                    "context": company.get("context"),
                    "created_at": company.get("created_at"),
                    "departments": [],
                    "roles": [],
                    "playbooks": [],
                }

                # Get departments for this company
                try:
                    dept_result = supabase.table("departments").select("*").eq("company_id", company.get("id")).execute()
                    if dept_result.data:
                        company_export["departments"] = dept_result.data
                except Exception:
                    pass

                # Get roles for this company
                try:
                    roles_result = supabase.table("roles").select("*").eq("company_id", company.get("id")).execute()
                    if roles_result.data:
                        company_export["roles"] = roles_result.data
                except Exception:
                    pass

                # Get playbooks (org_documents) for this company
                try:
                    playbooks_result = supabase.table("org_documents").select("*").eq("company_id", company.get("id")).execute()
                    if playbooks_result.data:
                        company_export["playbooks"] = playbooks_result.data
                except Exception:
                    pass

                export_data["companies"].append(company_export)
    except Exception:
        pass

    # 3. Export all conversations
    try:
        # Get conversations owned by user
        convs_result = supabase.table("conversations").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        if convs_result.data:
            for conv in convs_result.data:
                conv_export = {
                    "id": conv.get("id"),
                    "title": conv.get("title"),
                    "created_at": conv.get("created_at"),
                    "updated_at": conv.get("updated_at"),
                    "is_starred": conv.get("is_starred"),
                    "is_archived": conv.get("is_archived"),
                    "company_id": conv.get("company_id"),
                    "messages": conv.get("messages", []),
                }
                export_data["conversations"].append(conv_export)
    except Exception:
        pass

    # 4. Export knowledge entries
    try:
        knowledge_result = supabase.table("knowledge_entries").select("*").eq("user_id", user_id).execute()
        if knowledge_result.data:
            export_data["knowledge_entries"] = knowledge_result.data
    except Exception:
        pass

    # Log the export for audit purposes
    log_app_event(
        "GDPR_DATA_EXPORT",
        level="INFO",
        user_id=user_id,
        conversations_count=len(export_data["conversations"]),
        companies_count=len(export_data["companies"]),
        knowledge_count=len(export_data["knowledge_entries"]),
    )

    # Return as JSON
    export_json = json.dumps(export_data, indent=2, default=str)

    return Response(
        content=export_json,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="axcouncil-data-export-{user_id[:8]}.json"'
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
