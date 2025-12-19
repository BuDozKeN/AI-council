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
import re
import logging

# =============================================================================
# SECURITY: Rate limiting
# =============================================================================
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

try:
    from .security import SecureHTTPException, log_security_event, get_client_ip
except ImportError:
    from security import SecureHTTPException, log_security_event, get_client_ip


def get_user_identifier(request: Request) -> str:
    """
    Get rate limit key from authenticated user ID or fall back to IP address.
    This ensures rate limits are per-user for authenticated requests.
    """
    # Try to get user ID from authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Use a hash of the token as identifier (more privacy-preserving)
        import hashlib
        token_hash = hashlib.sha256(auth_header[7:].encode()).hexdigest()[:16]
        return f"user:{token_hash}"
    # Fall back to IP address for unauthenticated requests
    return get_remote_address(request)


limiter = Limiter(key_func=get_user_identifier)


# =============================================================================
# SECURITY: Input validation for path parameters
# =============================================================================
# Prevent path traversal and injection attacks by validating IDs
SAFE_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')

def validate_safe_id(value: str, field_name: str = "id") -> str:
    """
    Validate that an ID only contains safe characters (alphanumeric, underscore, hyphen).
    Prevents path traversal attacks like '../../../etc/passwd'.
    """
    if not value or not SAFE_ID_PATTERN.match(value):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}: must contain only letters, numbers, underscores, and hyphens"
        )
    return value

try:
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
    from . import model_registry
    from .routers import company as company_router
except ImportError:
    import storage
    from council import run_full_council, generate_conversation_title, stage1_collect_responses, stage1_stream_responses, stage2_collect_rankings, stage2_stream_rankings, stage3_synthesize_final, stage3_stream_synthesis, calculate_aggregate_rankings, chat_stream_response
    from context_loader import list_available_businesses, load_business_context
    from auth import get_current_user
    import leaderboard
    import triage
    import curator
    import org_sync
    import config
    import billing
    import attachments
    import image_analyzer
    import knowledge
    import model_registry
    from routers import company as company_router

app = FastAPI(title="LLM Council API")

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS origins list
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:5178",
    "http://localhost:5179",
    "http://localhost:5180",
    "http://localhost:5181",
    "http://localhost:5182",
    "http://localhost:3000",
    "https://ai-council-three.vercel.app",
]

# =============================================================================
# SECURITY: Request size limit middleware
# =============================================================================
MAX_REQUEST_SIZE = 15 * 1024 * 1024  # 15MB max (slightly above 10MB file limit)


# =============================================================================
# SECURITY: Security headers middleware
# =============================================================================
from starlette.middleware.base import BaseHTTPMiddleware


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests that exceed the size limit to prevent DoS attacks."""

    async def dispatch(self, request, call_next):
        # Check Content-Length header if present
        content_length = request.headers.get("content-length")
        if content_length:
            if int(content_length) > MAX_REQUEST_SIZE:
                log_security_event(
                    "OVERSIZED_REQUEST",
                    ip_address=get_client_ip(request),
                    details={"size": content_length, "limit": MAX_REQUEST_SIZE},
                    severity="WARNING"
                )
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request too large"}
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)

        # Prevent clickjacking - deny embedding in iframes
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Enable browser XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Content Security Policy
        # - Allow self for default, scripts, styles
        # - Allow data: and https: for images (Supabase storage)
        # - Allow connections to self, Supabase, and OpenRouter
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openrouter.ai; "
            "font-src 'self' data:; "
            "frame-ancestors 'none';"
        )

        # Referrer policy - send origin only for cross-origin requests
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy - disable unnecessary browser features
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )

        return response


# Enable CORS - added first so it's innermost (processed last on response)
# Use explicit allowlist for security (not wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,  # Use explicit allowlist, not "*"
    allow_credentials=True,  # Safe with explicit origins
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # Allow frontend to read filename header
)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add request size limit middleware - outermost, checks before processing
app.add_middleware(RequestSizeLimitMiddleware)

# Exception handler to ensure CORS headers on error responses
@app.exception_handler(HTTPException)
async def cors_exception_handler(request: Request, exc: HTTPException):
    from fastapi.responses import JSONResponse
    origin = request.headers.get("origin", "")
    headers = {}
    # Only allow origins from explicit allowlist (no wildcard patterns)
    if origin in CORS_ORIGINS:
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


async def _auto_synthesize_project_context(project_id: str, user: dict) -> bool:
    """
    Background task: Automatically regenerate project context when a decision is saved.
    Synthesizes ALL decisions into a clean context document.

    This runs in the background so the save response returns immediately.
    Uses the single 'sarah' persona for consistent output.
    """
    from .openrouter import query_model, MOCK_LLM
    from .database import get_supabase_service
    from .personas import get_db_persona_with_fallback
    from datetime import datetime
    import json

    print(f"[AUTO-SYNTH] Background task started for project {project_id}", flush=True)

    try:
        service_client = get_supabase_service()
        if not service_client:
            print("[AUTO-SYNTH] No service client available", flush=True)
            return False

        # Get project details
        project_result = service_client.table("projects").select("*").eq("id", project_id).single().execute()
        if not project_result.data:
            print(f"[AUTO-SYNTH] Project not found: {project_id}", flush=True)
            return False

        project = project_result.data

        # Get ALL decisions for this project
        decisions_result = service_client.table("knowledge_entries") \
            .select("id, title, body_md, summary, created_at, department_id") \
            .eq("project_id", project_id) \
            .eq("is_active", True) \
            .order("created_at", desc=False) \
            .execute()

        decisions = decisions_result.data or []

        if not decisions:
            print(f"[AUTO-SYNTH] No decisions for project {project_id}", flush=True)
            return False

        print(f"[AUTO-SYNTH] Found {len(decisions)} decisions to synthesize", flush=True)

        # Handle mock mode
        if MOCK_LLM:
            print("[AUTO-SYNTH] MOCK mode - creating simple context", flush=True)
            mock_context = f"# {project.get('name', 'Project')}\n\n{project.get('description', '')}\n\n## Key Decisions\n\nAuto-synthesized from {len(decisions)} decisions."
            service_client.table("projects").update({
                "context_md": mock_context,
                "updated_at": datetime.now().isoformat()
            }).eq("id", project_id).execute()
            return True

        # Get the ONE Sarah persona from database
        persona = await get_db_persona_with_fallback('sarah')
        system_prompt = persona.get('system_prompt', '')
        models = persona.get('model_preferences', ['google/gemini-2.0-flash-001', 'openai/gpt-4o'])
        if isinstance(models, str):
            models = json.loads(models)

        # Build decisions summary for LLM
        decisions_summary = ""
        for i, d in enumerate(decisions, 1):
            date_str = d.get("created_at", "")[:10] if d.get("created_at") else "Unknown date"
            title = d.get("title", "Untitled")
            content = d.get("summary") or (d.get("body_md", "")[:1000] + "..." if len(d.get("body_md", "")) > 1000 else d.get("body_md", ""))
            decisions_summary += f"\n### Decision {i}: {title} ({date_str})\n{content}\n"

        today_date = datetime.now().strftime("%B %d, %Y")

        # Task-specific user prompt (Sarah's personality comes from system_prompt)
        user_prompt = f"""Create a CLEAN, WELL-ORGANIZED project document.

## THE PROJECT
- Name: {project.get('name', 'Unknown Project')}
- Description: {project.get('description', 'No description')}

## ALL DECISIONS MADE FOR THIS PROJECT
{decisions_summary}

---

Create a single, clean project document that:
1. Starts with a clear project overview
2. Synthesizes ALL decisions into organized sections
3. ELIMINATES ALL DUPLICATES - if information appears in multiple decisions, include it ONCE
4. Uses clear, simple language
5. Includes a "Decision Log" section with dates

Return valid JSON:
{{
  "context_md": "The complete project documentation in markdown"
}}

