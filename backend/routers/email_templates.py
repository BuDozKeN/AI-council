"""
Email Templates for Council Responses

Generates personalized email responses for the email-to-council feature.
The goal is to create a "wow factor" with:
- Personalized greeting based on enriched lead data
- Executive summary from the council
- Strategic teaser that drives registration
- Link to full council deliberation
"""

import os
import re
from datetime import datetime
from typing import Dict, Any, Tuple, Optional

from ..services.lead_enrichment import EnrichedLead


# =============================================================================
# CONFIGURATION
# =============================================================================

APP_NAME = os.getenv("APP_NAME", "AxCouncil")
APP_URL = os.getenv("VITE_APP_URL", os.getenv("APP_URL", "http://localhost:5173"))
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support@axcouncil.com")


# =============================================================================
# MAIN COUNCIL RESPONSE EMAIL
# =============================================================================

def generate_council_response_email(
    lead: EnrichedLead,
    council_result: Dict[str, Any],
    original_question: str,
    lead_id: str,
) -> Tuple[str, str, str]:
    """
    Generate the council response email.

    Returns:
        Tuple of (subject, html_body, text_body)
    """
    # Extract council response
    stage3 = council_result.get("stage3_result", {})
    full_response = stage3.get("response", "")

    # Extract executive summary (first 2-3 paragraphs)
    executive_summary = _extract_executive_summary(full_response)

    # Generate personalization elements
    greeting_name = lead.get_greeting_name()
    personalization_block = _generate_personalization_block(lead)

    # Generate link to full deliberation
    full_access_url = f"{APP_URL}/council-session/{lead_id}?source=email"
    register_url = f"{APP_URL}/signup?source=email&lead={lead_id}"

    # Generate subject line
    subject = _generate_subject_line(lead, original_question)

    # Generate HTML body
    html_body = _generate_html_response(
        greeting_name=greeting_name,
        personalization_block=personalization_block,
        executive_summary=executive_summary,
        original_question=original_question[:300],
        full_access_url=full_access_url,
        register_url=register_url,
        lead=lead,
        council_result=council_result,
    )

    # Generate plain text body
    text_body = _generate_text_response(
        greeting_name=greeting_name,
        personalization_block=personalization_block,
        executive_summary=executive_summary,
        original_question=original_question[:300],
        full_access_url=full_access_url,
        register_url=register_url,
    )

    return subject, html_body, text_body


def _extract_executive_summary(full_response: str) -> str:
    """
    Extract executive summary from council response.

    Looks for explicit Executive Summary section, or takes first 2-3 paragraphs.
    """
    # Look for Executive Summary section
    patterns = [
        r'\*\*Executive Summary\*\*:?\s*(.*?)(?=\n\n|\n##|\*\*)',
        r'## Executive Summary\s*(.*?)(?=\n##)',
        r'Executive Summary:?\s*(.*?)(?=\n\n)',
    ]

    for pattern in patterns:
        match = re.search(pattern, full_response, re.IGNORECASE | re.DOTALL)
        if match:
            summary = match.group(1).strip()
            if len(summary) > 100:
                return summary

    # Fallback: Take first 2-3 paragraphs
    paragraphs = full_response.split("\n\n")
    summary_paragraphs = []
    char_count = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Skip headers and short lines
        if para.startswith("#") or len(para) < 50:
            continue

        summary_paragraphs.append(para)
        char_count += len(para)

        # Stop after ~800 characters or 3 paragraphs
        if char_count > 800 or len(summary_paragraphs) >= 3:
            break

    return "\n\n".join(summary_paragraphs)


def _generate_subject_line(lead: EnrichedLead, question: str) -> str:
    """Generate a compelling subject line."""
    # Extract key words from question
    question_preview = question[:50].strip()
    if len(question) > 50:
        question_preview = question_preview.rsplit(" ", 1)[0] + "..."

    if lead.company_name:
        return f"Your {APP_NAME} Council Response: Strategic Insights for {lead.company_name}"

    return f"Your {APP_NAME} Council Has Deliberated"


def _generate_personalization_block(lead: EnrichedLead) -> str:
    """
    Generate the personalization/context block that creates the "wow factor".

    This shows the user we know who they are and have tailored the response.
    """
    if lead.enrichment_source == "mock" or not lead.full_name:
        return ""

    parts = []

    # Role and company
    if lead.title and lead.company_name:
        parts.append(f"As {lead.title} at {lead.company_name}")

        # Add company details
        details = []
        if lead.company_industry:
            details.append(f"in the {lead.company_industry} industry")
        if lead.company_size_range:
            details.append(f"with {lead.company_size_range} employees")
        if lead.company_funding_stage:
            details.append(f"({lead.company_funding_stage})")

        if details:
            parts.append(", ".join(details))

    elif lead.company_name:
        parts.append(f"At {lead.company_name}")

    if parts:
        return ", ".join(parts) + ", our AI council has tailored this response to your specific context."

    return ""


