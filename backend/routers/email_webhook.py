"""
Email Webhook Router

Handles incoming emails from AgentMail webhooks:
1. Receives email via webhook
2. Validates corporate email
3. Enriches lead (Apollo + FreshLink)
4. Runs council pipeline
5. Sends personalized response

This powers the email-to-council onboarding flow.
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel, Field

from ..database import get_supabase_service
from ..security import log_app_event
from ..rate_limit import limiter
from ..services.agentmail import (
    parse_incoming_email,
    verify_webhook_signature,
    get_agentmail_client,
    IncomingEmail,
    is_agentmail_configured,
)
from ..services.lead_enrichment import (
    enrich_lead,
    is_corporate_email,
    EnrichedLead,
    get_mock_lead,
)
import re


router = APIRouter(prefix="/email-webhook", tags=["email-webhook"])


# =============================================================================
# AUTO-REPLY AND DUPLICATE DETECTION
# =============================================================================

# Patterns that indicate an auto-reply or out-of-office message
AUTO_REPLY_PATTERNS = [
    r"out of (the )?office",
    r"automatic reply",
    r"auto-reply",
    r"autoreply",
    r"autoresponse",
    r"auto response",
    r"i am currently away",
    r"away from (my )?email",
    r"on (annual |medical |parental )?leave",
    r"will respond when i return",
    r"i('m| am) (on |currently )?vacation",
    r"limited access to email",
    r"automated response",
    r"this is an automated",
    r"do not reply",
    r"noreply",
    r"no-reply",
    r"mailer-daemon",
    r"postmaster",
    r"undeliverable",
    r"delivery (status )?notification",
    r"message not delivered",
]


def is_auto_reply(subject: str, body: str, from_email: str) -> bool:
    """
    Detect if an email is an auto-reply or out-of-office message.

    Returns True if the email should be skipped (not processed).
    """
    # Check from address for common auto-reply patterns
    from_lower = from_email.lower()
    if any(pattern in from_lower for pattern in ["noreply", "no-reply", "mailer-daemon", "postmaster"]):
        return True

    # Check subject and body against patterns
    combined = f"{subject} {body}".lower()
    for pattern in AUTO_REPLY_PATTERNS:
        if re.search(pattern, combined):
            return True

    return False


async def check_duplicate_email(
    email: str,
    question: str,
    window_minutes: int = 5,
) -> Optional[str]:
    """
    Check if this is a duplicate email (same sender + question within time window).

    Returns the existing lead_id if duplicate, None otherwise.
    """
    try:
        supabase = get_supabase_service()

        # Query for recent emails with same sender and question
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)

        result = supabase.table("email_leads").select(
            "id"
        ).eq("email", email.lower()).eq("question", question).gte(
            "created_at", cutoff.isoformat()
        ).order("created_at", desc=True).limit(1).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["id"]

        return None

    except Exception as e:
        log_app_event(
            "EMAIL_DUPLICATE_CHECK: Error",
            level="WARNING",
            error=str(e),
        )
        return None


async def get_next_waiting_list_position() -> int:
    """Get the next waiting list position number."""
    try:
        supabase = get_supabase_service()

        result = supabase.table("email_leads").select(
            "waiting_list_position"
        ).not_.is_("waiting_list_position", "null").order(
            "waiting_list_position", desc=True
        ).limit(1).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["waiting_list_position"] + 1

        return 1  # First person on waiting list

    except Exception:
        return 1


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class WebhookResponse(BaseModel):
    """Response to AgentMail webhook."""
    success: bool
    message: str
    lead_id: Optional[str] = None


class EmailLeadStatus(BaseModel):
    """Status of an email lead processing."""
    id: str
    email: str
    status: str  # "received", "processing", "completed", "failed", "non_corporate"
    council_completed: bool = False
    response_sent: bool = False
    created_at: str


# =============================================================================
# WEBHOOK HANDLER
# =============================================================================

@router.post("/agentmail", response_model=WebhookResponse)
@limiter.limit("100/minute")
async def handle_agentmail_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_agentmail_signature: Optional[str] = Header(None),
    x_agentmail_timestamp: Optional[str] = Header(None),
):
    """
    Handle incoming email webhooks from AgentMail.

    This is the main entry point for email-to-council flow:
    1. Receive email from AgentMail webhook
    2. Validate sender is corporate email
    3. Process asynchronously (enrich → council → respond)

    AgentMail sends events for: email.received, email.sent, email.bounced
    """
    try:
        # Get raw body for signature verification
        body = await request.body()

        # Verify webhook signature
        if x_agentmail_signature and x_agentmail_timestamp:
            if not verify_webhook_signature(body, x_agentmail_signature, x_agentmail_timestamp):
                log_app_event(
                    "EMAIL_WEBHOOK: Invalid signature",
                    level="WARNING",
                )
                raise HTTPException(status_code=401, detail="Invalid webhook signature")

        # Parse webhook payload
        payload = await request.json()

        # Check event type
        event_type = payload.get("event", payload.get("type", ""))

        log_app_event(
            "EMAIL_WEBHOOK: Received",
            event_type=event_type,
        )

        # Only process email.received events
        if event_type not in ["email.received", "message.received", ""]:
            return WebhookResponse(
                success=True,
                message=f"Event {event_type} acknowledged",
            )

        # Parse email data
        email = parse_incoming_email(payload)

        # Validate sender
        sender_email = email.from_email
        if not sender_email:
            log_app_event(
                "EMAIL_WEBHOOK: No sender email",
                level="WARNING",
            )
            return WebhookResponse(
                success=False,
                message="No sender email found",
            )

        # Check for auto-reply / out-of-office
        if is_auto_reply(email.subject, email.body_text, sender_email):
            log_app_event(
                "EMAIL_WEBHOOK: Auto-reply detected, skipping",
                email_domain=sender_email.split("@")[-1] if "@" in sender_email else "unknown",
            )
            return WebhookResponse(
                success=True,
                message="Auto-reply detected - skipped",
            )

        # Check for duplicate email (same sender + question within 5 min)
        duplicate_lead_id = await check_duplicate_email(
            email=sender_email,
            question=email.question,
            window_minutes=5,
        )
        if duplicate_lead_id:
            log_app_event(
                "EMAIL_WEBHOOK: Duplicate email detected",
                duplicate_of=duplicate_lead_id,
            )
            return WebhookResponse(
                success=True,
                message="Duplicate email - already processing",
                lead_id=duplicate_lead_id,
            )

        # Check if corporate email
        is_corporate, reason = is_corporate_email(sender_email)

        # Create lead record
        lead_id = await _create_email_lead(
            email=email,
            is_corporate=is_corporate,
            rejection_reason=None if is_corporate else reason,
        )

        if not is_corporate:
            log_app_event(
                "EMAIL_WEBHOOK: Non-corporate email - adding to waiting list",
                email_domain=sender_email.split("@")[-1] if "@" in sender_email else "unknown",
                reason=reason,
            )

            # Add to waiting list instead of rejecting
            background_tasks.add_task(
                _add_to_waiting_list,
                email=email,
                lead_id=lead_id,
            )

            return WebhookResponse(
                success=True,
                message="Added to waiting list",
                lead_id=lead_id,
            )

        # Process corporate email asynchronously
        background_tasks.add_task(
            process_email_council_request,
            email=email,
            lead_id=lead_id,
        )

        log_app_event(
            "EMAIL_WEBHOOK: Processing started",
            lead_id=lead_id,
            email_domain=sender_email.split("@")[-1] if "@" in sender_email else "unknown",
        )

        return WebhookResponse(
            success=True,
            message="Email received - council processing started",
            lead_id=lead_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "EMAIL_WEBHOOK: Error",
            level="ERROR",
            error=str(e),
        )
        # Return 200 to prevent retries (we'll handle the error internally)
        return WebhookResponse(
            success=False,
            message=f"Error processing email: {str(e)}",
        )


# =============================================================================
# EMAIL PROCESSING PIPELINE
# =============================================================================

async def process_email_council_request(
    email: IncomingEmail,
    lead_id: str,
):
    """
    Process an email council request.

    Pipeline:
    1. Enrich lead (Apollo + FreshLink)
    2. Run council with personalized context
    3. Generate response email
    4. Send via AgentMail
    5. Update lead status

    This runs in the background after webhook acknowledgment.
    """
    try:
        # Update status to processing
        await _update_lead_status(lead_id, "processing")

        # Step 1: Enrich lead
        log_app_event(
            "EMAIL_COUNCIL: Enriching lead",
            lead_id=lead_id,
        )

        enriched_lead = await enrich_lead(email.from_email)

        # Store enrichment data
        await _update_lead_enrichment(lead_id, enriched_lead)

        # Step 2: Run council
        log_app_event(
            "EMAIL_COUNCIL: Running council",
            lead_id=lead_id,
            question_preview=email.question[:100] if email.question else "N/A",
        )

        council_result = await _run_council_for_email(
            question=email.question,
            lead=enriched_lead,
            is_followup=email.is_reply,
            thread_id=email.thread_id,
        )

        # Store council result
        await _store_council_result(lead_id, council_result)

        # Step 3: Generate and send response
        log_app_event(
            "EMAIL_COUNCIL: Sending response",
            lead_id=lead_id,
        )

        await _send_council_response(
            email=email,
            lead=enriched_lead,
            council_result=council_result,
            lead_id=lead_id,
        )

        # Update status to completed
        await _update_lead_status(lead_id, "completed", response_sent=True)

        log_app_event(
            "EMAIL_COUNCIL: Complete",
            lead_id=lead_id,
            success=True,
        )

    except Exception as e:
        log_app_event(
            "EMAIL_COUNCIL: Failed",
            level="ERROR",
            lead_id=lead_id,
            error=str(e),
        )

        # Update status to failed
        await _update_lead_status(lead_id, "failed", error=str(e))

        # Send error response
        try:
            await _send_error_response(email, lead_id, str(e))
        except Exception:
            pass  # Don't fail if error email fails


async def _run_council_for_email(
    question: str,
    lead: EnrichedLead,
    is_followup: bool = False,
    thread_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run the council pipeline for an email question.

    Injects lead context into the council for personalization.
    """
    from ..council import run_full_council

    # Build personalized context
    context = lead.get_personalization_context()

    # Augment question with context for the council
    augmented_question = f"""CONTEXT: {context}

QUESTION: {question}"""

    # Run the full 3-stage council
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(
        user_query=augmented_question,
        business_id=None,  # No business context for email users
    )

    return {
        "stage1_results": stage1_results,
        "stage2_results": stage2_results,
        "stage3_result": stage3_result,
        "metadata": metadata,
        "question": question,
        "context": context,
    }