Today's date: {today_date}"""

        messages = [
            {"role": "system", "content": system_prompt + "\n\nRespond only with valid JSON."},
            {"role": "user", "content": user_prompt}
        ]

        result_data = None
        for model in models:
            try:
                print(f"[AUTO-SYNTH] Trying model: {model}", flush=True)
                result = await query_model(model=model, messages=messages)

                if result and result.get('content'):
                    content = result['content']
                    # Clean up markdown code blocks
                    if content.startswith('```'):
                        content = content.split('```')[1]
                        if content.startswith('json'):
                            content = content[4:]
                    if '```' in content:
                        content = content.split('```')[0]
                    content = content.strip()

                    try:
                        result_data = json.loads(content)
                        print(f"[AUTO-SYNTH] Success with {model}", flush=True)
                        break
                    except json.JSONDecodeError as e:
                        print(f"[AUTO-SYNTH] JSON parse error from {model}: {e}", flush=True)
                        continue
            except Exception as e:
                print(f"[AUTO-SYNTH] {model} failed: {e}", flush=True)
                continue

        if result_data is None:
            print(f"[AUTO-SYNTH] All models failed", flush=True)
            return False

        new_context = result_data.get("context_md", "")

        # Update the project with new context
        service_client.table("projects").update({
            "context_md": new_context,
            "updated_at": datetime.now().isoformat()
        }).eq("id", project_id).execute()

        print(f"[AUTO-SYNTH] Updated project context with {len(decisions)} decisions", flush=True)
        return True

    except Exception as e:
        print(f"[AUTO-SYNTH] Background task failed: {e}", flush=True)
        return False


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint to verify deployment."""
    return {"status": "healthy", "version": "2025-12-09-v15-profile-debug"}

class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    company_id: Optional[str] = None  # Company ID to associate with this conversation


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str
    business_id: Optional[str] = None
    department: Optional[str] = "standard"  # Legacy: single department
    role: Optional[str] = None  # Legacy: single role ID for persona injection
    project_id: Optional[str] = None  # Project ID for project-specific context
    attachment_ids: Optional[List[str]] = None  # Optional list of attachment IDs (images to analyze)
    # Multi-select support (new)
    departments: Optional[List[str]] = None  # Multiple department UUIDs
    roles: Optional[List[str]] = None  # Multiple role UUIDs


class ChatRequest(BaseModel):
    """Request to send a chat message (Chairman only, no full council)."""
    content: str
    business_id: Optional[str] = None
    department_id: Optional[str] = None  # Legacy: single department
    project_id: Optional[str] = None  # Project ID for project-specific context
    # Multi-select support (new)
    department_ids: Optional[List[str]] = None  # Multiple department UUIDs
    role_ids: Optional[List[str]] = None  # Multiple role UUIDs


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
    source_message_id: Optional[str] = None   # Specific message ID for precise linking
    # Structured decision fields
    problem_statement: Optional[str] = None  # What problem/question led to this
    decision_text: Optional[str] = None       # The actual decision made
    reasoning: Optional[str] = None           # Why this decision was made
    status: str = "active"                    # active, superseded, archived
    # Framework/SOP support
    body_md: Optional[str] = None             # Long-form markdown content for SOPs/Frameworks
    version: str = "v1"                       # Version tracking (v1, v2, etc.)
    # Knowledge consolidation fields (new)
    auto_inject: bool = False                 # Auto-inject into future council context
    scope: str = "department"                 # Visibility: company, department, project
    tags: Optional[List[str]] = None          # Tags for categorization


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
    # Knowledge consolidation fields (new)
    auto_inject: Optional[bool] = None
    scope: Optional[str] = None  # company, department, project
    tags: Optional[List[str]] = None


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
async def get_businesses(user: dict = Depends(get_current_user)):
    """List all available business contexts. Requires authentication."""
    return list_available_businesses()


@app.get("/api/conversations")
async def list_conversations(
    user: dict = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    include_archived: bool = False,
    sort_by: str = "date",
    company_id: Optional[str] = None
):
    """
    List conversations for the authenticated user (metadata only).

    Args:
        sort_by: "date" (most recent first, default) or "activity" (most messages first)
        company_id: Optional company ID to filter conversations by

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
        include_archived=include_archived,
        sort_by=sort_by,
        company_id=company_id
    )
    elapsed = time.time() - start
    print(f"[PERF] list_conversations took {elapsed:.2f}s for {len(result['conversations'])} conversations (limit={limit}, offset={offset}, sort_by={sort_by})", flush=True)
    return result