def _generate_html_response(
    greeting_name: str,
    personalization_block: str,
    executive_summary: str,
    original_question: str,
    full_access_url: str,
    register_url: str,
    lead: EnrichedLead,
    council_result: Dict[str, Any],
) -> str:
    """Generate HTML email body."""

    # Generate council info block
    stage1_count = len(council_result.get("stage1_results", []))
    metadata = council_result.get("metadata", {})
    rankings = metadata.get("aggregate_rankings", [])

    council_info = f"""
    <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #0369a1; font-size: 14px;">
            <strong>Council Deliberation Complete</strong><br>
            {stage1_count} AI advisors analyzed your question across 3 stages of deliberation.
        </p>
    </div>
    """ if stage1_count > 0 else ""

    # Personalization block HTML
    personalization_html = f"""
    <div style="background: linear-gradient(135deg, #667eea10 0%, #764ba210 100%); border-left: 4px solid #667eea; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #4c1d95; font-style: italic;">
            {personalization_block}
        </p>
    </div>
    """ if personalization_block else ""

    # Convert markdown-ish formatting in summary to HTML
    summary_html = executive_summary.replace("\n\n", "</p><p style='margin: 16px 0;'>")
    summary_html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', summary_html)
    summary_html = f"<p style='margin: 16px 0;'>{summary_html}</p>"

    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your {APP_NAME} Council Response</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">{APP_NAME}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AI-Powered Decision Council</p>
    </div>

    <!-- Main Content -->
    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">

        <!-- Greeting -->
        <h2 style="color: #111827; margin-top: 0;">Hi {greeting_name},</h2>

        {personalization_html}

        <p>Your question has been reviewed by our council of AI advisors. Here's the executive summary:</p>

        <!-- Original Question -->
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Your Question:</strong></p>
            <p style="margin: 8px 0 0 0; color: #374151;">{original_question}</p>
        </div>

        {council_info}

        <!-- Executive Summary -->
        <div style="border-top: 2px solid #667eea; padding-top: 20px; margin-top: 20px;">
            <h3 style="color: #667eea; margin-top: 0;">Executive Summary</h3>
            {summary_html}
        </div>

        <!-- Teaser -->
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; padding: 20px; margin: 25px 0; border: 1px solid #fbbf24;">
            <h4 style="margin: 0 0 10px 0; color: #92400e;">Want the Full Picture?</h4>
            <p style="margin: 0; color: #78350f; font-size: 15px;">
                The complete council deliberation includes:
            </p>
            <ul style="color: #78350f; margin: 10px 0; padding-left: 20px;">
                <li>Detailed analysis from {stage1_count} AI advisors</li>
                <li>Peer review rankings and insights</li>
                <li>Implementation recommendations</li>
                <li>Risk considerations and alternatives</li>
            </ul>
        </div>

        <!-- CTA Buttons -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="{full_access_url}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 8px;">
                View Full Council Session
            </a>
            <br>
            <a href="{register_url}" style="display: inline-block; color: #667eea; text-decoration: none; padding: 10px 20px; font-size: 14px; margin-top: 10px;">
                Create Free Account →
            </a>
        </div>

        <!-- Reply hint -->
        <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px;">
            Have a follow-up question? Simply reply to this email and the council will continue the discussion.
        </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">© {datetime.now().year} {APP_NAME}. All rights reserved.</p>
        <p style="margin: 5px 0 0 0;">
            <a href="{APP_URL}" style="color: #9ca3af;">Website</a> •
            <a href="mailto:{SUPPORT_EMAIL}" style="color: #9ca3af;">Contact Support</a>
        </p>
    </div>
</body>
</html>
"""


def _generate_text_response(
    greeting_name: str,
    personalization_block: str,
    executive_summary: str,
    original_question: str,
    full_access_url: str,
    register_url: str,
) -> str:
    """Generate plain text email body."""

    personalization_text = f"\n{personalization_block}\n" if personalization_block else ""

    # Clean markdown from summary
    clean_summary = re.sub(r'\*\*(.*?)\*\*', r'\1', executive_summary)
    clean_summary = re.sub(r'##\s*', '', clean_summary)

    return f"""
{APP_NAME} - AI-Powered Decision Council
======================================

