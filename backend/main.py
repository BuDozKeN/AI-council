"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from fastapi import Request
import uuid
import json
import asyncio

from . import storage
from .council import run_full_council, generate_conversation_title, stage1_collect_responses, stage1_stream_responses, stage2_collect_rankings, stage2_stream_rankings, stage3_synthesize_final, stage3_stream_synthesis, calculate_aggregate_rankings, chat_stream_response
from .context_loader import list_available_businesses, load_business_context
from .auth import get_current_user
from . import leaderboard
from . import triage
from . import curator
from . import org_sync
from . import config
from . import billing
from . import attachments
from . import image_analyzer
from . import knowledge
from .routers import company as company_router

app = FastAPI(title="LLM Council API")

# CORS origins list
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:5178",
    "http://localhost:5179",
    "http://localhost:3000",
    "https://ai-council-three.vercel.app",
]

# Enable CORS - MUST be added before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Vercel preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # Allow frontend to read filename header
)

# Exception handler to ensure CORS headers on error responses
@app.exception_handler(HTTPException)
async def cors_exception_handler(request: Request, exc: HTTPException):
    from fastapi.responses import JSONResponse
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in CORS_ORIGINS or origin.endswith(".vercel.app"):
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers
    )

# Include routers
app.include_router(company_router.router)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint to verify deployment."""
    return {"status": "healthy", "version": "2025-12-09-v15-profile-debug"}


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    pass


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str
    business_id: Optional[str] = None
    department: Optional[str] = "standard"
    role: Optional[str] = None  # Role ID for persona injection (e.g., 'cto', 'head-of-ai-people-culture')
    project_id: Optional[str] = None  # Project ID for project-specific context
    attachment_ids: Optional[List[str]] = None  # Optional list of attachment IDs (images to analyze)


class ChatRequest(BaseModel):
    """Request to send a chat message (Chairman only, no full council)."""
    content: str
    business_id: Optional[str] = None
    department_id: Optional[str] = None
    project_id: Optional[str] = None  # Project ID for project-specific context


class CreateDepartmentRequest(BaseModel):
    """Request to create a new department for a business."""
    id: str
    name: str


class CreateKnowledgeRequest(BaseModel):
    """Request to create a knowledge entry with structured decision fields."""
    company_id: str
    title: str
    summary: str  # Kept for backwards compatibility
    category: str  # technical_decision, ux_pattern, feature, policy, process, role, framework, sop
    department_id: Optional[str] = None
    role_id: Optional[str] = None
    project_id: Optional[str] = None
    source_conversation_id: Optional[str] = None
    # Structured decision fields
    problem_statement: Optional[str] = None  # What problem/question led to this
    decision_text: Optional[str] = None       # The actual decision made
    reasoning: Optional[str] = None           # Why this decision was made
    status: str = "active"                    # active, superseded, archived
    # Framework/SOP support
    body_md: Optional[str] = None             # Long-form markdown content for SOPs/Frameworks
    version: str = "v1"                       # Version tracking (v1, v2, etc.)


class UpdateKnowledgeRequest(BaseModel):
    """Request to update a knowledge entry."""
    title: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[str] = None
    department_id: Optional[str] = None
    project_id: Optional[str] = None
    problem_statement: Optional[str] = None
    decision_text: Optional[str] = None
    reasoning: Optional[str] = None
    status: Optional[str] = None  # active, superseded, archived
    body_md: Optional[str] = None
    version: Optional[str] = None


class ConversationMetadata(BaseModel):
    """Conversation metadata for list view."""
    id: str
    created_at: str
    last_updated: str
    title: str
    message_count: int
    archived: bool = False
    department: str = "standard"


class Conversation(BaseModel):
    """Full conversation with all messages."""
    id: str
    created_at: str
    title: str
    messages: List[Dict[str, Any]]


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


@app.get("/api/businesses")
async def get_businesses():
    """List all available business contexts."""
    return list_available_businesses()


@app.post("/api/businesses/{business_id}/departments")
async def create_department(business_id: str, request: CreateDepartmentRequest):
    """Create a new department for a business.

    This scaffolds the department folder structure and creates an initial context file.
    """
    from .context_loader import create_department_for_business

    try:
        result = create_department_for_business(business_id, request.id, request.name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create department: {str(e)}")


@app.get("/api/conversations")
async def list_conversations(
    user: dict = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    include_archived: bool = False
):
    """
    List conversations for the authenticated user (metadata only).

    Sorted by: starred first, then by message_count (most active), then by last_updated.
    Returns { conversations: [...], has_more: bool } for pagination.
    """
    import time
    start = time.time()
    result = storage.list_conversations(
        user["id"],
        access_token=user.get("access_token"),
        limit=limit,
        offset=offset,
        search=search,
        include_archived=include_archived
    )
    elapsed = time.time() - start
    print(f"[PERF] list_conversations took {elapsed:.2f}s for {len(result['conversations'])} conversations (limit={limit}, offset={offset})", flush=True)
    return result


@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(request: CreateConversationRequest, user: dict = Depends(get_current_user)):
    """Create a new conversation for the authenticated user."""
    conversation_id = str(uuid.uuid4())
    conversation = storage.create_conversation(conversation_id, user["id"], access_token=user.get("access_token"))
    return conversation


@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    """Get a specific conversation with all its messages (must be owner)."""
    import time
    start = time.time()
    conversation = storage.get_conversation(conversation_id, access_token=user.get("access_token"))
    elapsed = time.time() - start
    print(f"[PERF] get_conversation took {elapsed:.2f}s", flush=True)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return conversation


@app.post("/api/conversations/{conversation_id}/message")
async def send_message(conversation_id: str, request: SendMessageRequest, user: dict = Depends(get_current_user)):
    """
    Send a message and run the 3-stage council process.
    Returns the complete response with all stages.
    """
    access_token = user.get("access_token")

    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

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

    # Add user message with user_id
    storage.add_user_message(conversation_id, request.content, user["id"], access_token=access_token)

    # If this is the first message, generate a title
    if is_first_message:
        title = await generate_conversation_title(request.content)
        storage.update_conversation_title(conversation_id, title, access_token=access_token)

    # Run the 3-stage council process
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(
        request.content,
        business_id=request.business_id
    )

    # Add assistant message with all stages and metadata
    storage.add_assistant_message(
        conversation_id,
        stage1_results,
        stage2_results,
        stage3_result,
        user["id"],
        label_to_model=metadata.get('label_to_model'),
        aggregate_rankings=metadata.get('aggregate_rankings'),
        access_token=access_token
    )

    # Increment query usage after successful council run
    billing.increment_query_usage(user["id"], access_token=access_token)

    # Return the complete response with metadata
    return {
        "stage1": stage1_results,
        "stage2": stage2_results,
        "stage3": stage3_result,
        "metadata": metadata
    }


@app.post("/api/conversations/{conversation_id}/message/stream")
async def send_message_stream(conversation_id: str, request: SendMessageRequest, user: dict = Depends(get_current_user)):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    """
    access_token = user.get("access_token")

    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

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

    # Capture user_id and access_token for use in generator
    user_id = user["id"]

    # Build conversation history from existing messages (for follow-up council queries)
    conversation_history = []
    for msg in conversation.get("messages", []):
        if msg.get("role") == "user":
            conversation_history.append({
                "role": "user",
                "content": msg.get("content", "")
            })
        elif msg.get("role") == "assistant":
            # For assistant messages, use the Stage 3 synthesized response
            stage3 = msg.get("stage3", {})
            content = stage3.get("response") or stage3.get("content", "")
            if content:
                conversation_history.append({
                    "role": "assistant",
                    "content": content
                })

    async def event_generator():
        try:
            print(f"[STREAM] Starting event_generator for conversation {conversation_id}", flush=True)

            # Add user message with user_id
            storage.add_user_message(conversation_id, request.content, user_id, access_token=access_token)
            print(f"[STREAM] User message saved", flush=True)

            # Process image attachments if provided
            enhanced_query = request.content
            if request.attachment_ids:
                print(f"[STREAM] Processing {len(request.attachment_ids)} image attachments", flush=True)
                yield f"data: {json.dumps({'type': 'image_analysis_start', 'count': len(request.attachment_ids)})}\n\n"

                # Download all images
                images = []
                for attachment_id in request.attachment_ids:
                    image_data = await attachments.download_attachment(
                        user_id=user_id,
                        access_token=access_token,
                        attachment_id=attachment_id,
                    )
                    if image_data:
                        images.append(image_data)
                        print(f"[STREAM] Downloaded image: {image_data['name']}", flush=True)

                # Analyze images with vision model
                if images:
                    print(f"[STREAM] Analyzing {len(images)} images with vision model", flush=True)
                    image_analysis = await image_analyzer.analyze_images(images, request.content)
                    enhanced_query = image_analyzer.format_query_with_images(request.content, image_analysis)
                    print(f"[STREAM] Image analysis complete, query enhanced", flush=True)

                    # Send the image analysis to frontend so user can see what the council receives
                    yield f"data: {json.dumps({'type': 'image_analysis_complete', 'analyzed': len(images), 'analysis': image_analysis})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'image_analysis_complete', 'analyzed': 0})}\n\n"

            # Start title generation in parallel (don't await yet)
            title_task = None
            if is_first_message:
                title_task = asyncio.create_task(generate_conversation_title(request.content))

            # Resolve company UUID for knowledge base lookup
            company_uuid = None
            if request.business_id:
                try:
                    company_uuid = storage.resolve_company_id(request.business_id, access_token)
                    print(f"[STREAM] Resolved company_uuid: {company_uuid}", flush=True)
                except Exception as e:
                    print(f"[STREAM] Could not resolve company_uuid: {e}", flush=True)

            # Stage 1: Collect responses with streaming
            print(f"[STREAM] Emitting stage1_start", flush=True)
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = []
            print(f"[STREAM] Starting stage1_stream_responses", flush=True)
            async for event in stage1_stream_responses(
                enhanced_query,  # Use enhanced query with image analysis
                business_id=request.business_id,
                department_id=request.department,
                role_id=request.role,
                conversation_history=conversation_history if conversation_history else None,
                project_id=request.project_id,
                access_token=access_token,
                company_uuid=company_uuid
            ):
                if event['type'] == 'stage1_token':
                    # Stream individual tokens
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage1_model_complete':
                    # A single model finished
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage1_model_error':
                    # A model had an error
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage1_all_complete':
                    # All models done - capture results
                    stage1_results = event['data']
                    yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # Stage 2: Collect rankings with streaming
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            stage2_results = []
            label_to_model = {}
            aggregate_rankings = []
            async for event in stage2_stream_rankings(enhanced_query, stage1_results, business_id=request.business_id):
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
                enhanced_query,  # Use enhanced query with image analysis
                stage1_results,
                stage2_results,
                business_id=request.business_id,
                project_id=request.project_id,
                access_token=access_token,
                company_uuid=company_uuid
            ):
                if event['type'] == 'stage3_token':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage3_error':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'stage3_complete':
                    stage3_result = event['data']
                    yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Wait for title generation if it was started
            if title_task:
                title = await title_task
                storage.update_conversation_title(conversation_id, title, access_token=access_token)
                yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

            # Update department on first message
            if is_first_message and request.department:
                storage.update_conversation_department(conversation_id, request.department, access_token=access_token)

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

            # Record rankings to leaderboard
            if aggregate_rankings:
                leaderboard.record_session_rankings(
                    conversation_id=conversation_id,
                    department=request.department or "standard",
                    business_id=request.business_id,
                    aggregate_rankings=aggregate_rankings
                )

            # Send completion event
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            # Send error event with full traceback
            import traceback
            error_details = traceback.format_exc()
            print(f"[STREAM ERROR] Exception in event_generator: {e}\n{error_details}", flush=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx/proxy buffering
            "Transfer-Encoding": "chunked",  # Force chunked encoding
        }
    )