@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(request: CreateConversationRequest, user: dict = Depends(get_current_user)):
    """Create a new conversation for the authenticated user."""
    conversation_id = str(uuid.uuid4())
    conversation = storage.create_conversation(
        conversation_id,
        user["id"],
        access_token=user.get("access_token"),
        company_id=request.company_id
    )
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
@limiter.limit("20/minute;100/hour")  # Rate limit: 20 council queries/min, 100/hour per user
async def send_message_stream(request: Request, conversation_id: str, body: SendMessageRequest, user: dict = Depends(get_current_user)):
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

    # NOTE: conversation_history is intentionally NOT built or passed to Stage 1.
    # Previous chairman synthesis responses contained "Chairman's Synthesis" language
    # that caused Stage 1 models to mimic the synthesis format instead of providing
    # independent responses. Each council query operates in isolation.

    async def event_generator():
        try:
            print(f"[STREAM] Starting event_generator for conversation {conversation_id}", flush=True)

            # Add user message with user_id
            storage.add_user_message(conversation_id, body.content, user_id, access_token=access_token)
            print(f"[STREAM] User message saved", flush=True)

            # Process image attachments if provided
            enhanced_query = body.content
            if body.attachment_ids:
                print(f"[STREAM] Processing {len(body.attachment_ids)} image attachments", flush=True)
                yield f"data: {json.dumps({'type': 'image_analysis_start', 'count': len(body.attachment_ids)})}\n\n"

                # Download all images
                images = []
                for attachment_id in body.attachment_ids:
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
                    image_analysis = await image_analyzer.analyze_images(images, body.content)
                    enhanced_query = image_analyzer.format_query_with_images(body.content, image_analysis)
                    print(f"[STREAM] Image analysis complete, query enhanced", flush=True)

                    # Send the image analysis to frontend so user can see what the council receives
                    yield f"data: {json.dumps({'type': 'image_analysis_complete', 'analyzed': len(images), 'analysis': image_analysis})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'image_analysis_complete', 'analyzed': 0})}\n\n"

            # Start title generation in parallel (don't await yet)
            title_task = None
            if is_first_message:
                title_task = asyncio.create_task(generate_conversation_title(body.content))

            # Resolve company UUID for knowledge base lookup
            company_uuid = None
            if body.business_id:
                try:
                    company_uuid = storage.resolve_company_id(body.business_id, access_token)
                    print(f"[STREAM] Resolved company_uuid: {company_uuid}", flush=True)
                except Exception as e:
                    print(f"[STREAM] Could not resolve company_uuid: {e}", flush=True)

            # Stage 1: Collect responses with streaming
            print(f"[STREAM] Emitting stage1_start", flush=True)
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = []
            print(f"[STREAM] Starting stage1_stream_responses", flush=True)
            # NOTE: Do NOT pass conversation_history to Stage 1!
            # Previous chairman synthesis responses contain "Chairman's Synthesis" language
            # that causes Stage 1 models to mimic the synthesis format instead of providing
            # independent responses. Each council query should be a clean slate.
            async for event in stage1_stream_responses(
                enhanced_query,  # Use enhanced query with image analysis
                business_id=body.business_id,
                department_id=body.department,
                role_id=body.role,
                conversation_history=None,  # Intentionally None - keep Stage 1 isolated
                project_id=body.project_id,
                access_token=access_token,
                company_uuid=company_uuid,
                department_ids=body.departments,  # Multi-select support
                role_ids=body.roles  # Multi-select support
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
            async for event in stage2_stream_rankings(enhanced_query, stage1_results, business_id=body.business_id):
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
                business_id=body.business_id,
                project_id=body.project_id,
                access_token=access_token,
                company_uuid=company_uuid,
                department_ids=body.departments,  # Multi-select support
                role_ids=body.roles  # Multi-select support
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

            # Record rankings to leaderboard
            if aggregate_rankings:
                leaderboard.record_session_rankings(
                    conversation_id=conversation_id,
                    department=body.department or "standard",
                    business_id=body.business_id,
                    aggregate_rankings=aggregate_rankings
                )

            # Log consultation activity (audit trail for all council consultations)
            if company_uuid:
                try:
                    # Use the generated title or truncate the question
                    consultation_title = title if title_task and title else (body.content[:80] + "..." if len(body.content) > 80 else body.content)
                    await company_router.log_activity(
                        company_id=company_uuid,
                        event_type="consultation",
                        title=f"Consulted: {consultation_title}",
                        description=None,  # Don't store full question in activity
                        department_id=body.department,
                        related_id=None,  # No related_id until saved as decision
                        related_type="conversation",
                        conversation_id=conversation_id
                    )
                except Exception as e:
                    print(f"[ACTIVITY] Failed to log consultation: {e}", flush=True)

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
@limiter.limit("60/minute;300/hour")  # Rate limit: 60 chat messages/min, 300/hour per user
async def chat_with_chairman(request: Request, conversation_id: str, body: ChatRequest, user: dict = Depends(get_current_user)):
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
                "content": body.content
            })

            # Also save the user message to storage with user_id
            storage.add_user_message(conversation_id, body.content, user_id, access_token=access_token)

            yield f"data: {json.dumps({'type': 'chat_start'})}\n\n"

            # Resolve company UUID for knowledge base lookup
            company_uuid = None
            if body.business_id:
                try:
                    company_uuid = storage.resolve_company_id(body.business_id, access_token)
                except Exception:
                    pass  # Non-critical, continue without knowledge

            # Stream response from chairman
            full_content = ""
            async for event in chat_stream_response(
                history,
                business_id=body.business_id,
                department_id=body.department_id,
                project_id=body.project_id,
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
async def get_context_section(business_id: str, section_name: str, department: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Get the full content of a specific section in the business context.
    Requires authentication.

    Args:
        business_id: The business folder name
        section_name: The section heading to find
        department: Optional department ID to look in department-specific context
    """
    # Validate path parameters to prevent traversal attacks
    validate_safe_id(business_id, "business_id")
    if department:
        validate_safe_id(department, "department")

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
        raise SecureHTTPException.internal_error(str(e))


@app.get("/api/context/{business_id}/last-updated")
async def get_context_last_updated(business_id: str, user: dict = Depends(get_current_user)):
    """
    Get the last updated date from a business context file.
    Used for smart curator history comparison.
    Requires authentication.
    """
    # Validate path parameters to prevent traversal attacks
    validate_safe_id(business_id, "business_id")

    content = curator.get_section_content(business_id, "")
    if content is None:
        # Try loading the full context
        context_file = curator.CONTEXTS_DIR / business_id / "context.md"
        if not context_file.exists():
            raise HTTPException(status_code=404, detail="Resource not found")
        content = context_file.read_text(encoding='utf-8')

    last_updated = curator.extract_last_updated(content)
    return {"last_updated": last_updated}


# ============================================
# PROJECTS API
# ============================================

class ProjectCreate(BaseModel):
    """Request to create a new project."""
    name: str
    description: Optional[str] = None
    context_md: Optional[str] = None
    department_id: Optional[str] = None  # Legacy: Assign to a single department
    department_ids: Optional[List[str]] = None  # New: Assign to multiple departments
    source_conversation_id: Optional[str] = None  # Track original conversation
    source: str = "manual"  # How project was created: 'manual', 'council', 'import'


class ProjectUpdate(BaseModel):
    """Request to update a project."""
    name: Optional[str] = None
    description: Optional[str] = None
    context_md: Optional[str] = None
    status: Optional[str] = None  # 'active', 'completed', 'archived'
    department_id: Optional[str] = None  # Legacy: Can reassign to different department
    department_ids: Optional[List[str]] = None  # New: Can reassign to multiple departments
    source_conversation_id: Optional[str] = None  # Track original conversation


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

    print(f"[CREATE_PROJECT_ENDPOINT] company_id={company_id}, user_id={user_id}, name={project.name}", flush=True)
    print(f"[CREATE_PROJECT_ENDPOINT] project data: name={project.name}, desc={project.description[:50] if project.description else None}, dept_ids={project.department_ids}, source={project.source}", flush=True)

    try:
        result = storage.create_project(
            company_id_or_slug=company_id,
            user_id=user_id,
            name=project.name,
            description=project.description,
            context_md=project.context_md,
            department_id=project.department_id,
            department_ids=project.department_ids,
            source_conversation_id=project.source_conversation_id,
            source=project.source,
            access_token=access_token
        )

        if not result:
            print(f"[CREATE_PROJECT_ENDPOINT] No result returned from storage.create_project", flush=True)
            raise HTTPException(status_code=500, detail="Failed to create project - no result returned")

        print(f"[CREATE_PROJECT_ENDPOINT] Success! project_id={result.get('id')}", flush=True)
        return {"project": result}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[CREATE_PROJECT_ENDPOINT] ERROR: {type(e).__name__}: {e}", flush=True)
        print(f"[CREATE_PROJECT_ENDPOINT] Traceback:\n{traceback.format_exc()}", flush=True)
        raise SecureHTTPException.internal_error(f"Failed to create project: {str(e)}")


## NOTE: create_project_from_decision endpoint is in backend/routers/company.py
## It uses Sarah persona to generate project context from decision content


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    """Get a single project."""
    access_token = user.get("access_token")
    project = storage.get_project(project_id, access_token)

    if not project:
        raise HTTPException(status_code=404, detail="Resource not found")

    return {"project": project}


@app.patch("/api/projects/{project_id}")
async def update_project(
    project_id: str,
    update: ProjectUpdate,
    user: dict = Depends(get_current_user)
):
    """Update a project's name, description, context, or status."""
    access_token = user.get("access_token")

    try:
        result = storage.update_project(
            project_id=project_id,
            access_token=access_token,
            name=update.name,
            description=update.description,
            context_md=update.context_md,
            status=update.status,
            department_id=update.department_id,
            department_ids=update.department_ids,
            source_conversation_id=update.source_conversation_id
        )

        if not result:
            raise HTTPException(status_code=404, detail="Resource not found")

        return {"project": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Failed to update project: {type(e).__name__}: {e}", flush=True)
        raise SecureHTTPException.internal_error(f"Failed to update project: {str(e)}")


@app.post("/api/projects/{project_id}/touch")
async def touch_project(project_id: str, user: dict = Depends(get_current_user)):
    """Update a project's last_accessed_at timestamp (called when project is selected in chat)."""
    access_token = user.get("access_token")
    success = storage.touch_project_last_accessed(project_id, access_token)
    return {"success": success}


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    """Delete a project permanently."""
    access_token = user.get("access_token")
    try:
        deleted_project = storage.delete_project(project_id, access_token)
        if not deleted_project:
            raise HTTPException(status_code=404, detail="Project not found or could not be deleted")

        # Log activity for deleted project
        if deleted_project.get("company_id"):
            await company_router.log_activity(
                company_id=deleted_project["company_id"],
                event_type="project",
                title=f"Deleted: {deleted_project.get('name', 'Project')}",
                description="Project was permanently deleted",
                related_id=project_id,
                related_type="project"
            )

        return {"success": True}
    except Exception as e:
        print(f"[ERROR] Failed to delete project: {type(e).__name__}: {e}", flush=True)
        raise SecureHTTPException.internal_error(f"Failed to delete project: {str(e)}")


@app.get("/api/companies/{company_id}/projects/stats")
async def list_projects_with_stats(
    company_id: str,
    status: Optional[str] = None,
    include_archived: bool = False,
    user: dict = Depends(get_current_user)
):
    """
    List projects with stats for the Projects Tab in Command Centre.

    Query params:
    - status: Filter by 'active', 'completed', or 'archived'
    - include_archived: If true, include archived projects (default: false)
    """
    access_token = user.get("access_token")
    try:
        projects = storage.get_projects_with_stats(
            company_id,
            access_token,
            status_filter=status,
            include_archived=include_archived
        )
        return {"projects": projects}
    except Exception as e:
        print(f"[ERROR] Failed to list projects with stats: {e}", flush=True)
        return {"projects": []}


@app.post("/api/utils/polish-text")
async def polish_text(request: PolishTextRequest, user: dict = Depends(get_current_user)):
    """
    Use AI to polish/rewrite user-provided text for clarity and structure.
    Used to help users write better project context without knowing markdown.
    """
    from .openrouter import query_model

    # Get AI polish model from registry
    polish_model = await model_registry.get_primary_model('ai_polish') or 'google/gemini-3-pro-preview'

    # Special handling for markdown conversion - comprehensive formatting
    if request.field_type == "markdown":
        prompt = f"""You are a markdown formatting expert. Convert the following text into clean, well-structured Markdown.

RULES:
1. Preserve ALL information - don't remove or summarize anything
2. Use proper Markdown syntax:
   - # for main title, ## for sections, ### for subsections
   - | col | col | for tables (with header separator |---|---|)
   - ```language for code blocks (detect language: javascript, css, python, etc.)
   - **bold** for emphasis
   - - for bullet lists
   - 1. for numbered lists
3. If you see tabular data (columns of values), convert to proper Markdown tables
4. If you see code (CSS properties, JavaScript, functions), wrap in code blocks
5. Detect numbered sections like "1. Title" and convert to ## headers
6. Output ONLY the formatted markdown, no explanations

TEXT TO CONVERT:
{request.text}

MARKDOWN:"""

        try:
            messages = [
                {"role": "system", "content": "You are a markdown formatting expert. Convert text to clean, properly structured Markdown."},
                {"role": "user", "content": prompt}
            ]

            result = await query_model(
                model=polish_model,
                messages=messages
            )

            if result and result.get('content'):
                return {"polished": result['content'].strip()}
            else:
                raise HTTPException(status_code=500, detail="Failed to get AI response")
        except Exception as e:
            raise SecureHTTPException.internal_error(f"AI polish failed: {str(e)}")

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
            model=polish_model,
            messages=messages
        )

        if result and result.get('content'):
            return {"polished": result['content'].strip()}
        else:
            raise HTTPException(status_code=500, detail="Failed to get AI response")
    except Exception as e:
        raise SecureHTTPException.internal_error(f"AI polish failed: {str(e)}")


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
        raise SecureHTTPException.internal_error(f"Failed to create checkout: {str(e)}")


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
        raise SecureHTTPException.internal_error(f"Failed to create portal: {str(e)}")


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
        raise SecureHTTPException.internal_error(str(e))


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
        raise SecureHTTPException.internal_error(str(e))


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
        raise SecureHTTPException.internal_error(str(e))


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
            raise HTTPException(status_code=404, detail="Resource not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ATTACHMENTS ERROR] get failed: {type(e).__name__}: {e}", flush=True)
        raise SecureHTTPException.internal_error(str(e))


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
            raise HTTPException(status_code=404, detail="Resource not found")

        return {"signed_url": url}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ATTACHMENTS ERROR] get_url failed: {type(e).__name__}: {e}", flush=True)
        raise SecureHTTPException.internal_error(str(e))


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
            raise HTTPException(status_code=404, detail="Resource not found")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ATTACHMENTS ERROR] delete failed: {type(e).__name__}: {e}", flush=True)
        raise SecureHTTPException.internal_error(str(e))


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