Hi {greeting_name},
{personalization_text}
Your question has been reviewed by our council of AI advisors.

YOUR QUESTION:
{original_question}

--------------------------------------
EXECUTIVE SUMMARY
--------------------------------------

{clean_summary}

--------------------------------------
WANT THE FULL PICTURE?
--------------------------------------

The complete council deliberation includes:
- Detailed analysis from multiple AI advisors
- Peer review rankings and insights
- Implementation recommendations
- Risk considerations and alternatives

View the full session: {full_access_url}

Create a free account: {register_url}

--------------------------------------

Have a follow-up question? Simply reply to this email and the council will continue the discussion.

© {datetime.now().year} {APP_NAME}
{APP_URL}
"""


# =============================================================================
# WAITING LIST EMAIL (Non-Corporate Users)
# =============================================================================

def generate_waiting_list_email(
    recipient_email: str,
    original_subject: str,
    waiting_list_position: int,
) -> Tuple[str, str, str]:
    """
    Generate waiting list email for non-corporate email addresses.

    Instead of rejecting, we add them to a waiting list for future public launch.
    This captures leads for marketing and creates urgency to use work email.
    """
    subject = f"You're on the {APP_NAME} Waiting List (#{waiting_list_position})"

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">{APP_NAME}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AI-Powered Decision Council</p>
    </div>

    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #111827; margin-top: 0;">Thanks for your interest!</h2>

        <p>We're currently in <strong>exclusive corporate launch</strong>—our AI council is available to verified business email addresses only.</p>

        <!-- Waiting List Position Badge -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin: 25px 0; text-align: center;">
            <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">You're on the waiting list</p>
            <p style="margin: 8px 0 0 0; color: white; font-size: 48px; font-weight: bold;">#{waiting_list_position}</p>
        </div>

        <p>When we open to everyone, you'll be <strong>first in line</strong>. Plus, you'll get:</p>

        <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <ul style="color: #15803d; margin: 0; padding-left: 20px;">
                <li><strong>3 free council sessions</strong> (instead of 1)</li>
                <li><strong>Priority support</strong> when you need help</li>
                <li><strong>Early access</strong> to new features</li>
            </ul>
        </div>

        <!-- Want Immediate Access -->
        <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">Want immediate access?</h3>
            <p style="color: #78350f; margin: 0;">
                Send your question from your <strong>work email address</strong> and get your personalized AI council response today.
            </p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
            <a href="mailto:council@axcouncil.com?subject=My%20Business%20Question" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Use Work Email Instead
            </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; text-align: center;">
            We'll notify you at <strong>{recipient_email}</strong> when public access opens.
        </p>
    </div>

    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">© {datetime.now().year} {APP_NAME}</p>
        <p style="margin: 5px 0 0 0;">
            <a href="{APP_URL}" style="color: #9ca3af;">Website</a> •
            <a href="mailto:{SUPPORT_EMAIL}" style="color: #9ca3af;">Contact</a>
        </p>
    </div>
</body>
</html>
"""

    text_body = f"""
{APP_NAME} - AI-Powered Decision Council
======================================

Thanks for your interest!

We're currently in exclusive corporate launch—our AI council is
available to verified business email addresses only.

GOOD NEWS: You're on our waiting list!
Position: #{waiting_list_position}

When we open to everyone, you'll be first in line. Plus, you'll get:
• 3 free council sessions (instead of 1)
• Priority support
• Early access to new features

--------------------------------------
WANT IMMEDIATE ACCESS?
--------------------------------------

Send your question from your work email address and get your
personalized AI council response today.

Just reply to: council@axcouncil.com

--------------------------------------

We'll notify you at {recipient_email} when public access opens.

© {datetime.now().year} {APP_NAME}
{APP_URL}
"""

    return subject, html_body, text_body


# =============================================================================
# LEGACY: Non-Corporate Response (keeping for backwards compatibility)
# =============================================================================

def generate_non_corporate_response_email(
    recipient_email: str,
    original_subject: str,
    waiting_list_position: Optional[int] = None,
) -> Tuple[str, str, str]:
    """
    Generate response for non-corporate email addresses.

    Now redirects to waiting list email for better lead capture.
    """
    if waiting_list_position:
        return generate_waiting_list_email(
            recipient_email=recipient_email,
            original_subject=original_subject,
            waiting_list_position=waiting_list_position,
        )

    # Fallback to simple response if position not provided
    subject = f"Re: {original_subject}" if original_subject else f"{APP_NAME} - Corporate Email Required"

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">{APP_NAME}</h1>
    </div>

    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #111827; margin-top: 0;">Thanks for reaching out!</h2>

        <p>Our email-based council service is currently available for <strong>corporate email addresses only</strong>.</p>

        <p>Send your question from your work email address to get started, or sign up on our website:</p>

        <div style="text-align: center; margin: 25px 0;">
            <a href="{APP_URL}/signup" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Sign Up for Free
            </a>
        </div>
    </div>

    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">© {datetime.now().year} {APP_NAME}</p>
    </div>
