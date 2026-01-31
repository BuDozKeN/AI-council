"""
AgentMail Integration Service

Handles integration with AgentMail.to for:
- Managing agent email inboxes
- Processing incoming emails via webhooks
- Sending responses from the council

AgentMail Documentation: https://docs.agentmail.to
"""

import os
import httpx
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

from ..security import log_app_event

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

AGENTMAIL_API_KEY = os.getenv("AGENTMAIL_API_KEY")
AGENTMAIL_API_URL = "https://api.agentmail.to/v1"
AGENTMAIL_INBOX_ADDRESS = os.getenv("AGENTMAIL_INBOX_ADDRESS", "council@agentmail.to")

# Webhook secret for verifying incoming webhooks
AGENTMAIL_WEBHOOK_SECRET = os.getenv("AGENTMAIL_WEBHOOK_SECRET")


# =============================================================================
# DATA MODELS
# =============================================================================

class IncomingEmail:
    """Parsed incoming email from AgentMail webhook."""

    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id", "")
        self.thread_id = data.get("thread_id")
        self.from_email = data.get("from", {}).get("email", "")
        self.from_name = data.get("from", {}).get("name", "")
        self.to_email = data.get("to", [{}])[0].get("email", "") if data.get("to") else ""
        self.subject = data.get("subject", "")
        self.body_text = data.get("text", "")
        self.body_html = data.get("html", "")
        self.received_at = data.get("received_at", datetime.utcnow().isoformat())
        self.in_reply_to = data.get("in_reply_to")
        self.references = data.get("references", [])
        self.attachments = data.get("attachments", [])

        # Extract the user's question from the email body
        self.question = self._extract_question()

    def _extract_question(self) -> str:
        """
        Extract the user's question from email body.

        For replies, we try to extract just the new content.
        For new emails, we use the full body.
        """
        body = self.body_text or ""

        # If this is a reply, try to extract only the new content
        if self.in_reply_to:
            # Common reply markers
            reply_markers = [
                "On ",  # "On Jan 1, 2026, council@... wrote:"
                "-----Original Message-----",
                "________________________________",
                "> ",  # Quoted text
                "From: ",
                "Sent: ",
            ]

            lines = body.split("\n")
            new_content_lines = []

            for line in lines:
                # Stop at reply markers
                should_stop = False
                for marker in reply_markers:
                    if line.strip().startswith(marker):
                        should_stop = True
                        break

                if should_stop:
                    break

                new_content_lines.append(line)

            # Use extracted new content if we found something
            extracted = "\n".join(new_content_lines).strip()
            if extracted and len(extracted) > 10:
                return extracted

        return body.strip()

    @property
    def is_reply(self) -> bool:
        """Check if this email is a reply to a previous thread."""
        return bool(self.in_reply_to or self.thread_id)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "id": self.id,
            "thread_id": self.thread_id,
            "from_email": self.from_email,
            "from_name": self.from_name,
            "to_email": self.to_email,
            "subject": self.subject,
            "body_text": self.body_text,
            "question": self.question,
            "received_at": self.received_at,
            "is_reply": self.is_reply,
        }


# =============================================================================
# AGENTMAIL API CLIENT
# =============================================================================

