"""
Billing Router

Endpoints for subscription management:
- Get available plans
- Get user subscription status
- Check if user can query
- Create checkout session
- Create billing portal session
- Handle Stripe webhooks
"""

import logging
import os
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

from ..auth import get_current_user
from .. import billing
from ..security import SecureHTTPException, log_security_event


# =============================================================================
# SECURITY: Redirect URL Validation
# =============================================================================
# Prevents open redirect attacks via checkout success/cancel URLs

def _get_allowed_redirect_hosts() -> set:
    """Get allowed redirect hosts from environment or defaults."""
    env_hosts = os.environ.get("ALLOWED_REDIRECT_HOSTS", "")
    if env_hosts:
        return {h.strip().lower() for h in env_hosts.split(",") if h.strip()}

    # Default allowed hosts
    environment = os.environ.get("ENVIRONMENT", "development")
    if environment == "production":
        return {
            "axcouncil.com",
            "www.axcouncil.com",
            "app.axcouncil.com",
            "ai-council-three.vercel.app",
        }
    else:
        # Development - allow localhost on any port
        return {"localhost", "127.0.0.1"}


def validate_redirect_url(url: str) -> bool:
    """
    Validate that a redirect URL points to an allowed domain.

    Prevents open redirect attacks where attacker could craft:
    - success_url=https://evil-phishing-site.com/fake-success

    SECURITY: Subdomain matching must verify label boundaries to prevent
    attacks like "evil-axcouncil.com" matching "axcouncil.com".

    Args:
        url: The URL to validate

    Returns:
        True if URL is safe, False otherwise
    """
    if not url:
        return False

    try:
        parsed = urlparse(url)

        # Must have scheme and host
        if not parsed.scheme or not parsed.netloc:
            return False

        # Must be http or https
        if parsed.scheme not in ("http", "https"):
            return False

        # Extract hostname (without port)
        hostname = parsed.hostname
        if not hostname:
            return False

        hostname = hostname.lower()
        allowed_hosts = _get_allowed_redirect_hosts()

        # Check if hostname is in allowed list (exact match)
        # For localhost, allow any port
        if hostname in allowed_hosts:
            return True

        # SECURITY: Check subdomain matching with proper label boundary verification
        # Split hostname into labels (e.g., "app.axcouncil.com" -> ["app", "axcouncil", "com"])
        hostname_labels = hostname.split(".")

        for allowed in allowed_hosts:
            allowed_labels = allowed.split(".")

            # For subdomain match: hostname must have MORE labels than allowed host
            # AND the rightmost labels must match exactly
            # e.g., "app.axcouncil.com" (3 labels) matches "axcouncil.com" (2 labels)
            # but "evil-axcouncil.com" (2 labels) does NOT match "axcouncil.com" (2 labels)
            if len(hostname_labels) > len(allowed_labels):
                # Compare the rightmost N labels where N = len(allowed_labels)
                if hostname_labels[-len(allowed_labels):] == allowed_labels:
                    return True

        return False

    except Exception as e:
        logger.debug("URL validation failed for %s: %s", url if 'url' in dir() else 'unknown', e)
        return False

# Import shared rate limiter (ensures limits are tracked globally)
from ..rate_limit import limiter


router = APIRouter(prefix="/billing", tags=["billing"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class CheckoutRequest(BaseModel):
    """Request to create a checkout session."""
    tier_id: str
    success_url: str
    cancel_url: str

    @field_validator('success_url', 'cancel_url')
    @classmethod
    def validate_urls(cls, v: str) -> str:
        """Validate redirect URLs to prevent open redirect attacks."""
        if not validate_redirect_url(v):
            raise ValueError('Invalid redirect URL: must be an allowed domain')
        return v


class BillingPortalRequest(BaseModel):
    """Request to create a billing portal session."""
    return_url: str

    @field_validator('return_url')
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Validate return URL to prevent open redirect attacks."""
        if not validate_redirect_url(v):
            raise ValueError('Invalid return URL: must be an allowed domain')
        return v


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/plans")
@limiter.limit("100/minute;500/hour")
async def get_billing_plans(request: Request):
    """Get available subscription plans."""
    return billing.get_available_plans()


@router.get("/subscription")
@limiter.limit("100/minute;500/hour")
async def get_subscription(request: Request, user: dict = Depends(get_current_user)):
    """Get current user's subscription status."""
    return billing.get_user_subscription(user["id"], access_token=user.get("access_token"))


@router.get("/can-query")
@limiter.limit("100/minute;500/hour")
async def check_can_query(request: Request, user: dict = Depends(get_current_user)):
    """Check if user can make a council query."""
    return billing.check_can_query(user["id"], access_token=user.get("access_token"))


@router.post("/checkout")
@limiter.limit("10/minute")
async def create_checkout(request: Request, checkout: CheckoutRequest, user: dict = Depends(get_current_user)):
    """Create a Stripe Checkout session for subscription."""
    try:
        result = billing.create_checkout_session(
            user_id=user["id"],
            email=user["email"],
            tier_id=checkout.tier_id,
            success_url=checkout.success_url,
            cancel_url=checkout.cancel_url,
            access_token=user.get("access_token")
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise SecureHTTPException.internal_error(f"Failed to create checkout: {str(e)}")


@router.post("/portal")
@limiter.limit("10/minute")
async def create_billing_portal(request: Request, portal: BillingPortalRequest, user: dict = Depends(get_current_user)):
    """Create a Stripe Billing Portal session for managing subscription."""
    try:
        result = billing.create_billing_portal_session(
            user_id=user["id"],
            email=user["email"],
            return_url=portal.return_url,
            access_token=user.get("access_token")
        )
        return result
    except Exception as e:
        raise SecureHTTPException.internal_error(f"Failed to create portal: {str(e)}")


@router.post("/webhook")
@limiter.limit("1000/hour")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    result = billing.handle_webhook_event(payload, sig_header)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Webhook failed"))

    return {"received": True}