# =============================================================================
# EMAIL RESPONSE GENERATION
# =============================================================================

async def _send_council_response(
    email: IncomingEmail,
    lead: EnrichedLead,
    council_result: Dict[str, Any],
    lead_id: str,
):
    """
    Generate and send the council response email.

    The email includes:
    - Personalized greeting
    - Executive summary (free teaser)
    - Link to full council deliberation (registration required)
    - CTA to sign up
    """
    from .email_templates import generate_council_response_email

    # Generate email content
    subject, html_body, text_body = generate_council_response_email(
        lead=lead,
        council_result=council_result,
        original_question=email.question,
        lead_id=lead_id,
    )

    # Send via AgentMail
    client = get_agentmail_client()
    result = await client.send_email(
        to_email=email.from_email,
        subject=subject,
        body_html=html_body,
        body_text=text_body,
        reply_to_message_id=email.id,
        thread_id=email.thread_id,
    )

    if not result.get("success"):
        raise Exception(f"Failed to send email: {result.get('error')}")

    # Update lead with message ID
    await _update_lead_response_info(
        lead_id=lead_id,
        message_id=result.get("message_id"),
        thread_id=result.get("thread_id"),
    )


async def _add_to_waiting_list(
    email: IncomingEmail,
    lead_id: str,
):
    """
    Add a non-corporate email user to the waiting list.

    This captures leads for future marketing instead of rejecting them.
    Sends a waiting list email with their position.
    """
    from .email_templates import generate_waiting_list_email

    try:
        # Get waiting list position
        position = await get_next_waiting_list_position()

        # Update lead with waiting list info
        supabase = get_supabase_service()
        supabase.table("email_leads").update({
            "waiting_list_status": "pending",
            "waiting_list_position": position,
            "waiting_list_joined_at": datetime.now(timezone.utc).isoformat(),
            "notify_on_public_launch": True,
        }).eq("id", lead_id).execute()

        # Generate and send waiting list email
        subject, html_body, text_body = generate_waiting_list_email(
            recipient_email=email.from_email,
            original_subject=email.subject,
            waiting_list_position=position,
        )

        client = get_agentmail_client()
        result = await client.send_email(
            to_email=email.from_email,
            subject=subject,
            body_html=html_body,
            body_text=text_body,
            reply_to_message_id=email.id,
        )

        if result.get("success"):
            await _update_lead_status(lead_id, "waiting_list", response_sent=True)

            log_app_event(
                "EMAIL_WAITING_LIST: Added",
                lead_id=lead_id,
                position=position,
            )
        else:
            log_app_event(
                "EMAIL_WAITING_LIST: Email send failed",
                level="WARNING",
                lead_id=lead_id,
                error=result.get("error"),
            )

    except Exception as e:
        log_app_event(
            "EMAIL_WAITING_LIST: Error",
            level="ERROR",
            lead_id=lead_id,
            error=str(e),
        )