class AgentMailClient:
    """Client for AgentMail.to API."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or AGENTMAIL_API_KEY
        self.base_url = AGENTMAIL_API_URL

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        from_inbox: Optional[str] = None,
        reply_to_message_id: Optional[str] = None,
        thread_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send an email via AgentMail.

        Args:
            to_email: Recipient email address
            subject: Email subject
            body_html: HTML body content
            body_text: Plain text body (optional, will be auto-generated from HTML if not provided)
            from_inbox: Inbox address to send from (defaults to configured inbox)
            reply_to_message_id: Message ID this is replying to (for threading)
            thread_id: Thread ID for continuing conversation

        Returns:
            Dict with message_id and status
        """
        if not self.api_key:
            log_app_event(
                "AGENTMAIL: Not configured",
                level="WARNING",
                message="AGENTMAIL_API_KEY not set"
            )
            return {"success": False, "error": "AgentMail not configured"}

        payload = {
            "to": [{"email": to_email}],
            "subject": subject,
            "html": body_html,
            "from": from_inbox or AGENTMAIL_INBOX_ADDRESS,
        }

        if body_text:
            payload["text"] = body_text

        if reply_to_message_id:
            payload["in_reply_to"] = reply_to_message_id

        if thread_id:
            payload["thread_id"] = thread_id

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/emails/send",
                    json=payload,
                    headers=self._get_headers(),
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()

                log_app_event(
                    "AGENTMAIL: Email sent",
                    to=to_email,
                    subject=subject[:50],
                    message_id=data.get("id"),
                )

                return {
                    "success": True,
                    "message_id": data.get("id"),
                    "thread_id": data.get("thread_id"),
                }

        except httpx.HTTPStatusError as e:
            log_app_event(
                "AGENTMAIL: Send failed",
                level="ERROR",
                status_code=e.response.status_code,
                error=str(e),
            )
            return {"success": False, "error": str(e)}

        except Exception as e:
            log_app_event(
                "AGENTMAIL: Send error",
                level="ERROR",
                error=str(e),
            )
            return {"success": False, "error": str(e)}

    async def get_thread(self, thread_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get all messages in a thread.

        Args:
            thread_id: The thread ID

        Returns:
            List of messages in the thread, or None if not found
        """
        if not self.api_key:
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/threads/{thread_id}",
                    headers=self._get_headers(),
                    timeout=15.0,
                )
                response.raise_for_status()
                data = response.json()

                return data.get("messages", [])

        except Exception as e:
            log_app_event(
                "AGENTMAIL: Failed to get thread",
                level="WARNING",
                thread_id=thread_id,
                error=str(e),
            )
            return None

    async def create_inbox(
        self,
        name: str,
        domain: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a new agent inbox.

        Args:
            name: Name for the inbox (becomes name@domain)
            domain: Custom domain (optional, uses agentmail.to if not provided)

        Returns:
            Dict with inbox details
        """
        if not self.api_key:
            return {"success": False, "error": "AgentMail not configured"}

        payload = {"name": name}
        if domain:
            payload["domain"] = domain

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/inboxes",
                    json=payload,
                    headers=self._get_headers(),
                    timeout=15.0,
                )
                response.raise_for_status()
                data = response.json()

                log_app_event(
                    "AGENTMAIL: Inbox created",
                    inbox_address=data.get("email"),
                )

                return {
                    "success": True,
                    "inbox": data,
                }

        except Exception as e:
            log_app_event(
                "AGENTMAIL: Inbox creation failed",
                level="ERROR",
                error=str(e),
            )
            return {"success": False, "error": str(e)}


# =============================================================================
# WEBHOOK VERIFICATION
# =============================================================================

def verify_webhook_signature(
    payload: bytes,
    signature: str,
    timestamp: str,
) -> bool:
    """
    Verify the webhook signature from AgentMail.

    Args:
        payload: Raw request body
        signature: X-AgentMail-Signature header
        timestamp: X-AgentMail-Timestamp header

    Returns:
        True if signature is valid
    """
    if not AGENTMAIL_WEBHOOK_SECRET:
        # If no secret configured, skip verification (dev mode)
        log_app_event(
            "AGENTMAIL: Webhook verification skipped (no secret configured)",
            level="WARNING",
        )
        return True

    import hmac
    import hashlib

    # AgentMail signs: timestamp + "." + payload
    signed_payload = f"{timestamp}.{payload.decode('utf-8')}"

    expected_signature = hmac.new(
        AGENTMAIL_WEBHOOK_SECRET.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def parse_incoming_email(webhook_data: Dict[str, Any]) -> IncomingEmail:
    """
    Parse incoming email webhook data into IncomingEmail object.

    Args:
        webhook_data: Raw webhook payload from AgentMail

    Returns:
        IncomingEmail object
    """
    # AgentMail sends email data nested under 'data' key for email.received events
    email_data = webhook_data.get("data", webhook_data)
    return IncomingEmail(email_data)


def is_agentmail_configured() -> bool:
    """Check if AgentMail is properly configured."""
    return bool(AGENTMAIL_API_KEY)


# =============================================================================
# SINGLETON CLIENT
# =============================================================================

_client: Optional[AgentMailClient] = None


def get_agentmail_client() -> AgentMailClient:
    """Get or create the AgentMail client singleton."""
    global _client
    if _client is None:
        _client = AgentMailClient()
    return _client