</body>
</html>
"""

    text_body = f"""
{APP_NAME}
======================================

Thanks for reaching out!

Our email-based council service is currently available for corporate email addresses only.

Send your question from your work email address to get started, or sign up:
{APP_URL}/signup

© {datetime.now().year} {APP_NAME}
"""

    return subject, html_body, text_body


# =============================================================================
# ERROR RESPONSE EMAIL
# =============================================================================

def generate_error_response_email(
    recipient_email: str,
    original_question: str,
) -> Tuple[str, str, str]:
    """
    Generate error response when council processing fails.
    """
    subject = f"{APP_NAME} - We're Looking Into Your Question"

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">{APP_NAME}</h1>
    </div>

    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #111827; margin-top: 0;">We Hit a Snag</h2>

        <p>We received your question but encountered a temporary issue while processing it:</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #374151; font-style: italic;">"{original_question[:200]}..."</p>
        </div>

        <p>Our team has been notified and is looking into it. In the meantime, you have two options:</p>

        <div style="margin: 20px 0;">
            <p><strong>Option 1:</strong> Reply to this email to try again</p>
            <p><strong>Option 2:</strong> Ask your question directly on our platform:</p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
            <a href="{APP_URL}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Try on {APP_NAME}
            </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
            We apologize for the inconvenience. If this continues, please contact <a href="mailto:{SUPPORT_EMAIL}" style="color: #667eea;">{SUPPORT_EMAIL}</a>
        </p>
    </div>

    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">© {datetime.now().year} {APP_NAME}</p>
    </div>
</body>
</html>
"""

    text_body = f"""
{APP_NAME}
======================================

We Hit a Snag

We received your question but encountered a temporary issue while processing it:

"{original_question[:200]}..."

Our team has been notified and is looking into it. In the meantime, you have two options:

Option 1: Reply to this email to try again

Option 2: Ask your question directly on our platform:
{APP_URL}

We apologize for the inconvenience. If this continues, please contact {SUPPORT_EMAIL}

© {datetime.now().year} {APP_NAME}
"""

    return subject, html_body, text_body


# =============================================================================
# FOLLOW-UP RESPONSE EMAIL
# =============================================================================

def generate_followup_response_email(
    lead: EnrichedLead,
    council_result: Dict[str, Any],
    original_question: str,
    lead_id: str,
    thread_number: int,
) -> Tuple[str, str, str]:
    """
    Generate email for follow-up questions in a thread.

    Shorter format since context is established.
    """
    greeting_name = lead.get_greeting_name()

    # Extract response
    stage3 = council_result.get("stage3_result", {})
    full_response = stage3.get("response", "")
    summary = _extract_executive_summary(full_response)

    # URLs
    full_access_url = f"{APP_URL}/council-session/{lead_id}?source=email"

    subject = f"Re: Your {APP_NAME} Council Discussion"

    # Simpler HTML for follow-ups
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: white; padding: 20px;">
        <p>Hi {greeting_name},</p>

        <p>Here's the council's response to your follow-up:</p>

        <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Your question:</strong></p>
            <p style="margin: 8px 0 0 0;">{original_question[:200]}</p>
        </div>

        <div style="margin: 20px 0;">
            {summary.replace(chr(10)+chr(10), '</p><p>')}
        </div>

        <p style="margin-top: 30px;">
            <a href="{full_access_url}" style="color: #667eea;">View full thread ({thread_number} messages) →</a>
        </p>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Continue the conversation by replying to this email.
        </p>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 20px; color: #9ca3af; font-size: 12px;">
        {APP_NAME} • <a href="{APP_URL}" style="color: #9ca3af;">Website</a>
    </div>
</body>
</html>
"""

    text_body = f"""
Hi {greeting_name},

Here's the council's response to your follow-up:

YOUR QUESTION:
{original_question[:200]}

COUNCIL RESPONSE:
{summary}

View full thread ({thread_number} messages): {full_access_url}

Continue the conversation by replying to this email.

{APP_NAME}
{APP_URL}
"""

    return subject, html_body, text_body