async def _send_non_corporate_response(
    email: IncomingEmail,
    lead_id: str,
):
    """
    DEPRECATED: Use _add_to_waiting_list instead.

    Kept for backwards compatibility. Now redirects to waiting list flow.
    """
    # Redirect to waiting list instead
    await _add_to_waiting_list(email, lead_id)


async def _send_error_response(
    email: IncomingEmail,
    lead_id: str,
    error: str,
):
    """Send error response if council execution fails."""
    from .email_templates import generate_error_response_email

    subject, html_body, text_body = generate_error_response_email(
        recipient_email=email.from_email,
        original_question=email.question[:200] if email.question else "Your question",
    )

    client = get_agentmail_client()
    await client.send_email(
        to_email=email.from_email,
        subject=subject,
        body_html=html_body,
        body_text=text_body,
        reply_to_message_id=email.id,
    )


# =============================================================================
# DATABASE OPERATIONS
# =============================================================================

async def _create_email_lead(
    email: IncomingEmail,
    is_corporate: bool,
    rejection_reason: Optional[str] = None,
) -> str:
    """Create an email lead record in the database."""
    try:
        supabase = get_supabase_service()
        lead_id = str(uuid.uuid4())

        data = {
            "id": lead_id,
            "email": email.from_email,
            "email_domain": email.from_email.split("@")[-1] if "@" in email.from_email else "",
            "from_name": email.from_name,
            "subject": email.subject,
            "question": email.question,
            "is_corporate": is_corporate,
            "rejection_reason": rejection_reason,
            "status": "received",
            "agentmail_message_id": email.id,
            "agentmail_thread_id": email.thread_id,
            "is_reply": email.is_reply,
            "received_at": email.received_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        supabase.table("email_leads").insert(data).execute()

        return lead_id

    except Exception as e:
        log_app_event(
            "EMAIL_LEAD: Create failed",
            level="ERROR",
            error=str(e),
        )
        # Return a UUID anyway so processing can continue
        return str(uuid.uuid4())


async def _update_lead_status(
    lead_id: str,
    status: str,
    response_sent: bool = False,
    error: Optional[str] = None,
):
    """Update lead status in database."""
    try:
        supabase = get_supabase_service()

        data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if response_sent:
            data["response_sent"] = True
            data["response_sent_at"] = datetime.now(timezone.utc).isoformat()

        if error:
            data["error_message"] = error[:1000]  # Truncate long errors

        if status == "completed":
            data["council_completed"] = True
            data["council_completed_at"] = datetime.now(timezone.utc).isoformat()

        supabase.table("email_leads").update(data).eq("id", lead_id).execute()

    except Exception as e:
        log_app_event(
            "EMAIL_LEAD: Status update failed",
            level="WARNING",
            lead_id=lead_id,
            error=str(e),
        )


async def _update_lead_enrichment(lead_id: str, lead: EnrichedLead):
    """Store lead enrichment data."""
    try:
        supabase = get_supabase_service()

        data = {
            "enrichment_data": lead.to_dict(),
            "full_name": lead.full_name,
            "title": lead.title,
            "company_name": lead.company_name,
            "company_industry": lead.company_industry,
            "company_size": lead.company_size,
            "enrichment_source": lead.enrichment_source,
            "enrichment_confidence": lead.enrichment_confidence,
            "enriched_at": datetime.now(timezone.utc).isoformat(),
        }

        supabase.table("email_leads").update(data).eq("id", lead_id).execute()

    except Exception as e:
        log_app_event(
            "EMAIL_LEAD: Enrichment update failed",
            level="WARNING",
            lead_id=lead_id,
            error=str(e),
        )


async def _store_council_result(lead_id: str, council_result: Dict[str, Any]):
    """Store council execution results."""
    try:
        supabase = get_supabase_service()

        # Extract key data (don't store full results to save space)
        stage3 = council_result.get("stage3_result", {})
        metadata = council_result.get("metadata", {})

        data = {
            "council_response": stage3.get("response", ""),
            "council_model": stage3.get("model", ""),
            "council_metadata": {
                "stage1_count": len(council_result.get("stage1_results", [])),
                "stage2_count": len(council_result.get("stage2_results", [])),
                "aggregate_rankings": metadata.get("aggregate_rankings", []),
            },
        }

        supabase.table("email_leads").update(data).eq("id", lead_id).execute()

    except Exception as e:
        log_app_event(
            "EMAIL_LEAD: Council result storage failed",
            level="WARNING",
            lead_id=lead_id,
            error=str(e),
        )


async def _update_lead_response_info(
    lead_id: str,
    message_id: Optional[str],
    thread_id: Optional[str],
):
    """Update lead with response message info."""
    try:
        supabase = get_supabase_service()

        data = {
            "response_message_id": message_id,
            "response_thread_id": thread_id,
        }

        supabase.table("email_leads").update(data).eq("id", lead_id).execute()

    except Exception as e:
        log_app_event(
            "EMAIL_LEAD: Response info update failed",
            level="WARNING",
            lead_id=lead_id,
            error=str(e),
        )


# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================

@router.get("/leads/{lead_id}")
@limiter.limit("100/minute")
async def get_lead_status(
    request: Request,
    lead_id: str,
):
    """
    Get status of an email lead.

    Used for debugging and monitoring.
    Requires admin authentication in production.
    """
    try:
        supabase = get_supabase_service()

        result = supabase.table("email_leads").select(
            "id, email, status, council_completed, response_sent, created_at, "
            "full_name, company_name, enrichment_source"
        ).eq("id", lead_id).maybe_single().execute()

        if not result or not result.data:
            raise HTTPException(status_code=404, detail="Lead not found")

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "EMAIL_LEAD: Get status failed",
            level="ERROR",
            lead_id=lead_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Failed to get lead status")


@router.get("/stats")
@limiter.limit("30/minute")
async def get_email_stats(request: Request):
    """
    Get email onboarding statistics.

    Returns counts of leads by status, domain, etc.
    """
    try:
        supabase = get_supabase_service()

        # Get counts by status
        result = supabase.table("email_leads").select(
            "status",
            count="exact",
        ).execute()

        # This is a simplified version - full implementation would use
        # proper aggregation queries

        return {
            "total_leads": len(result.data) if result.data else 0,
            "message": "Use Supabase dashboard for detailed stats",
        }

    except Exception as e:
        log_app_event(
            "EMAIL_STATS: Failed",
            level="ERROR",
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Failed to get stats")


# =============================================================================
# PUBLIC COUNCIL SESSION ENDPOINT
# =============================================================================

class CouncilSessionResponse(BaseModel):
    """Public council session response for email leads."""
    lead_id: str
    question: str
    council_response: str
    council_model: Optional[str] = None
    company_name: Optional[str] = None
    full_name: Optional[str] = None
    created_at: str
    # Stage details (for showing the deliberation)
    stage1_count: int = 0
    stage2_count: int = 0
    aggregate_rankings: Optional[list] = None
    # Registration info
    is_registered: bool = False
    registration_url: str


@router.get("/council-session/{lead_id}", response_model=CouncilSessionResponse)
@limiter.limit("100/minute")
async def get_council_session(
    request: Request,
    lead_id: str,
    source: Optional[str] = None,
):
    """
    Get council session details for an email lead.

    This is the public-facing endpoint for viewing council deliberations.
    Users land here from the "View Full Council Session" link in emails.

    The full deliberation is shown, with a CTA to register for continued access.
    """
    import os
    APP_URL = os.getenv("VITE_APP_URL", os.getenv("APP_URL", "http://localhost:5173"))

    try:
        supabase = get_supabase_service()

        # Get lead with council results
        result = supabase.table("email_leads").select(
            "id, question, council_response, council_model, council_metadata, "
            "company_name, full_name, created_at, converted_to_user"
        ).eq("id", lead_id).maybe_single().execute()

        if not result or not result.data:
            raise HTTPException(status_code=404, detail="Council session not found")

        lead = result.data

        # Check if council has completed
        if not lead.get("council_response"):
            raise HTTPException(
                status_code=202,
                detail="Council deliberation is still in progress. Please check back shortly."
            )

        # Extract metadata
        metadata = lead.get("council_metadata", {}) or {}

        # Log view
        log_app_event(
            "EMAIL_COUNCIL_SESSION: Viewed",
            lead_id=lead_id,
            source=source,
        )

        return CouncilSessionResponse(
            lead_id=lead["id"],
            question=lead.get("question", ""),
            council_response=lead.get("council_response", ""),
            council_model=lead.get("council_model"),
            company_name=lead.get("company_name"),
            full_name=lead.get("full_name"),
            created_at=lead.get("created_at", ""),
            stage1_count=metadata.get("stage1_count", 0),
            stage2_count=metadata.get("stage2_count", 0),
            aggregate_rankings=metadata.get("aggregate_rankings"),
            is_registered=bool(lead.get("converted_to_user")),
            registration_url=f"{APP_URL}/signup?source=email&lead={lead_id}",
        )

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "EMAIL_COUNCIL_SESSION: Error",
            level="ERROR",
            lead_id=lead_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Failed to load council session")


# =============================================================================
# REGISTRATION CONVERSION ENDPOINT
# =============================================================================

class ConvertLeadRequest(BaseModel):
    """Request to link an email lead to a registered user."""
    user_id: str


@router.post("/convert-lead/{lead_id}")
@limiter.limit("10/minute")
async def convert_lead_to_user(
    request: Request,
    lead_id: str,
    data: ConvertLeadRequest,
):
    """
    Link an email lead to a newly registered user.

    Called after a user signs up via the registration link in their email.
    This marks the lead as converted for funnel analytics.
    """
    try:
        supabase = get_supabase_service()

        # Verify the user exists
        try:
            user_response = supabase.auth.admin.get_user_by_id(data.user_id)
            if not user_response.user:
                raise HTTPException(status_code=400, detail="User not found")
        except HTTPException:
            raise
        except Exception as e:
            log_app_event(
                "EMAIL_LEAD_CONVERT: User verification failed",
                level="ERROR",
                user_id=data.user_id,
                error=str(e),
            )
            raise HTTPException(status_code=400, detail="Could not verify user")

        # Update lead as converted
        result = supabase.table("email_leads").update({
            "converted_to_user": True,
            "converted_user_id": data.user_id,
            "converted_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", lead_id).eq("converted_to_user", False).execute()

        if not result.data:
            # Either lead doesn't exist or already converted
            existing = supabase.table("email_leads").select(
                "id, converted_to_user"
            ).eq("id", lead_id).maybe_single().execute()

            if existing.data and existing.data.get("converted_to_user"):
                return {"success": True, "message": "Lead already converted"}
            else:
                raise HTTPException(status_code=404, detail="Lead not found")

        log_app_event(
            "EMAIL_LEAD_CONVERT: Success",
            lead_id=lead_id,
            user_id=data.user_id,
        )

        return {"success": True, "message": "Lead converted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        log_app_event(
            "EMAIL_LEAD_CONVERT: Error",
            level="ERROR",
            lead_id=lead_id,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Failed to convert lead")
