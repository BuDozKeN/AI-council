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

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..auth import get_current_user
from .. import billing
from ..security import SecureHTTPException

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


class BillingPortalRequest(BaseModel):
    """Request to create a billing portal session."""
    return_url: str


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
