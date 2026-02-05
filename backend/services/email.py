"""
Email Service

Abstraction layer for sending emails. Currently logs emails to console.
Replace with Resend integration when ready.

To integrate Resend:
1. pip install resend
2. Add RESEND_API_KEY to .env
3. Uncomment the Resend implementation below
"""

import logging
import os
from typing import Optional
from datetime import datetime, timezone

from ..security import log_app_event

logger = logging.getLogger(__name__)


# =============================================================================
# EMAIL SERVICE CONFIGURATION
# =============================================================================

# Set to True when Resend is configured
EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "false").lower() == "true"
RESEND_API_KEY = os.getenv("RESEND_API_KEY")

# Email sender configuration
DEFAULT_FROM_EMAIL = os.getenv("EMAIL_FROM", "AxCouncil <noreply@axcouncil.com>")
APP_NAME = os.getenv("APP_NAME", "AxCouncil")
APP_URL = os.getenv("VITE_APP_URL", os.getenv("APP_URL", "http://localhost:5173"))


# =============================================================================
# EMAIL TEMPLATES
# =============================================================================

def get_invitation_email_html(
    invitee_email: str,
    inviter_name: str,
    invitation_token: str,
    expires_at: str,
) -> str:
    """Generate HTML email for platform invitation."""
    accept_url = f"{APP_URL}/accept-invite?token={invitation_token}"

    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're invited to {APP_NAME}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">{APP_NAME}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AI-Powered Decision Council</p>
    </div>

    <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #111827; margin-top: 0;">You're Invited!</h2>

        <p><strong>{inviter_name}</strong> has invited you to join {APP_NAME}, an AI-powered decision-making platform that helps teams make better decisions by consulting multiple AI models.</p>

        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 15px 0;"><strong>What you'll get:</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
                <li>Access to 5 leading AI models (Claude, GPT-4, Gemini, Grok, DeepSeek)</li>
                <li>3-stage deliberation process for thorough analysis</li>
                <li>Bring your own OpenRouter API key for full control</li>
            </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{accept_url}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Accept Invitation
            </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
            This invitation expires on <strong>{expires_at}</strong>.
        </p>

        <p style="color: #6b7280; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="{accept_url}" style="color: #667eea; word-break: break-all;">{accept_url}</a>
        </p>
    </div>

    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">© {datetime.now().year} {APP_NAME}. All rights reserved.</p>
        <p style="margin: 5px 0 0 0;">If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
</body>
</html>
"""


def get_invitation_email_text(
    invitee_email: str,
    inviter_name: str,
    invitation_token: str,
    expires_at: str,
) -> str:
    """Generate plain text email for platform invitation."""
    accept_url = f"{APP_URL}/accept-invite?token={invitation_token}"

    return f"""
You're Invited to {APP_NAME}!

{inviter_name} has invited you to join {APP_NAME}, an AI-powered decision-making platform.

What you'll get:
- Access to 5 leading AI models (Claude, GPT-4, Gemini, Grok, DeepSeek)
- 3-stage deliberation process for thorough analysis
- Bring your own OpenRouter API key for full control

Accept your invitation here:
{accept_url}

This invitation expires on {expires_at}.

If you didn't expect this invitation, you can safely ignore this email.