# Prompt caching endpoints
class CachingModeRequest(BaseModel):
    """Request to toggle prompt caching."""
    enabled: bool


@app.get("/api/settings/caching-mode")
async def get_caching_mode():
    """Get current prompt caching status."""
    from . import openrouter
    return {
        "enabled": config.ENABLE_PROMPT_CACHING,
        "supported_models": config.CACHE_SUPPORTED_MODELS
    }


@app.post("/api/settings/caching-mode")
async def set_caching_mode(request: CachingModeRequest):
    """
    Toggle prompt caching on/off at runtime.
    Note: This changes the in-memory setting only.
    For persistent changes, update ENABLE_PROMPT_CACHING in .env and restart.
    """
    from . import openrouter

    # Update the config module
    config.ENABLE_PROMPT_CACHING = request.enabled

    # Update openrouter module to use new setting
    # The convert_to_cached_messages function reads from config directly
    if request.enabled:
        print("[CACHE] Prompt caching ENABLED via API", flush=True)
    else:
        print("[CACHE] Prompt caching DISABLED via API", flush=True)

    return {
        "success": True,
        "enabled": config.ENABLE_PROMPT_CACHING,
        "message": f"Prompt caching {'enabled' if request.enabled else 'disabled'}"
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

        # Resolve department_id if it's a slug (e.g., "technology" -> UUID)
        department_uuid = storage.resolve_department_id(
            request.department_id,
            company_uuid,
            access_token
        )

        result = knowledge.create_knowledge_entry(
            user_id=user["id"],
            company_id=company_uuid,
            title=request.title,
            summary=request.summary,
            category=request.category,
            department_id=department_uuid,
            role_id=request.role_id,
            project_id=request.project_id,
            source_conversation_id=request.source_conversation_id,
            source_message_id=request.source_message_id,
            access_token=access_token,
            # Structured decision fields
            problem_statement=request.problem_statement,
            decision_text=request.decision_text,
            reasoning=request.reasoning,
            status=request.status,
            # Framework/SOP fields
            body_md=request.body_md,
            version=request.version,
            # Knowledge consolidation fields
            auto_inject=request.auto_inject,
            scope=request.scope,
            tags=request.tags
        )
        if result:
            # Log activity with conversation link so activity feed can navigate back
            await company_router.log_activity(
                company_id=company_uuid,
                event_type="decision",
                title=f"Saved: {request.title}",
                description=request.summary[:200] if request.summary else None,
                department_id=department_uuid,  # Use resolved UUID, not slug
                related_id=result.get("id"),
                related_type="decision",
                conversation_id=request.source_conversation_id
            )

            # Auto-regenerate project context if decision is linked to a project
            # Run in background so save returns immediately
            if request.project_id:
                import asyncio
                asyncio.create_task(
                    _auto_synthesize_project_context(request.project_id, user)
                )

            return result
        raise HTTPException(status_code=500, detail="Failed to create knowledge entry")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[KNOWLEDGE ERROR] create failed: {type(e).__name__}: {e}", flush=True)
        raise SecureHTTPException.internal_error(str(e))


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
        raise SecureHTTPException.internal_error(str(e))


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
        raise SecureHTTPException.internal_error(str(e))


@app.get("/api/conversations/{conversation_id}/linked-project")
async def get_conversation_linked_project(
    conversation_id: str,
    company_id: str = Query(..., description="Company ID or slug"),
    user: dict = Depends(get_current_user)
):
    """
    Check if a conversation has a linked project.
    Checks both:
    1. Projects created directly from this conversation (projects.source_conversation_id)
    2. Decisions from this conversation that are linked to a project (knowledge_entries.project_id)
    Returns the project info if found, or null if no project is linked.
    """
    try:
        from backend.storage import get_supabase_service
        service_client = get_supabase_service()
        access_token = user.get("access_token")

        # DEBUG: Check if service client exists
        print(f"[LINKED-PROJECT] Service client: {service_client is not None}", flush=True)
        if service_client is None:
            print("[LINKED-PROJECT] ERROR: Service client is None! SUPABASE_SERVICE_KEY may not be set.", flush=True)
            return {"project": None}

        # Resolve company_id if it's a slug
        company_uuid = storage.resolve_company_id(company_id, access_token)

        # DEBUG: logging to trace linked project lookup
        print(f"[LINKED-PROJECT] Looking for conversation_id={conversation_id}, company={company_uuid}", flush=True)

        # First, check if a project was created directly from this conversation
        project_result = service_client.table("projects") \
            .select("id, name, description, status, source_conversation_id") \
            .eq("company_id", company_uuid) \
            .eq("source_conversation_id", conversation_id) \
            .limit(1) \
            .execute()

        print(f"[LINKED-PROJECT] Projects query result: {project_result.data}", flush=True)

        if project_result.data and project_result.data[0]:
            print(f"[LINKED-PROJECT] Found project via source_conversation_id: {project_result.data[0]}", flush=True)
            return {"project": project_result.data[0]}

        # Second, check for knowledge entries from this conversation linked to a project
        ke_result = service_client.table("knowledge_entries") \
            .select("project_id") \
            .eq("company_id", company_uuid) \
            .eq("source_conversation_id", conversation_id) \
            .eq("is_active", True) \
            .not_.is_("project_id", "null") \
            .limit(1) \
            .execute()

        if not ke_result.data or not ke_result.data[0].get("project_id"):
            return {"project": None}

        project_id = ke_result.data[0]["project_id"]

        # Get project details
        project_result = service_client.table("projects") \
            .select("id, name, description, status") \
            .eq("id", project_id) \
            .single() \
            .execute()

        if not project_result.data:
            return {"project": None}

        return {"project": project_result.data}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[KNOWLEDGE ERROR] get linked project failed: {type(e).__name__}: {e}", flush=True)
        raise SecureHTTPException.internal_error(str(e))


@app.get("/api/conversations/{conversation_id}/decision")
async def get_conversation_decision(
    conversation_id: str,
    company_id: str = Query(..., description="Company ID or slug"),
    response_index: int = Query(..., description="Index of the response within the conversation"),
    user: dict = Depends(get_current_user)
):
    """
    Check if a specific decision exists for this conversation and response index.
    This allows tracking which Stage3 responses have already been saved.
    """
    try:
        from backend.storage import get_supabase_service
        service_client = get_supabase_service()
        access_token = user.get("access_token")

        if service_client is None:
            print("[CONV-DECISION] ERROR: Service client is None!", flush=True)
            return {"decision": None}

        # Resolve company_id if it's a slug
        try:
            company_uuid = storage.resolve_company_id(company_id, access_token)
        except Exception as resolve_err:
            print(f"[CONV-DECISION] Failed to resolve company_id: {resolve_err}", flush=True)
            return {"decision": None}

        print(f"[CONV-DECISION] Looking for conversation_id={conversation_id}, company={company_uuid}, response_index={response_index}", flush=True)

        # Find decision by conversation_id and response_index
        # Only select specific fields that we know exist to avoid column errors
        try:
            result = service_client.table("knowledge_entries") \
                .select("id, title, summary, project_id, department_id, created_at, response_index") \
                .eq("company_id", company_uuid) \
                .eq("source_conversation_id", conversation_id) \
                .eq("response_index", response_index) \
                .eq("is_active", True) \
                .limit(1) \
                .execute()
        except Exception as query_err:
            print(f"[CONV-DECISION] Query failed: {type(query_err).__name__}: {query_err}", flush=True)
            return {"decision": None}

        if result.data and result.data[0]:
            print(f"[CONV-DECISION] Found decision with response_index={response_index}: {result.data[0]['id']}", flush=True)
            return {"decision": result.data[0]}

        # Legacy fallback: For the first assistant message (index 1), also check for decisions
        # saved before response_index was added (they have NULL response_index)
        if response_index == 1:
            try:
                legacy_result = service_client.table("knowledge_entries") \
                    .select("id, title, summary, project_id, department_id, created_at, response_index") \
                    .eq("company_id", company_uuid) \
                    .eq("source_conversation_id", conversation_id) \
                    .is_("response_index", "null") \
                    .eq("is_active", True) \
                    .order("created_at", desc=False) \
                    .limit(1) \
                    .execute()

                if legacy_result.data and legacy_result.data[0]:
                    print(f"[CONV-DECISION] Found legacy decision (no response_index): {legacy_result.data[0]['id']}", flush=True)
                    return {"decision": legacy_result.data[0]}
            except Exception as legacy_err:
                print(f"[CONV-DECISION] Legacy query failed: {legacy_err}", flush=True)

        return {"decision": None}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[CONV-DECISION ERROR] failed: {type(e).__name__}: {e}", flush=True)
        raise SecureHTTPException.internal_error(str(e))


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
        raise SecureHTTPException.internal_error(str(e))


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
        raise HTTPException(status_code=404, detail="Resource not found")
    except Exception as e:
        print(f"[KNOWLEDGE ERROR] delete failed: {type(e).__name__}: {e}", flush=True)
        raise SecureHTTPException.internal_error(str(e))


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

    # Get decision summarizer model from registry
    summarizer_model = await model_registry.get_primary_model('decision_summarizer') or 'anthropic/claude-3-5-haiku-20241022'

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
            model=summarizer_model,
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
    from .personas import get_db_persona_with_fallback

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

    # Get the project manager persona from database
    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')

    # Truncate inputs to prevent prompt bloat
    user_question = request.user_question[:3000] if request.user_question else ""
    council_response = request.council_response[:5000] if request.council_response else ""

    # Task-specific user prompt (persona's style comes from system_prompt)
    extraction_prompt = f"""## TASK: Extract project name and description from a council discussion

Your goal: Create a project name and description that ANYONE can understand at a glance.
Think: "If my non-technical mom saw this in a list, would she understand what it's about?"

THE USER'S ORIGINAL QUESTION:
{user_question}

THE COUNCIL'S ADVICE (for context only):
{council_response}

---

YOUR TASK: Extract the CORE TOPIC and create useful project documentation that can guide future discussions.

PROJECT NAME RULES (CRITICAL):
- 2-5 words maximum
- Must describe the SUBJECT/TOPIC, not the question format
- Must make sense standing alone without any context
- Think: "What project folder would this go into?"

EXAMPLES OF WHAT THE USER ASKED → WHAT THE PROJECT NAME SHOULD BE:
- "How do we keep users engaged while waiting?" → "User Wait Experience"
- "What's the best way to handle authentication?" → "Authentication System"
- "Should we use Redis or Postgres for caching?" → "Caching Architecture"
- "How can we improve our onboarding flow?" → "Customer Onboarding"
- "What metrics should we track for engagement?" → "Engagement Analytics"

❌ NEVER USE:
- "Must align with..." (this is a quote from the response, not a name)
- "How to..." or "What to..." (these are questions, not names)
- "Council Discussion" or "AI Response" (too generic)
- Words from the middle of a sentence

DESCRIPTION RULES:
- First sentence: One clear statement of what this project addresses
- Then 2-3 bullet points with key considerations
- Keep it scannable - a busy executive should get it in 5 seconds

CONTEXT_MD RULES (IMPORTANT - this is injected into future council sessions):
- Create structured markdown that provides useful context for future discussions
- Include: Background, Key Decisions Made, Guidelines to Follow
- Format with headers (##) and bullet points
- This is NOT a summary - it's operational guidance for future AI sessions
- Think: "What would help an AI advisor give consistent, aligned advice on this project?"

Respond ONLY with this JSON (no markdown code blocks, just the JSON):
{{
  "name": "Clear Topic Name",
  "description": "Brief description for project list.",
  "context_md": "## Background\\nOne paragraph explaining the project.\\n\\n## Key Decisions\\n- Decision 1\\n- Decision 2\\n\\n## Guidelines\\n- Guideline 1\\n- Guideline 2"
}}"""

    # Use model preferences from persona
    import json as json_module
    model_prefs = persona.get('model_preferences', ['anthropic/claude-3-5-haiku-20241022'])
    if isinstance(model_prefs, str):
        model_prefs = json_module.loads(model_prefs)

    try:
        messages = [
            {"role": "system", "content": system_prompt + "\n\nRespond ONLY with valid JSON - no markdown, no explanation, just the JSON object."},
            {"role": "user", "content": extraction_prompt}
        ]

        result = await query_model(
            model=model_prefs[0],
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


class StructureContextRequest(BaseModel):
    """Request to structure free-form project description."""
    free_text: str
    project_name: str = ""


@app.post("/api/projects/structure-context")
async def structure_project_context(
    request: StructureContextRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to structure a free-form project description into organized context.
    Takes messy user input and creates clean, professional project documentation.
    Uses Sarah (Project Manager persona) from database with model fallbacks.
    """
    from .openrouter import MOCK_LLM
    from .personas import get_db_persona_with_fallback

    # Handle mock mode
    if MOCK_LLM:
        print("[MOCK] Returning mock structure context", flush=True)
        from .knowledge_fallback import _short_title
        mock_title = request.project_name or _short_title(request.free_text, max_words=4)
        return {
            "structured": {
                "context_md": f"Objective\n{request.free_text[:300]}\n\nGoals\n- Define clear metrics\n- Track progress",
                "description": request.free_text[:150],
                "suggested_name": mock_title
            }
        }

    project_name = request.project_name.strip() if request.project_name else ""
    free_text = request.free_text[:5000] if request.free_text else ""

    # Get Sarah persona from database (with hardcoded fallback)
    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')
    models = persona.get('model_preferences', ['openai/gpt-4o', 'google/gemini-2.0-flash-001'])

    # Parse models if stored as JSON string
    import json
    if isinstance(models, str):
        models = json.loads(models)

    prompt = f"""Create a project brief from this description:

"{free_text}"

Return JSON with these exact fields:

{{
  "suggested_name": "Clear Project Title (3-5 words, e.g. 'Stripe Revenue Dashboard' or 'Customer Onboarding Flow')",
  "description": "One sentence describing what this project delivers",
  "context_md": "Well-formatted markdown brief with sections below"
}}

For context_md, use clean markdown formatting. Use these sections (skip any that don't apply):

## Objective
One sentence: what we're building and why.

## Deliverables
- Bullet list of concrete outputs

## Success Criteria
- How we know it's done/working

## Scope
What's included. What's explicitly NOT included.

## Technical Notes
Only if the user mentioned technical requirements.

FORMATTING RULES:
- Use ## for section headers
- Use - for bullet points
- Keep it clean and readable

CONTENT RULES:
- Extract from what they said. Don't invent requirements.
- Project name must be specific (e.g. "Stripe Revenue Dashboard" not "Dashboard" or "User")
- Be concise. Each section 2-4 bullet points max.
- Skip sections the user didn't mention anything about."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]

    # Try each model in order (from persona preferences)
    from .openrouter import query_model
    last_error = None

    for model in models:
        try:
            print(f"[STRUCTURE] Trying model: {model}", flush=True)
            result = await query_model(model=model, messages=messages)

            if result and result.get('content'):
                content = result['content']
                # Clean up markdown code blocks if present
                if content.startswith('```'):
                    content = content.split('```')[1]
                    if content.startswith('json'):
                        content = content[4:]
                if '```' in content:
                    content = content.split('```')[0]
                content = content.strip()

                try:
                    structured = json.loads(content)
                    # Ensure we have a good title
                    if not structured.get('suggested_name') or structured.get('suggested_name') == 'New Project':
                        from .knowledge_fallback import _short_title
                        structured['suggested_name'] = _short_title(free_text, max_words=4)
                    print(f"[STRUCTURE] Success with {model}", flush=True)
                    return {"structured": structured}
                except json.JSONDecodeError as e:
                    last_error = f"JSON parse error from {model}: {e}"
                    print(f"[STRUCTURE] {last_error}", flush=True)
                    continue
            else:
                last_error = f"No response from {model}"
                print(f"[STRUCTURE] {last_error}", flush=True)
                continue
        except Exception as e:
            last_error = f"{model} failed: {type(e).__name__}: {e}"
            print(f"[STRUCTURE] {last_error}", flush=True)
            continue

    # All models failed - use fallback
    print(f"[STRUCTURE] All models failed. Last error: {last_error}", flush=True)
    from .knowledge_fallback import _short_title
    fallback_title = project_name or _short_title(free_text, max_words=4)
    return {
        "structured": {
            "context_md": f"## Overview\n\n{free_text[:300]}",
            "description": free_text[:150],
            "suggested_name": fallback_title
        }
    }


class MergeDecisionRequest(BaseModel):
    """Request to merge a decision into project context."""
    existing_context: str
    decision_content: str
    user_question: str = ""
    # Optional fields for also saving the decision to knowledge_entries (audit trail)
    save_decision: bool = False
    company_id: str = None
    conversation_id: str = None
    response_index: int = None
    decision_title: str = None
    department_id: str = None  # Primary department (backwards compat)
    department_ids: List[str] = None  # All selected departments
    council_type: str = None  # e.g., "CTO Council", "Legal", "Board"


@app.post("/api/projects/{project_id}/merge-decision")
async def merge_decision_into_project(
    project_id: str,
    request: MergeDecisionRequest,
    user: dict = Depends(get_current_user)
):
    """
    Use AI to intelligently merge a council decision into existing project context.
    Uses the 'sarah' persona from the database for consistent documentation style.
    Does NOT replace - it merges and updates.
    """
    from .openrouter import query_model, MOCK_LLM
    from .personas import get_db_persona_with_fallback

    # Handle mock mode
    if MOCK_LLM:
        print("[MOCK] Returning mock merge result", flush=True)
        return {
            "merged": {
                "context_md": request.existing_context + "\n\n## Recent Decision\nKey learning from council discussion.",
                "summary": "Added insights from recent council decision",
                "changes": "- Added new section on Recent Decision"
            }
        }

    # Get the project manager persona from database
    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')

    # Increase limits for better context handling
    existing = request.existing_context[:10000] if request.existing_context else ""
    decision = request.decision_content[:8000] if request.decision_content else ""
    question = request.user_question[:2000] if request.user_question else ""

    from datetime import datetime
    today_date = datetime.now().strftime("%B %d, %Y")

    # Task-specific user prompt (persona's style comes from system_prompt)
    user_prompt = f"""## TASK: Merge a council decision into project documentation

## CURRENT PROJECT DOCUMENTATION:
{existing if existing else "(This is a new project with no existing documentation)"}

---

## THE QUESTION THAT WAS ASKED:
{question if question else "(No specific question recorded)"}

## NEW COUNCIL DECISION TO INCORPORATE:
{decision}

---

## YOUR INSTRUCTIONS:

1. **READ** the existing documentation carefully
2. **EXTRACT** only the KEY POINTS from the council decision:
   - What was decided?
   - Why was it decided?
   - What actions need to happen?
   - Any deadlines or constraints?
3. **MERGE** these into the existing document:
   - Keep all existing sections that are still relevant
   - Add a "## Decision Log" section if one doesn't exist
   - Add this decision with today's date: {today_date}
   - If information conflicts with existing docs, UPDATE the old info and note the change
   - NEVER lose existing important information
   - ALWAYS deduplicate - if the same decision appears multiple times, consolidate into one

## OUTPUT FORMAT:

Return valid JSON with exactly these fields:
{{
  "context_md": "The complete updated project documentation in markdown format",
  "summary": "A single sentence describing what was decided (e.g., 'Approved the Q2 marketing budget of $50k focused on digital channels')",
  "changes": "Bullet list of what you added or changed (e.g., '- Added Decision Log section\\n- Updated budget from TBD to $50k')"
}}

Remember: The context_md should be a complete, standalone document. Respond only with valid JSON."""

    # Use model preferences from persona, with fallback timeouts
    import json as json_module
    model_prefs = persona.get('model_preferences', ['google/gemini-2.0-flash-001', 'openai/gpt-4o'])
    if isinstance(model_prefs, str):
        model_prefs = json_module.loads(model_prefs)

    # Add timeouts: first model gets more time, fallbacks get less
    MERGE_MODELS = [(model_prefs[0], 45.0)] + [(m, 30.0) for m in model_prefs[1:3]]

    messages = [
        {"role": "system", "content": system_prompt + "\n\nRespond only with valid JSON."},
        {"role": "user", "content": user_prompt}
    ]

    merged = None
    last_error = None

    for model, timeout in MERGE_MODELS:
        try:
            print(f"[MERGE] Trying model: {model} (timeout: {timeout}s)", flush=True)
            result = await query_model(model=model, messages=messages, timeout=timeout)

            if result and result.get('content'):
                content = result['content']
                # Clean up markdown code blocks if present - more robust extraction
                # Try to extract JSON from markdown code block first
                json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
                if json_match:
                    content = json_match.group(1).strip()
                else:
                    # No code block - try to find JSON object directly
                    json_obj_match = re.search(r'\{[\s\S]*\}', content)
                    if json_obj_match:
                        content = json_obj_match.group(0)
                    else:
                        content = content.strip()

                import json
                try:
                    merged = json.loads(content)
                    print(f"[MERGE] Success with {model}", flush=True)
                    break  # Success! Exit the loop
                except json.JSONDecodeError as e:
                    last_error = f"JSON parse error from {model}: {e}"
                    print(f"[MERGE] {last_error}. Content preview: {content[:200]}...", flush=True)
                    continue  # Try next model
            else:
                last_error = f"No response from {model}"
                print(f"[MERGE] {last_error}", flush=True)
                continue  # Try next model

        except Exception as e:
            last_error = f"{model} failed: {type(e).__name__}: {e}"
            print(f"[MERGE] {last_error}", flush=True)
            continue  # Try next model

    # If all models failed, use minimal fallback (don't append garbage)
    if merged is None:
        print(f"[MERGE] All models failed. Last error: {last_error}", flush=True)
        # Instead of appending duplicate content, just return the existing context unchanged
        # with an error message so the user knows to retry
        merged = {
            "context_md": existing,  # Keep existing content unchanged
            "summary": "⚠️ AI merge failed - please try again",
            "changes": f"- Merge failed after trying {len(MERGE_MODELS)} models. Original context preserved.",
            "error": True
        }

    # After successfully generating the merged content, optionally save the decision
    saved_decision_id = None
    if request.save_decision and request.company_id:
        try:
            access_token = user.get("access_token")
            user_id = user.get('id')
            print(f"[MERGE] user_id={user_id}, has_access_token={bool(access_token)}", flush=True)
            if not user_id:
                print(f"[MERGE] WARNING: user_id is None! User object: {user}", flush=True)
            if access_token:
                from .database import get_supabase_with_auth
                client = get_supabase_with_auth(access_token)

                # Resolve company_id to UUID (it might be a slug)
                from .routers.company import resolve_company_id
                try:
                    company_uuid = resolve_company_id(client, request.company_id)
                    print(f"[MERGE] Resolved company_id '{request.company_id}' to UUID: {company_uuid}", flush=True)
                except Exception as resolve_err:
                    print(f"[MERGE] Failed to resolve company_id: {resolve_err}", flush=True)
                    company_uuid = request.company_id  # Fall back to original value

                # Build title for the decision
                decision_title = request.decision_title
                if not decision_title:
                    if question:
                        decision_title = f"Decision: {question[:50]}..." if len(question) > 50 else f"Decision: {question}"
                    else:
                        decision_title = "Council Decision"

                # Create the decision record in knowledge_entries
                # Use department_ids if provided, otherwise fall back to single department_id
                print(f"[MERGE] Received department_id={request.department_id}, department_ids={request.department_ids}", flush=True)
                dept_ids = request.department_ids if request.department_ids else (
                    [request.department_id] if request.department_id and request.department_id != "all" else []
                )
                primary_dept_id = dept_ids[0] if dept_ids else None
                print(f"[MERGE] Resolved dept_ids={dept_ids}, primary_dept_id={primary_dept_id}", flush=True)

                insert_data = {
                    "company_id": company_uuid,  # Use resolved UUID, not potentially slug
                    "title": decision_title,
                    "body_md": request.decision_content,  # Full council response (stored in body_md column)
                    "summary": question[:500] if question else "Council decision",  # Required field - will be replaced by AI summary
                    # Don't set decision_summary - let it be generated on-demand with proper AI summary
                    "scope": "project",  # Always project scope when merging into a project
                    "department_id": primary_dept_id,  # Primary department for backwards compat
                    "department_ids": dept_ids if dept_ids else None,  # All departments
                    "project_id": project_id,
                    "source_conversation_id": request.conversation_id if request.conversation_id and not request.conversation_id.startswith("temp-") else None,
                    "response_index": request.response_index,
                    "auto_inject": False,
                    "user_question": question,
                    "category": "technical_decision",
                    "is_active": True,
                    "created_by": user_id,
                    "tags": []
                }
                print(f"[MERGE] Saving decision with project_id={project_id}, company_uuid={company_uuid}, departments={dept_ids}, created_by={user_id}", flush=True)

                try:
                    result = client.table("knowledge_entries").insert(insert_data).execute()
                    if result.data and len(result.data) > 0:
                        saved_decision_id = result.data[0].get("id")
                        print(f"[MERGE] SUCCESS! Saved decision to knowledge_entries: {saved_decision_id}", flush=True)

                        # Generate summary immediately at save time (not on-demand)
                        # This avoids burning tokens every time the user views the decision
                        try:
                            from .routers.company import generate_decision_summary_internal
                            print(f"[MERGE] Generating summary for decision: {saved_decision_id}, company_uuid: {company_uuid}", flush=True)
                            summary_result = await generate_decision_summary_internal(
                                saved_decision_id,
                                company_uuid  # Use resolved UUID
                            )
                            print(f"[MERGE] Summary result: {summary_result}", flush=True)
                            if summary_result.get('title'):
                                print(f"[MERGE] Summary generated - title: {summary_result.get('title')[:50]}...", flush=True)
                            else:
                                print(f"[MERGE] WARNING: No title in summary result!", flush=True)
                        except Exception as summary_err:
                            import traceback
                            print(f"[MERGE] Failed to generate summary (non-fatal): {summary_err}", flush=True)
                            print(f"[MERGE] Traceback: {traceback.format_exc()}", flush=True)
                            # Don't fail the merge just because summary generation failed
                    else:
                        print(f"[MERGE] WARNING: Insert returned no data. Result: {result}", flush=True)
                except Exception as insert_err:
                    import traceback
                    print(f"[MERGE] ERROR inserting decision: {insert_err}", flush=True)
                    print(f"[MERGE] Insert traceback: {traceback.format_exc()}", flush=True)
                    # Don't re-raise - let the merge succeed even if saving fails

                # Sync ALL decision departments to project's department_ids
                if dept_ids:
                    try:
                        # Get current project department_ids
                        project_result = client.table("projects").select("department_ids").eq("id", project_id).single().execute()
                        if project_result.data:
                            current_dept_ids = set(project_result.data.get("department_ids") or [])
                            new_dept_ids = set(dept_ids)
                            # Add any departments from decision that aren't already in project
                            if not new_dept_ids.issubset(current_dept_ids):
                                updated_dept_ids = list(current_dept_ids | new_dept_ids)
                                client.table("projects").update({"department_ids": updated_dept_ids}).eq("id", project_id).execute()
                                added = new_dept_ids - current_dept_ids
                                print(f"[MERGE] Added departments {added} to project {project_id}", flush=True)
                    except Exception as dept_err:
                        print(f"[MERGE] Failed to sync departments to project (non-fatal): {dept_err}", flush=True)

        except Exception as save_err:
            print(f"[MERGE] Failed to save decision (non-fatal): {save_err}", flush=True)
            # Don't fail the merge just because saving failed

    response = {"merged": merged}
    if saved_decision_id:
        response["saved_decision_id"] = saved_decision_id

    return response


@app.post("/api/projects/{project_id}/regenerate-context")
async def regenerate_project_context(
    project_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Regenerate project context by synthesizing ALL decisions associated with this project.
    Uses the single 'sarah' persona for consistent output.

    This is useful when:
    - Project context has accumulated duplicates
    - Previous merges failed and appended garbage
    - User wants a fresh synthesis of all decisions
    """
    from .openrouter import query_model, MOCK_LLM
    from .database import get_supabase_service
    from .personas import get_db_persona_with_fallback
    from datetime import datetime
    import json

    print(f"[REGEN] Starting regenerate-context for project {project_id}", flush=True)

    access_token = user.get("access_token")
    if not access_token:
        print(f"[REGEN] No access token", flush=True)
        raise HTTPException(status_code=401, detail="Authentication required")

    # Get project details - use service client to bypass RLS issues
    service_client = get_supabase_service()

    print(f"[REGEN] Fetching project {project_id}", flush=True)
    project_result = service_client.table("projects").select("*").eq("id", project_id).single().execute()
    if not project_result.data:
        print(f"[REGEN] Project not found: {project_id}", flush=True)
        raise HTTPException(status_code=404, detail="Resource not found")

    project = project_result.data
    print(f"[REGEN] Got project: {project.get('name')}", flush=True)

    # Get ALL decisions for this project (use service client to bypass RLS on knowledge_entries)
    print(f"[REGEN] About to query decisions...", flush=True)
    decisions_result = service_client.table("knowledge_entries") \
        .select("id, title, body_md, summary, user_question, decision_summary, created_at, department_id") \
        .eq("project_id", project_id) \
        .eq("is_active", True) \
        .order("created_at", desc=False) \
        .execute()

    decisions = decisions_result.data or []
    existing_context = project.get("context_md", "")

    print(f"[REGEN] Found {len(decisions)} decisions for project", flush=True)
    print(f"[REGEN] Existing context length: {len(existing_context) if existing_context else 0} chars", flush=True)

    # If no decisions AND no existing context, nothing to enhance
    if not decisions and not existing_context:
        return {
            "success": True,
            "context_md": "",
            "message": "No decisions or context to enhance",
            "decision_count": 0
        }

    # Handle mock mode
    if MOCK_LLM:
        print("[MOCK] Returning mock regenerated context", flush=True)
        if decisions:
            mock_context = f"# {project.get('name', 'Project')}\n\n{project.get('description', '')}\n\n## Key Decisions\n\nRegenerated from {len(decisions)} decisions."
        else:
            mock_context = f"# {project.get('name', 'Project')}\n\n{project.get('description', '')}\n\n## Enhanced Context\n\n{existing_context}"
        return {
            "success": True,
            "context_md": mock_context,
            "message": f"[MOCK] {'Regenerated from ' + str(len(decisions)) + ' decisions' if decisions else 'Enhanced existing context'}",
            "decision_count": len(decisions)
        }

    # Get the ONE Sarah persona from database
    persona = await get_db_persona_with_fallback('sarah')
    system_prompt = persona.get('system_prompt', '')
    models = persona.get('model_preferences', ['google/gemini-2.0-flash-001', 'openai/gpt-4o'])
    if isinstance(models, str):
        models = json.loads(models)

    # Build a summary of all decisions for the LLM
    decisions_summary = ""
    for i, d in enumerate(decisions, 1):
        date_str = d.get("created_at", "")[:10] if d.get("created_at") else "Unknown date"
        title = d.get("title", "Untitled")
        user_question = d.get("user_question", "")
        # Use summary (full council response) if available, otherwise truncate body_md
        content = d.get("summary") or (d.get("body_md", "")[:2000] + "..." if len(d.get("body_md", "")) > 2000 else d.get("body_md", ""))

        decisions_summary += f"\n### Decision {i}: {title} ({date_str})\n"
        if user_question:
            decisions_summary += f"**Question asked:** {user_question}\n\n"
        decisions_summary += f"{content}\n"

    today_date = datetime.now().strftime("%B %d, %Y")

    # Task-specific user prompt (same as auto-synth for consistency)
    # Sarah's personality comes from system_prompt
    if decisions:
        user_prompt = f"""Create a CLEAN, WELL-ORGANIZED project document.

## THE PROJECT
- Name: {project.get('name', 'Unknown Project')}
- Description: {project.get('description', 'No description')}

## ALL DECISIONS MADE FOR THIS PROJECT
{decisions_summary}

---

Create a single, clean project document that:
1. Starts with a clear project overview
2. Synthesizes ALL decisions into organized sections
3. ELIMINATES ALL DUPLICATES - if information appears in multiple decisions, include it ONCE
4. Uses clear, simple language
5. Includes a "Decision Log" section with dates

Return valid JSON:
{{
  "context_md": "The complete project documentation in markdown",
  "sections_count": <number of main sections>,
  "decisions_incorporated": <number of decisions you incorporated>
}}

Today's date: {today_date}"""
    else:
        # No decisions - enhance/structure existing context
        user_prompt = f"""ENHANCE and STRUCTURE this existing project documentation.

## THE PROJECT
- Name: {project.get('name', 'Unknown Project')}
- Description: {project.get('description', 'No description')}

## EXISTING PROJECT CONTEXT (user-provided)
{existing_context}

---

Create a CLEAN, WELL-ORGANIZED project document that:
1. Starts with a clear project overview
2. Organizes the information into logical sections
3. Improves clarity and readability
4. Preserves ALL the original information
5. Adds helpful structure (headers, bullet points, etc.)

Return valid JSON:
{{
  "context_md": "The enhanced project documentation in markdown",
  "sections_count": <number of main sections>,
  "decisions_incorporated": 0
}}

Today's date: {today_date}"""

    messages = [
        {"role": "system", "content": system_prompt + "\n\nRespond only with valid JSON."},
        {"role": "user", "content": user_prompt}
    ]

    result_data = None
    last_error = None

    for model in models:
        try:
            print(f"[REGEN] Trying model: {model}", flush=True)
            result = await query_model(model=model, messages=messages)

            if result and result.get('content'):
                content = result['content']
                # Clean up markdown code blocks
                if content.startswith('```'):
                    content = content.split('```')[1]
                    if content.startswith('json'):
                        content = content[4:]
                if '```' in content:
                    content = content.split('```')[0]
                content = content.strip()

                try:
                    result_data = json.loads(content)
                    print(f"[REGEN] Success with {model}", flush=True)
                    break
                except json.JSONDecodeError as e:
                    last_error = f"JSON parse error from {model}: {e}"
                    print(f"[REGEN] {last_error}", flush=True)
                    continue
            else:
                last_error = f"No response from {model}"
                print(f"[REGEN] {last_error}", flush=True)
                continue

        except Exception as e:
            last_error = f"{model} failed: {type(e).__name__}: {e}"
            print(f"[REGEN] {last_error}", flush=True)
            continue

    if result_data is None:
        raise HTTPException(
            status_code=500,
            detail=f"All AI models failed to regenerate context. Last error: {last_error}"
        )

    new_context = result_data.get("context_md", "")

    # Update the project with new context
    service_client.table("projects").update({
        "context_md": new_context,
        "updated_at": datetime.now().isoformat()
    }).eq("id", project_id).execute()

    return {
        "success": True,
        "context_md": new_context,
        "message": f"Regenerated context from {len(decisions)} decisions",
        "decision_count": len(decisions),
        "sections_count": result_data.get("sections_count"),
        "decisions_incorporated": result_data.get("decisions_incorporated")
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
            raise HTTPException(status_code=404, detail="Resource not found")

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
        raise SecureHTTPException.internal_error(str(e))


# =======================
# AI Writing Assistant
# =======================

class AIWriteAssistRequest(BaseModel):
    """Request for AI writing assistance."""
    prompt: str
    context: str = "generic"  # Context type determines persona
    playbook_type: str = None  # For playbook content: "sop", "framework", "policy"


@app.post("/api/ai/write-assist")
async def ai_write_assist(
    request: AIWriteAssistRequest,
    user: dict = Depends(get_current_user)
):
    """
    AI Writing Assistant - helps users write better form content.
    Uses centralized personas from personas.py for consistency.
    For playbook types (SOP, Framework, Policy), uses expert personas from database.
    Returns plain text (no markdown) for clean UX.
    """
    from .openrouter import query_model, MOCK_LLM
    from .personas import get_write_assist_persona_async, build_system_prompt
    import json as json_module

    # Handle mock mode
    if MOCK_LLM:
        print(f"[MOCK] AI Write Assist - context: {request.context}", flush=True)
        return {
            "suggestion": f"[AI Suggestion for {request.context}]\n\nThis is a mock response. In production, the AI would improve your text based on the context type."
        }

    prompt = request.prompt[:10000] if request.prompt else ""
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # Get persona from database (for playbooks) or hardcoded fallback
    persona_data = await get_write_assist_persona_async(request.context, request.playbook_type)
    persona_prompt = persona_data["system_prompt"]
    model_preferences = persona_data["model_preferences"]

    # Handle model_preferences being a JSON string
    if isinstance(model_preferences, str):
        model_preferences = json_module.loads(model_preferences)

    type_label = request.playbook_type.upper() if request.playbook_type else request.context

    # Build system prompt with formatting rules
    system_prompt = build_system_prompt(persona_prompt, include_formatting=True)
    system_prompt += "\n\nFollow the specific instructions in the user's prompt exactly.\nReturn ONLY the improved/generated text - no explanations or meta-commentary."

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        # Try each model in preference order (from database persona)
        last_error = None
        for model_to_use in model_preferences:
            try:
                print(f"[WRITE-ASSIST] context={request.context}, type={type_label}, model={model_to_use}", flush=True)

                result = await query_model(
                    model=model_to_use,
                    messages=messages
                )

                if result and result.get('content'):
                    # Strip any remaining markdown artifacts
                    suggestion = result['content'].strip()
                    # Remove common markdown patterns
                    suggestion = suggestion.replace('**', '').replace('__', '')
                    suggestion = suggestion.replace('```', '').replace('`', '')
                    return {"suggestion": suggestion}
                else:
                    last_error = f"No response from {model_to_use}"
                    print(f"[WRITE-ASSIST] {last_error}", flush=True)
                    continue

            except Exception as model_err:
                last_error = f"{model_to_use} failed: {type(model_err).__name__}: {model_err}"
                print(f"[WRITE-ASSIST] {last_error}", flush=True)
                continue

        # All models failed
        raise SecureHTTPException.internal_error(f"All AI models failed. Last error: {last_error}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[WRITE-ASSIST ERROR] {type(e).__name__}: {e}", flush=True)
        raise SecureHTTPException.internal_error(f"AI assistance failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