@app.post("/api/conversations/{conversation_id}/chat/stream")
async def chat_with_chairman(conversation_id: str, request: ChatRequest, user: dict = Depends(get_current_user)):
    """
    Send a follow-up chat message and stream a response from the Chairman only.
    Used for iterating on council advice without running full deliberation.
    """
    access_token = user.get("access_token")

    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check billing limits (chat mode requires active subscription but doesn't count toward limit)
    can_query_result = billing.check_can_query(user["id"], access_token=access_token)
    if can_query_result["remaining"] == 0 and can_query_result["remaining"] != -1:
        # Only block if they have 0 remaining AND it's not unlimited (-1)
        raise HTTPException(
            status_code=402,
            detail={
                "error": "No remaining queries. Chat mode requires at least 1 remaining query.",
                "action": "upgrade_required",
                "remaining": 0
            }
        )

    # Capture user_id and access_token for use in generator
    user_id = user["id"]

    async def event_generator():
        try:
            # Build conversation history from existing messages
            history = []

            for msg in conversation.get("messages", []):
                if msg.get("role") == "user":
                    history.append({
                        "role": "user",
                        "content": msg.get("content", "")
                    })
                elif msg.get("role") == "assistant":
                    # For assistant messages, use the Stage 3 synthesized response
                    stage3 = msg.get("stage3", {})
                    content = stage3.get("response") or stage3.get("content", "")
                    if content:
                        history.append({
                            "role": "assistant",
                            "content": content
                        })

            # Add the new user message to history
            history.append({
                "role": "user",
                "content": request.content
            })

            # Also save the user message to storage with user_id
            storage.add_user_message(conversation_id, request.content, user_id, access_token=access_token)

            yield f"data: {json.dumps({'type': 'chat_start'})}\n\n"

            # Resolve company UUID for knowledge base lookup
            company_uuid = None
            if request.business_id:
                try:
                    company_uuid = storage.resolve_company_id(request.business_id, access_token)
                except Exception:
                    pass  # Non-critical, continue without knowledge

            # Stream response from chairman
            full_content = ""
            async for event in chat_stream_response(
                history,
                business_id=request.business_id,
                department_id=request.department_id,
                project_id=request.project_id,
                access_token=access_token,
                company_uuid=company_uuid
            ):
                if event['type'] == 'chat_token':
                    full_content += event['content']
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'chat_error':
                    yield f"data: {json.dumps(event)}\n\n"
                elif event['type'] == 'chat_complete':
                    yield f"data: {json.dumps(event)}\n\n"

            # Save the chat response as a simplified assistant message
            # Use empty stage1/stage2 since this is chat-only
            storage.add_assistant_message(
                conversation_id,
                stage1=[],  # No stage 1 for chat mode
                stage2=[],  # No stage 2 for chat mode
                stage3={"model": "chat", "response": full_content},
                user_id=user_id,
                access_token=access_token
            )

            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx/proxy buffering
            "Transfer-Encoding": "chunked",  # Force chunked encoding
        }
    )