© {datetime.now().year} {APP_NAME}
"""


# =============================================================================
# EMAIL SENDING FUNCTIONS
# =============================================================================

async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    from_email: Optional[str] = None,
) -> dict:
    """
    Send an email.

    Currently logs to console. Replace with Resend when ready.

    Returns:
        dict with 'success' and 'message_id' or 'error'
    """
    sender = from_email or DEFAULT_FROM_EMAIL

    # Log the email attempt
    log_app_event(
        "EMAIL: Attempting to send",
        to=to,
        subject=subject,
        from_email=sender,
        email_enabled=EMAIL_ENABLED,
    )

    # If email is not enabled, just log and return success
    if not EMAIL_ENABLED or not RESEND_API_KEY:
        log_app_event(
            "EMAIL: Would send (email disabled)",
            level="INFO",
            to=to,
            subject=subject,
            html_preview=html[:200] if html else None,
        )
        logger.info(f"\n{'='*60}")
        logger.info(f"EMAIL PREVIEW (not sent - EMAIL_ENABLED=false)")
        logger.info(f"{'='*60}")
        logger.info(f"To: {to}")
        logger.info(f"From: {sender}")
        logger.info(f"Subject: {subject}")
        logger.info(f"{'='*60}")
        logger.info(text or "See HTML content")
        logger.info(f"{'='*60}\n")

        return {
            "success": True,
            "message_id": f"preview-{datetime.now(timezone.utc).isoformat()}",
            "preview_mode": True,
        }

    # =================================================================
    # RESEND INTEGRATION (uncomment when ready)
    # =================================================================
    # try:
    #     import resend
    #     resend.api_key = RESEND_API_KEY
    #
    #     params = {
    #         "from": sender,
    #         "to": [to],
    #         "subject": subject,
    #         "html": html,
    #     }
    #     if text:
    #         params["text"] = text
    #
    #     response = resend.Emails.send(params)
    #
    #     log_app_event(
    #         "EMAIL: Sent successfully",
    #         to=to,
    #         subject=subject,
    #         message_id=response.get("id"),
    #     )
    #
    #     return {
    #         "success": True,
    #         "message_id": response.get("id"),
    #     }
    #
    # except Exception as e:
    #     log_app_event(
    #         "EMAIL: Failed to send",
    #         level="ERROR",
    #         to=to,
    #         subject=subject,
    #         error=str(e),
    #     )
    #     return {
    #         "success": False,
    #         "error": str(e),
    #     }

    return {
        "success": True,
        "message_id": f"placeholder-{datetime.now(timezone.utc).isoformat()}",
    }


async def send_invitation_email(
    invitee_email: str,
    inviter_name: str,
    invitation_token: str,
    expires_at: str,
) -> dict:
    """
    Send a platform invitation email.

    Args:
        invitee_email: Email address of the person being invited
        inviter_name: Name of the admin sending the invitation
        invitation_token: Unique token for accepting the invitation
        expires_at: Human-readable expiration date

    Returns:
        dict with 'success' and 'message_id' or 'error'
    """
    subject = f"You're invited to join {APP_NAME}"

    html = get_invitation_email_html(
        invitee_email=invitee_email,
        inviter_name=inviter_name,
        invitation_token=invitation_token,
        expires_at=expires_at,
    )

    text = get_invitation_email_text(
        invitee_email=invitee_email,
        inviter_name=inviter_name,
        invitation_token=invitation_token,
        expires_at=expires_at,
    )

    return await send_email(
        to=invitee_email,
        subject=subject,
        html=html,
        text=text,
    )


# =============================================================================
# COMPANY MEMBER INVITATION TEMPLATES
# =============================================================================

def get_company_member_invitation_email_html(
    invitee_email: str,
    inviter_name: str,
    company_name: str,
    invitation_token: str,
    expires_at: str,
    is_existing_user: bool,
) -> str:
    """Generate HTML email for company member invitation."""
    if is_existing_user:
        # Existing user - direct join flow
        accept_url = f"{APP_URL}/accept-company-invite?token={invitation_token}"
        cta_text = "Accept & Join"
        intro_text = f"<strong>{inviter_name}</strong> has invited you to join <strong>{company_name}</strong> on {APP_NAME}."
        instruction_text = "Click the button below to join the team."
    else:
        # New user - signup + join flow
        accept_url = f"{APP_URL}/accept-invite?token={invitation_token}"
        cta_text = "Create Account & Join"
        intro_text = f"<strong>{inviter_name}</strong> has invited you to join <strong>{company_name}</strong> on {APP_NAME}."
        instruction_text = "Create your account to get started and join the team."

    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join {company_name} on {APP_NAME}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">{APP_NAME}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AI-Powered Decision Council</p>
    </div>

    <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #111827; margin-top: 0;">Join {company_name}!</h2>

        <p>{intro_text}</p>

        <p>{instruction_text}</p>

        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 15px 0;"><strong>As a team member, you'll have access to:</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
                <li>Collaborate with your team using AI-powered decision making</li>
                <li>Access to {company_name}'s departments and projects</li>
                <li>Participate in council sessions and reviews</li>
            </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{accept_url}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                {cta_text}
            </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
            This invitation expires on <strong>{expires_at}</strong>.
        </p>

        <p style="color: #6b7280; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="{accept_url}" style="color: #667eea; word-break: break-all;">{accept_url}</a>
        </p>
    </div>

    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">© {datetime.now().year} {APP_NAME}. All rights reserved.</p>
        <p style="margin: 5px 0 0 0;">If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
</body>
</html>
"""


def get_company_member_invitation_email_text(
    invitee_email: str,
    inviter_name: str,
    company_name: str,
    invitation_token: str,
    expires_at: str,
    is_existing_user: bool,
) -> str:
    """Generate plain text email for company member invitation."""
    if is_existing_user:
        accept_url = f"{APP_URL}/accept-company-invite?token={invitation_token}"
        instruction_text = "Click the link below to accept and join the team."
    else:
        accept_url = f"{APP_URL}/accept-invite?token={invitation_token}"
        instruction_text = "Create your account to get started and join the team."

    return f"""
Join {company_name} on {APP_NAME}!

{inviter_name} has invited you to join {company_name} on {APP_NAME}.

{instruction_text}

As a team member, you'll have access to:
- Collaborate with your team using AI-powered decision making
- Access to {company_name}'s departments and projects
- Participate in council sessions and reviews

Accept your invitation here:
{accept_url}

This invitation expires on {expires_at}.

If you didn't expect this invitation, you can safely ignore this email.

© {datetime.now().year} {APP_NAME}
"""


async def send_company_member_invitation_email(
    invitee_email: str,
    inviter_name: str,
    company_name: str,
    invitation_token: str,
    expires_at: str,
    is_existing_user: bool,
) -> dict:
    """
    Send a company member invitation email.

    Args:
        invitee_email: Email address of the person being invited
        inviter_name: Name of the person sending the invitation
        company_name: Name of the company they're being invited to
        invitation_token: Unique token for accepting the invitation
        expires_at: Human-readable expiration date
        is_existing_user: Whether the invitee already has an account

    Returns:
        dict with 'success' and 'message_id' or 'error'
    """
    subject = f"You're invited to join {company_name} on {APP_NAME}"

    html = get_company_member_invitation_email_html(
        invitee_email=invitee_email,
        inviter_name=inviter_name,
        company_name=company_name,
        invitation_token=invitation_token,
        expires_at=expires_at,
        is_existing_user=is_existing_user,
    )

    text = get_company_member_invitation_email_text(
        invitee_email=invitee_email,
        inviter_name=inviter_name,
        company_name=company_name,
        invitation_token=invitation_token,
        expires_at=expires_at,
        is_existing_user=is_existing_user,
    )

    return await send_email(
        to=invitee_email,
        subject=subject,
        html=html,
        text=text,
    )