# Triage endpoints
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


@app.post("/api/triage/analyze")
async def analyze_triage(request: TriageRequest):
    """
    Analyze a user's question for the 4 required constraints.
    Returns whether ready to proceed or what questions to ask.
    """
    # Load business context if specified
    business_context = None
    if request.business_id:
        business_context = load_business_context(request.business_id)

    result = await triage.analyze_for_triage(
        request.content,
        business_context=business_context
    )

    return result


@app.post("/api/triage/continue")
async def continue_triage_conversation(request: TriageContinueRequest):
    """
    Continue triage conversation with user's additional information.
    """
    business_context = None
    if request.business_id:
        business_context = load_business_context(request.business_id)

    result = await triage.continue_triage(
        original_query=request.original_query,
        previous_constraints=request.previous_constraints,
        user_response=request.user_response,
        business_context=business_context
    )

    return result


# Rename endpoint
class RenameRequest(BaseModel):
    """Request to rename a conversation."""
    title: str


@app.patch("/api/conversations/{conversation_id}/rename")
async def rename_conversation(conversation_id: str, request: RenameRequest, user: dict = Depends(get_current_user)):
    """Rename a conversation (must be owner)."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    storage.update_conversation_title(conversation_id, request.title, access_token=access_token)
    return {"success": True, "title": request.title}


# Star/Archive/Delete endpoints
class StarRequest(BaseModel):
    """Request to star/unstar a conversation."""
    starred: bool = True


class ArchiveRequest(BaseModel):
    """Request to archive/unarchive a conversation."""
    archived: bool = True


@app.post("/api/conversations/{conversation_id}/star")
async def star_conversation(conversation_id: str, request: StarRequest, user: dict = Depends(get_current_user)):
    """Star or unstar a conversation (must be owner). Starred conversations appear at top of list."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    storage.star_conversation(conversation_id, request.starred, access_token=access_token)
    return {"success": True, "starred": request.starred}


@app.post("/api/conversations/{conversation_id}/archive")
async def archive_conversation(conversation_id: str, request: ArchiveRequest, user: dict = Depends(get_current_user)):
    """Archive or unarchive a conversation (must be owner)."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    storage.archive_conversation(conversation_id, request.archived, access_token=access_token)
    return {"success": True, "archived": request.archived}


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    """Permanently delete a conversation (must be owner)."""
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    success = storage.delete_conversation(conversation_id, access_token=access_token)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


class BulkDeleteRequest(BaseModel):
    conversation_ids: List[str]


@app.post("/api/conversations/bulk-delete")
async def bulk_delete_conversations(request: BulkDeleteRequest, user: dict = Depends(get_current_user)):
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

            # Verify ownership
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


# Leaderboard endpoints
@app.get("/api/leaderboard")
async def get_leaderboard_summary():
    """Get full leaderboard summary with overall and per-department rankings."""
    return leaderboard.get_leaderboard_summary()


@app.get("/api/leaderboard/overall")
async def get_overall_leaderboard():
    """Get overall model leaderboard across all sessions."""
    return leaderboard.get_overall_leaderboard()


@app.get("/api/leaderboard/department/{department}")
async def get_department_leaderboard(department: str):
    """Get leaderboard for a specific department."""
    return leaderboard.get_department_leaderboard(department)


# Export endpoint
@app.get("/api/conversations/{conversation_id}/export")
async def export_conversation_markdown(conversation_id: str, user: dict = Depends(get_current_user)):
    """
    Export a conversation as a formatted Markdown file (must be owner).
    Returns the markdown content with proper headers and formatting.
    """
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Build the markdown content
    md_lines = []

    # Header
    md_lines.append(f"# {conversation.get('title', 'AI Council Conversation')}")
    md_lines.append("")
    md_lines.append(f"**Date:** {conversation.get('created_at', 'Unknown')[:10]}")
    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")

    # Process each message pair
    for msg in conversation.get("messages", []):
        if msg.get("role") == "user":
            md_lines.append("## Question")
            md_lines.append("")
            md_lines.append(msg.get("content", ""))
            md_lines.append("")

        elif msg.get("role") == "assistant":
            # Stage 3 - Final Answer (most important for knowledge base)
            stage3 = msg.get("stage3", {})
            if stage3:
                md_lines.append("## AI Council Answer")
                md_lines.append("")
                # Support both "response" and "content" field names
                md_lines.append(stage3.get("response") or stage3.get("content", ""))
                md_lines.append("")

            # Stage 1 - Individual Responses (collapsible for reference)
            stage1 = msg.get("stage1", [])
            if stage1:
                md_lines.append("### Individual Model Responses")
                md_lines.append("")
                md_lines.append("<details>")
                md_lines.append("<summary>Click to expand individual responses</summary>")
                md_lines.append("")
                for resp in stage1:
                    model_name = resp.get("model", "Unknown Model")
                    # Support both "response" and "content" field names
                    resp_content = resp.get("response") or resp.get("content", "")
                    md_lines.append(f"#### {model_name}")
                    md_lines.append("")
                    md_lines.append(resp_content)
                    md_lines.append("")
                md_lines.append("</details>")
                md_lines.append("")

            # Stage 2 - Rankings (summary only)
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

    # Footer
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


# Curator endpoints
class CurateRequest(BaseModel):
    """Request to analyze a conversation for knowledge updates."""
    business_id: str
    department_id: Optional[str] = None


class ApplySuggestionRequest(BaseModel):
    """Request to apply a curator suggestion."""
    business_id: str
    suggestion: Dict[str, Any]


@app.post("/api/conversations/{conversation_id}/curate")
async def curate_conversation(conversation_id: str, request: CurateRequest, user: dict = Depends(get_current_user)):
    """
    Analyze a conversation and suggest updates to the business context (must be owner).
    Returns a list of suggestions with section info, current text, and proposed updates.
    """
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await curator.analyze_conversation_for_updates(
        conversation=conversation,
        business_id=request.business_id,
        department_id=request.department_id
    )

    return result


@app.post("/api/context/apply-suggestion")
async def apply_context_suggestion(request: ApplySuggestionRequest):
    """
    Apply an accepted suggestion to the business context file.
    Updates the specified section and refreshes the 'Last Updated' date.
    """
    result = curator.apply_suggestion(
        business_id=request.business_id,
        suggestion=request.suggestion
    )

    if not result.get('success'):
        raise HTTPException(status_code=400, detail=result.get('message', 'Failed to apply suggestion'))

    return result


@app.get("/api/context/{business_id}/section/{section_name}")
async def get_context_section(business_id: str, section_name: str, department: Optional[str] = None):
    """Get the full content of a specific section in the business context.

    Args:
        business_id: The business folder name
        section_name: The section heading to find
        department: Optional department ID to look in department-specific context
    """
    content = curator.get_section_content(business_id, section_name, department)
    if content is None:
        # Return empty content instead of 404 - this is expected for new sections
        return {"section": section_name, "content": "", "exists": False}
    return {"section": section_name, "content": content, "exists": True}


class SaveCuratorRunRequest(BaseModel):
    """Request to record a curator run."""
    business_id: str
    suggestions_count: int
    accepted_count: int
    rejected_count: int


@app.post("/api/conversations/{conversation_id}/curator-history")
async def save_curator_run(conversation_id: str, request: SaveCuratorRunRequest, user: dict = Depends(get_current_user)):
    """
    Record that the curator was run on this conversation (must be owner).
    Stores when it was run and the results.
    """
    access_token = user.get("access_token")
    conversation = storage.get_conversation(conversation_id, access_token=access_token)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify ownership
    if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    storage.save_curator_run(
        conversation_id=conversation_id,
        business_id=request.business_id,
        suggestions_count=request.suggestions_count,
        accepted_count=request.accepted_count,
        rejected_count=request.rejected_count,
        access_token=access_token
    )

    return {"success": True}


@app.get("/api/conversations/{conversation_id}/curator-history")
async def get_curator_history(conversation_id: str, user: dict = Depends(get_current_user)):
    """
    Get curator run history for a conversation (must be owner).
    Returns list of previous curator runs with timestamps and results.
    """
    try:
        access_token = user.get("access_token")
        conversation = storage.get_conversation(conversation_id, access_token=access_token)
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

        # Verify ownership
        if conversation.get("user_id") and conversation.get("user_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        history = storage.get_curator_history(conversation_id, access_token=access_token)
        return {"history": history or []}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[CURATOR ERROR] get_curator_history failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/context/{business_id}/last-updated")
async def get_context_last_updated(business_id: str):
    """
    Get the last updated date from a business context file.
    Used for smart curator history comparison.
    """
    content = curator.get_section_content(business_id, "")
    if content is None:
        # Try loading the full context
        context_file = curator.CONTEXTS_DIR / business_id / "context.md"
        if not context_file.exists():
            raise HTTPException(status_code=404, detail="Business context not found")
        content = context_file.read_text(encoding='utf-8')

    last_updated = curator.extract_last_updated(content)
    return {"last_updated": last_updated}


# Org sync endpoints
@app.post("/api/businesses/{business_id}/sync-org")
async def sync_org_structure(business_id: str):
    """
    Manually trigger org structure sync from config.json to context.md.
    This regenerates the auto-generated Organization Structure section.
    """
    result = org_sync.sync_org_structure_to_context(business_id)

    if not result.get('success'):
        raise HTTPException(status_code=400, detail=result.get('message', 'Sync failed'))

    return result


class AddRoleRequest(BaseModel):
    """Request to add a new role to a department."""
    role_id: str
    role_name: str
    role_description: str = ""


@app.post("/api/businesses/{business_id}/departments/{department_id}/roles")
async def add_role_to_department(business_id: str, department_id: str, request: AddRoleRequest):
    """
    Add a new role to a department and sync org structure to context.md.
    """
    result = org_sync.add_role_to_department(
        business_id=business_id,
        department_id=department_id,
        role_id=request.role_id,
        role_name=request.role_name,
        role_description=request.role_description
    )

    if not result.get('success'):
        raise HTTPException(status_code=400, detail=result.get('message', 'Failed to add role'))

    return result


# ============================================
# ORGANIZATION MANAGEMENT ENDPOINTS
# ============================================

class UpdateDepartmentRequest(BaseModel):
    """Request to update department info."""
    name: Optional[str] = None
    description: Optional[str] = None


class UpdateRoleRequest(BaseModel):
    """Request to update role info."""
    name: Optional[str] = None
    description: Optional[str] = None


@app.put("/api/businesses/{business_id}/departments/{department_id}")
async def update_department(business_id: str, department_id: str, request: UpdateDepartmentRequest):
    """
    Update a department's name and/or description in config.json and sync to context.md.
    """
    result = org_sync.update_department(
        business_id=business_id,
        department_id=department_id,
        name=request.name,
        description=request.description
    )

    if not result.get('success'):
        raise HTTPException(status_code=400, detail=result.get('message', 'Failed to update department'))

    return result


@app.put("/api/businesses/{business_id}/departments/{department_id}/roles/{role_id}")
async def update_role(business_id: str, department_id: str, role_id: str, request: UpdateRoleRequest):
    """
    Update a role's name and/or description in config.json and sync to context.md.
    """
    result = org_sync.update_role(
        business_id=business_id,
        department_id=department_id,
        role_id=role_id,
        name=request.name,
        description=request.description
    )

    if not result.get('success'):
        raise HTTPException(status_code=400, detail=result.get('message', 'Failed to update role'))

    return result


@app.get("/api/businesses/{business_id}/departments/{department_id}/roles/{role_id}/context")
async def get_role_context(business_id: str, department_id: str, role_id: str):
    """
    Get the system prompt/context for a specific role.
    Returns the content of the role's .md file if it exists.
    """
    from .context_loader import load_role_context

    context = load_role_context(business_id, department_id, role_id)

    return {
        "context": context,
        "exists": context is not None,
        "path": f"councils/organisations/{business_id}/departments/{department_id}/roles/{role_id}.md"
    }


# ============================================
# PROJECTS API
# ============================================

class ProjectCreate(BaseModel):
    """Request to create a new project."""
    name: str
    description: Optional[str] = None
    context_md: Optional[str] = None


class PolishTextRequest(BaseModel):
    """Request to polish/rewrite text using AI."""
    text: str
    field_type: str  # e.g., "client_background", "goals", "constraints", "additional"


@app.get("/api/companies/{company_id}/projects")
async def list_projects(company_id: str, user: dict = Depends(get_current_user)):
    """List all active projects for a company."""
    access_token = user.get("access_token")
    try:
        projects = storage.get_projects(company_id, access_token)
        return {"projects": projects}
    except Exception as e:
        # Log error but return empty list to not break the app
        # Projects feature is new and may have DB/RLS issues
        print(f"[ERROR] Failed to list projects: {e}", flush=True)
        return {"projects": []}


@app.post("/api/companies/{company_id}/projects")
async def create_project(
    company_id: str,
    project: ProjectCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new project."""
    access_token = user.get("access_token")
    user_id = user.get("id")

    try:
        result = storage.create_project(
            company_id_or_slug=company_id,
            user_id=user_id,
            name=project.name,
            description=project.description,
            context_md=project.context_md,
            access_token=access_token
        )

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create project - no result returned")

        return {"project": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to create project: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    """Get a single project."""
    access_token = user.get("access_token")
    project = storage.get_project(project_id, access_token)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return {"project": project}


@app.post("/api/utils/polish-text")
async def polish_text(request: PolishTextRequest, user: dict = Depends(get_current_user)):
    """
    Use AI to polish/rewrite user-provided text for clarity and structure.
    Used to help users write better project context without knowing markdown.
    """
    from .openrouter import query_model

    # Field-specific prompts for better context
    field_prompts = {
        "client_background": "This text describes a client or project. Rewrite it clearly, organizing information about the company, industry, size, and key people.",
        "goals": "This text describes goals and objectives. Rewrite it as clear, actionable bullet points or short paragraphs.",
        "constraints": "This text describes constraints and requirements. Rewrite it clearly, organizing budget, timeline, technical, and other constraints.",
        "additional": "This is additional context for an AI advisor. Rewrite it clearly and concisely."
    }

    field_context = field_prompts.get(request.field_type, "Rewrite this text clearly and concisely.")

    prompt = f"""You are a helpful writing assistant. The user has written some rough notes and wants you to polish them into clear, well-structured text.

{field_context}

IMPORTANT:
- Keep the same information - don't add or invent details
- Make it clear and easy to read
- Use bullet points if there are multiple items
- Keep it concise but complete
- Don't use markdown headers (##) - just plain text and bullet points
- Output ONLY the polished text, nothing else

User's rough text:
{request.text}

Polished version:"""

    try:
        # Build messages list in the format query_model expects
        messages = [
            {"role": "system", "content": "You are a helpful writing assistant that polishes rough notes into clear, well-structured text."},
            {"role": "user", "content": prompt}
        ]

        result = await query_model(
            model="anthropic/claude-3.5-haiku",  # Fast model for quick polish
            messages=messages
        )

        if result and result.get('content'):
            return {"polished": result['content'].strip()}
        else:
            raise HTTPException(status_code=500, detail="Failed to get AI response")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI polish failed: {str(e)}")


# Billing endpoints
class CheckoutRequest(BaseModel):
    """Request to create a checkout session."""
    tier_id: str
    success_url: str
    cancel_url: str


class BillingPortalRequest(BaseModel):
    """Request to create a billing portal session."""
    return_url: str


@app.get("/api/billing/plans")
async def get_billing_plans():
    """Get available subscription plans."""
    return billing.get_available_plans()


@app.get("/api/billing/subscription")
async def get_subscription(user: dict = Depends(get_current_user)):
    """Get current user's subscription status."""
    return billing.get_user_subscription(user["id"], access_token=user.get("access_token"))


@app.get("/api/billing/can-query")
async def check_can_query(user: dict = Depends(get_current_user)):
    """Check if user can make a council query."""
    return billing.check_can_query(user["id"], access_token=user.get("access_token"))


@app.post("/api/billing/checkout")
async def create_checkout(request: CheckoutRequest, user: dict = Depends(get_current_user)):
    """Create a Stripe Checkout session for subscription."""
    try:
        result = billing.create_checkout_session(
            user_id=user["id"],
            email=user["email"],
            tier_id=request.tier_id,
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            access_token=user.get("access_token")
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")


@app.post("/api/billing/portal")
async def create_billing_portal(request: BillingPortalRequest, user: dict = Depends(get_current_user)):
    """Create a Stripe Billing Portal session for managing subscription."""
    try:
        result = billing.create_billing_portal_session(
            user_id=user["id"],
            email=user["email"],
            return_url=request.return_url,
            access_token=user.get("access_token")
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create portal: {str(e)}")


@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    result = billing.handle_webhook_event(payload, sig_header)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Webhook failed"))

    return {"received": True}


# Profile endpoints
class ProfileUpdateRequest(BaseModel):
    """Request to update user profile."""
    display_name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None


@app.get("/api/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    """Get current user's profile."""
    try:
        print(f"[PROFILE] Getting profile for user: {user['id']}", flush=True)
        profile = storage.get_user_profile(user["id"], user.get("access_token"))
        print(f"[PROFILE] Got profile: {profile}", flush=True)
        return profile or {
            "display_name": "",
            "company": "",
            "phone": "",
            "bio": "",
        }
    except Exception as e:
        print(f"[PROFILE ERROR] get_profile failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/profile")
async def update_profile(request: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    """Update current user's profile."""
    try:
        print(f"[PROFILE] Updating profile for user: {user['id']}", flush=True)
        profile_data = {
            "display_name": request.display_name,
            "company": request.company,
            "phone": request.phone,
            "bio": request.bio,
        }
        print(f"[PROFILE] Profile data: {profile_data}", flush=True)
        result = storage.update_user_profile(user["id"], profile_data, user.get("access_token"))
        print(f"[PROFILE] Update result: {result}", flush=True)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to update profile - storage returned None")
        return {"success": True, "profile": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PROFILE ERROR] update_profile failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ATTACHMENTS ENDPOINTS
# ============================================

@app.post("/api/attachments/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None),
    message_index: Optional[int] = Form(None),
    user: dict = Depends(get_current_user),
):
    """
    Upload an image attachment.

    The image is stored in Supabase Storage and a record is created
    in the attachments table. Returns a signed URL for immediate display.

    Args:
        file: The image file to upload
        conversation_id: Optional conversation ID to link to
        message_index: Optional message index within the conversation

    Returns:
        Attachment metadata including signed URL
    """
    try:
        # Read file content
        file_data = await file.read()

        # Upload to storage
        result = await attachments.upload_attachment(
            user_id=user["id"],
            access_token=user.get("access_token"),
            file_data=file_data,
            file_name=file.filename or "image.png",
            file_type=file.content_type or "image/png",
            conversation_id=conversation_id,
            message_index=message_index,
        )

        return result

    except ValueError as e:
        print(f"[ATTACHMENTS ERROR] upload ValueError: {e}", flush=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[ATTACHMENTS ERROR] upload failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/attachments/{attachment_id}")
async def get_attachment(
    attachment_id: str,
    user: dict = Depends(get_current_user),
):
    """Get attachment metadata and a fresh signed URL."""
    try:
        result = await attachments.get_attachment_data(
            user_id=user["id"],
            access_token=user.get("access_token"),
            attachment_id=attachment_id,
        )

        if not result:
            raise HTTPException(status_code=404, detail="Attachment not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ATTACHMENTS ERROR] get failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/attachments/{attachment_id}/url")
async def get_attachment_url(
    attachment_id: str,
    user: dict = Depends(get_current_user),
):
    """Get a fresh signed URL for an attachment."""
    try:
        url = await attachments.get_attachment_url(
            user_id=user["id"],
            access_token=user.get("access_token"),
            attachment_id=attachment_id,
        )

        if not url:
            raise HTTPException(status_code=404, detail="Attachment not found")

        return {"signed_url": url}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ATTACHMENTS ERROR] get_url failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/attachments/{attachment_id}")
async def delete_attachment(
    attachment_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete an attachment."""
    try:
        success = await attachments.delete_attachment(
            user_id=user["id"],
            access_token=user.get("access_token"),
            attachment_id=attachment_id,
        )

        if not success:
            raise HTTPException(status_code=404, detail="Attachment not found")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ATTACHMENTS ERROR] delete failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


# Mock mode endpoints
class MockModeRequest(BaseModel):
    """Request to toggle mock mode."""
    enabled: bool


@app.get("/api/settings/mock-mode")
async def get_mock_mode():
    """Get current mock mode status."""
    from . import openrouter
    # Return the runtime value from openrouter (the actual flag being used)
    return {
        "enabled": openrouter.MOCK_LLM,
        "scenario": config.MOCK_LLM_SCENARIO
    }


@app.post("/api/settings/mock-mode")
async def set_mock_mode(request: MockModeRequest):
    """
    Toggle mock mode on/off at runtime.
    Note: This changes the in-memory setting only.
    For persistent changes, update MOCK_LLM in .env and restart.
    """
    import importlib
    from . import openrouter

    # Update the config module
    config.MOCK_LLM = request.enabled

    # Reload the openrouter module to pick up the change
    # This ensures the mock intercepts are properly set
    if request.enabled:
        # Import mock functions if enabling
        try:
            from .mock_llm import generate_mock_response, generate_mock_response_stream
            openrouter.MOCK_LLM = True
            openrouter.generate_mock_response = generate_mock_response
            openrouter.generate_mock_response_stream = generate_mock_response_stream
            print("[MOCK] Mock mode ENABLED via API", flush=True)
        except ImportError as e:
            return {"success": False, "error": f"Failed to load mock module: {e}"}
    else:
        openrouter.MOCK_LLM = False
        print("[MOCK] Mock mode DISABLED via API", flush=True)

    return {
        "success": True,
        "enabled": openrouter.MOCK_LLM,
        "message": f"Mock mode {'enabled' if request.enabled else 'disabled'}"
    }


# ============================================
# Knowledge Base Endpoints
# ============================================

@app.post("/api/knowledge")
async def create_knowledge_entry(
    request: CreateKnowledgeRequest,
    user: dict = Depends(get_current_user)
):
    """Create a new knowledge entry."""
    try:
        access_token = user.get("access_token")

        # Resolve company_id if it's a slug (e.g., "axcouncil" -> UUID)
        company_uuid = storage.resolve_company_id(request.company_id, access_token)

        result = knowledge.create_knowledge_entry(
            user_id=user["id"],
            company_id=company_uuid,
            title=request.title,
            summary=request.summary,
            category=request.category,
            department_id=request.department_id,
            role_id=request.role_id,
            project_id=request.project_id,
            source_conversation_id=request.source_conversation_id,
            access_token=access_token,
            # Structured decision fields
            problem_statement=request.problem_statement,
            decision_text=request.decision_text,
            reasoning=request.reasoning,
            status=request.status,
            # Framework/SOP fields
            body_md=request.body_md,
            version=request.version
        )
        if result:
            return result
        raise HTTPException(status_code=500, detail="Failed to create knowledge entry")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[KNOWLEDGE ERROR] create failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/knowledge/{company_id}")
async def get_knowledge_entries(
    company_id: str,
    department_id: Optional[str] = None,
    project_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = Query("active"),  # Default to active entries
    search: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get knowledge entries for a company with filtering options."""
    try:
        access_token = user.get("access_token")

        # Resolve company_id if it's a slug
        company_uuid = storage.resolve_company_id(company_id, access_token)

        entries = knowledge.get_knowledge_entries(
            company_id=company_uuid,
            department_id=department_id,
            project_id=project_id,
            category=category,
            status=status,
            search=search,
            limit=limit,
            access_token=access_token
        )
        return {"entries": entries}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[KNOWLEDGE ERROR] get failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/conversations/{conversation_id}/knowledge-count")
async def get_knowledge_count_for_conversation(
    conversation_id: str,
    company_id: str,
    user: dict = Depends(get_current_user)
):
    """Get count of knowledge entries saved from a specific conversation."""
    try:
        access_token = user.get("access_token")
        # Resolve company_id if it's a slug
        company_uuid = storage.resolve_company_id(company_id, access_token)

        count = knowledge.get_knowledge_count_for_conversation(
            conversation_id=conversation_id,
            company_id=company_uuid
        )
        return {"count": count}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[KNOWLEDGE ERROR] get count failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/knowledge/{entry_id}")
async def update_knowledge_entry(
    entry_id: str,
    request: UpdateKnowledgeRequest,
    user: dict = Depends(get_current_user)
):
    """Update a knowledge entry."""
    try:
        result = knowledge.update_knowledge_entry(
            entry_id=entry_id,
            user_id=user["id"],
            updates=request.model_dump(exclude_unset=True),
            access_token=user.get("access_token")
        )
        if result:
            return result
        raise HTTPException(status_code=404, detail="Entry not found or access denied")
    except Exception as e:
        print(f"[KNOWLEDGE ERROR] update failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/knowledge/{entry_id}")
async def delete_knowledge_entry(
    entry_id: str,
    user: dict = Depends(get_current_user)
):
    """Soft delete a knowledge entry."""
    try:
        success = knowledge.deactivate_knowledge_entry(
            entry_id=entry_id,
            user_id=user["id"],
            access_token=user.get("access_token")
        )
        if success:
            return {"success": True}
        raise HTTPException(status_code=404, detail="Entry not found")
    except Exception as e:
        print(f"[KNOWLEDGE ERROR] delete failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


class ExtractDecisionRequest(BaseModel):
    """Request to extract decision from council response."""
    user_question: str
    council_response: str  # The Stage 3 chairman synthesis


@app.post("/api/knowledge/extract")
async def extract_decision_from_response(
    request: ExtractDecisionRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to extract the key decision/recommendation from a council response.
    Returns structured data: title, problem_statement, decision_text, reasoning, category, department.

    IMPORTANT: Always returns clean, readable data - either from AI or fallback.
    The fallback sanitizes text to remove code/SQL that shouldn't appear in user-facing content.
    """
    from .openrouter import query_model, MOCK_LLM
    from .knowledge_fallback import extract_knowledge_fallback

    # Handle mock mode - return a reasonable mock extraction
    if MOCK_LLM:
        print("[MOCK] Returning mock knowledge extraction response", flush=True)
        return {
            "success": True,
            "extracted": {
                "title": "Persistent Context Storage Implementation",
                "problem_statement": "The team needed a reliable way to store AI context and decisions across multiple sessions.\n\n• Previous conversations were lost after each session\n• No way to reference past decisions or guidelines\n• New team members had no access to institutional knowledge",
                "decision_text": "Implement a Supabase-based context storage system:\n\n• Create a dedicated knowledge_entries table for storing decisions\n• Each entry includes title, problem statement, reasoning, and metadata\n• Integrate with existing authentication for secure access\n• Support filtering by department and category for easy retrieval",
                "reasoning": "Why Supabase was chosen:\n\n• Already handles authentication - no new systems needed\n• Provides real-time sync capabilities\n• Structured tables allow easy querying and filtering\n• Scales well as knowledge base grows",
                "category": "technical_decision",
                "department": "technology",
                "used_ai": True
            }
        }

    # Create a focused prompt for decision extraction
    # CRITICAL: Only use clean user content, truncated to prevent prompt bloat
    user_question = request.user_question[:3000] if request.user_question else ""
    council_response = request.council_response[:5000] if request.council_response else ""

    extraction_prompt = f"""Extract and REWRITE the key decision into SHORT, CLEAN business language.

QUESTION: {user_question}

RESPONSE: {council_response}

---

EXTRACT these 7 fields (keep each field SHORT and CLEAN):

1. CONTEXT_SUMMARY: A clean 1-2 sentence summary of what was asked. Write it like a professional brief.
   - NO bullet points, just flowing prose
   - Max 100 words
   - Example: "The team sought guidance on implementing persistent storage for AI council decisions, with constraints around using the existing React/FastAPI/Supabase stack and avoiding manual file editing."

2. TITLE: 5-8 words describing the DECISION (not the question)

3. PROBLEM_STATEMENT: What problem was being solved? (2-4 bullet points)
   Example: "• Users couldn't find past decisions\\n• No central knowledge repository"

4. DECISION_TEXT: What was decided? The actual recommendation. (2-4 bullet points)
   Example: "• Create a Knowledge Base page\\n• Store decisions in Supabase\\n• Add search and filters"

5. REASONING: Why this approach? (2-3 bullet points)
   Example: "• Fits existing tech stack\\n• Easy to maintain"

6. CATEGORY: ONE of: technical_decision, ux_pattern, feature, policy, process, general

7. DEPARTMENT: ONE of: technology, ux, marketing, operations, strategy, finance, hr, general

RESPOND WITH JSON ONLY:
{{
  "context_summary": "Clean 1-2 sentence summary of the question...",
  "title": "Short Decision Title",
  "problem_statement": "• Point 1\\n• Point 2",
  "decision_text": "• Decision 1\\n• Decision 2",
  "reasoning": "• Reason 1\\n• Reason 2",
  "category": "category_id",
  "department": "department_id"
}}

RULES:
- REWRITE in your own words - do NOT copy text verbatim from the response
- context_summary should be professional prose, NOT bullet points
- Other fields: 50-150 characters max, use bullet points (•)
- NO markdown headers (##), NO asterisks (*), NO code
- Focus on the ACTIONABLE decision, not meta-discussion about rankings
- CRITICAL: decision_text and reasoning MUST be DIFFERENT content
  - decision_text = WHAT to do (the action/recommendation)
  - reasoning = WHY to do it (the justification/benefits)
  - If there's no clear reasoning, leave reasoning as empty string ""
- NEVER copy the same content to multiple fields"""

    try:
        messages = [
            {"role": "system", "content": "You are a business analyst extracting key decisions from council discussions. Always respond with valid JSON. Never include code or technical syntax in your output."},
            {"role": "user", "content": extraction_prompt}
        ]

        result = await query_model(
            model="anthropic/claude-3-5-haiku-20241022",  # Fast, good at structured extraction
            messages=messages
        )

        if result and result.get('content'):
            # Parse the JSON response
            content = result['content'].strip()
            # Handle potential markdown code blocks
            if content.startswith('```'):
                content = content.split('\n', 1)[1]  # Remove first line
                if content.endswith('```'):
                    content = content[:-3]
                elif '```' in content:
                    content = content.split('```')[0]
            content = content.strip()

            import json
            try:
                extracted = json.loads(content)
                extracted["used_ai"] = True
                return {
                    "success": True,
                    "extracted": extracted
                }
            except json.JSONDecodeError as e:
                print(f"[EXTRACT] JSON parse error, using fallback: {e}", flush=True)
                # AI returned invalid JSON - use fallback
                fallback = extract_knowledge_fallback(request.user_question, request.council_response)
                return {
                    "success": True,
                    "extracted": fallback
                }
        else:
            # No response from AI - use fallback
            print("[EXTRACT] No AI response, using fallback", flush=True)
            fallback = extract_knowledge_fallback(request.user_question, request.council_response)
            return {
                "success": True,
                "extracted": fallback
            }

    except Exception as e:
        # AI failed (rate limit, network error, etc.) - use fallback
        print(f"[EXTRACT] AI failed ({type(e).__name__}: {e}), using fallback", flush=True)
        fallback = extract_knowledge_fallback(request.user_question, request.council_response)
        return {
            "success": True,
            "extracted": fallback
        }


class ExtractProjectRequest(BaseModel):
    """Request to extract project details from council response."""
    user_question: str
    council_response: str


@app.post("/api/projects/extract")
async def extract_project_from_response(
    request: ExtractProjectRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to extract a clear project name and description from a council response.
    Designed to be understandable by anyone - like onboarding documentation.
    A new hire should be able to read the project and understand what it's about.

    IMPORTANT: Always returns clean, readable data - either from AI or fallback.
    """
    print(f"[PROJECT EXTRACT] Called with question: {request.user_question[:100]}...", flush=True)
    from .openrouter import query_model, MOCK_LLM
    from .knowledge_fallback import extract_project_fallback

    # Handle mock mode
    if MOCK_LLM:
        print("[MOCK] Returning mock project extraction", flush=True)
        return {
            "success": True,
            "extracted": {
                "name": "Context Memory System",
                "description": "A system to help AI assistants remember important decisions and context across conversations.\n\nKey Goals:\n• Store decisions and guidelines persistently\n• Surface relevant context in future discussions\n• Help new team members access institutional knowledge\n\nThis ensures consistency across all AI-assisted conversations.",
                "used_ai": True
            }
        }

    # Truncate inputs to prevent prompt bloat
    user_question = request.user_question[:3000] if request.user_question else ""
    council_response = request.council_response[:5000] if request.council_response else ""

    # Create a prompt focused on generating clear, accessible project details
    extraction_prompt = f"""You are creating project documentation that needs to be understood by ANYONE in the company - including new hires on their first day, executives who aren't technical, and team members from completely different departments.

CONTEXT: A council of AI advisors just had a discussion. Based on this discussion, we need to create a new project. Extract a clear project name and description.

ORIGINAL QUESTION THAT STARTED THE DISCUSSION:
{user_question}

COUNCIL'S RESPONSE:
{council_response}

---

Create project details that answer these questions for someone who knows NOTHING about this:
- What is this project? (the name should be clear and professional)
- Why does this project exist? What problem is it solving?
- What is the goal or outcome?

REQUIREMENTS:
1. PROJECT NAME: 2-5 words, clear and professional. Should make sense standalone without context.
   - BAD: "Context Updates" (too vague)
   - BAD: "CTO Council Question Response" (that's not a project name)
   - GOOD: "AI Context Memory System"
   - GOOD: "Customer Onboarding Automation"

2. DESCRIPTION: Start with 1-2 sentences explaining what this is, then use bullet points for key goals.
   Format it like this:
   "A system to help [who] do [what].

   Key Goals:
   • Goal or benefit 1
   • Goal or benefit 2
   • Goal or benefit 3

   This ensures [outcome/benefit]."

Respond in this exact JSON format:
{{
  "name": "Clear Project Name",
  "description": "A clear explanation sentence.\\n\\nKey Goals:\\n• Goal 1\\n• Goal 2\\n• Goal 3\\n\\nFinal sentence about outcome."
}}

CRITICAL:
- Use bullet points (•) to make goals easy to scan
- Use \\n\\n between sections and \\n between bullets
- A non-technical person must understand it
- NEVER include code, SQL, or technical syntax"""

    try:
        messages = [
            {"role": "system", "content": "You are a technical writer creating project documentation. Your goal is clarity and accessibility - write so anyone can understand. Always respond with valid JSON. Never include code or technical syntax."},
            {"role": "user", "content": extraction_prompt}
        ]

        result = await query_model(
            model="anthropic/claude-3-5-haiku-20241022",
            messages=messages
        )

        if result and result.get('content'):
            content = result['content'].strip()
            # Handle markdown code blocks
            if content.startswith('```'):
                content = content.split('\n', 1)[1]
                if content.endswith('```'):
                    content = content[:-3]
                elif '```' in content:
                    content = content.split('```')[0]
            content = content.strip()

            import json
            try:
                extracted = json.loads(content)
                extracted["used_ai"] = True
                return {
                    "success": True,
                    "extracted": extracted
                }
            except json.JSONDecodeError as e:
                print(f"[PROJECT EXTRACT] JSON parse error, using fallback: {e}", flush=True)
                # AI returned invalid JSON - use fallback
                fallback = extract_project_fallback(request.user_question, request.council_response)
                return {
                    "success": True,
                    "extracted": fallback
                }
        else:
            # No response from AI - use fallback
            print("[PROJECT EXTRACT] No AI response, using fallback", flush=True)
            fallback = extract_project_fallback(request.user_question, request.council_response)
            return {
                "success": True,
                "extracted": fallback
            }

    except Exception as e:
        # AI failed (rate limit, network error, etc.) - use fallback
        print(f"[PROJECT EXTRACT] AI failed ({type(e).__name__}: {e}), using fallback", flush=True)
        fallback = extract_project_fallback(request.user_question, request.council_response)
        return {
            "success": True,
            "extracted": fallback
        }


@app.get("/api/projects/{project_id}/report")
async def get_project_report(
    project_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Generate a professional report of all decisions made for a project.
    Returns structured data that can be rendered as HTML/PDF.
    Client-friendly - no mention of AI Council or internal tooling.
    """
    try:
        access_token = user.get("access_token")

        # Get project details
        project = storage.get_project(project_id, access_token)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        project_name = project.get('name', 'Untitled Project')
        company_id = project.get('company_id')

        if not company_id:
            raise HTTPException(status_code=400, detail="Project has no company association")

        report = knowledge.generate_project_report(
            project_id=project_id,
            project_name=project_name,
            company_id=company_id
        )

        return report
    except HTTPException:
        raise
    except Exception as e:
        print(f"[REPORT ERROR] generate failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
