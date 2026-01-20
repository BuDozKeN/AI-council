"""
Stripe billing integration for AI Council.
Handles subscriptions, checkout sessions, and usage tracking.
"""

import stripe
from datetime import datetime
from typing import Optional, Dict, Any, List, Callable
from .config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUBSCRIPTION_TIERS
from .database import get_supabase, get_supabase_with_auth, get_supabase_service
from .security import log_billing_event


def _get_client(access_token: Optional[str] = None):
    """Get appropriate Supabase client based on whether we have an access token."""
    if access_token:
        return get_supabase_with_auth(access_token)
    return get_supabase()

# Initialize Stripe
stripe.api_key = STRIPE_SECRET_KEY

# Cache for Stripe product/price IDs (populated on first use)
_stripe_products: Dict[str, str] = {}
_stripe_prices: Dict[str, str] = {}


def get_or_create_stripe_products() -> Dict[str, Dict[str, str]]:
    """
    Ensure Stripe products and prices exist for our tiers.
    Returns mapping of tier_id -> {product_id, price_id}
    """
    global _stripe_products, _stripe_prices

    if _stripe_products and _stripe_prices:
        return {tier: {"product_id": _stripe_products[tier], "price_id": _stripe_prices[tier]}
                for tier in _stripe_products}

    # List existing products
    existing_products = stripe.Product.list(limit=100)
    product_map = {p.metadata.get("tier_id"): p.id for p in existing_products.data
                   if p.metadata.get("tier_id")}

    # List existing prices
    existing_prices = stripe.Price.list(limit=100, active=True)
    price_map = {}
    for price in existing_prices.data:
        tier_id = price.metadata.get("tier_id")
        if tier_id:
            price_map[tier_id] = price.id

    result = {}

    for tier_id, tier_config in SUBSCRIPTION_TIERS.items():
        # Skip free tier - no Stripe product needed
        if tier_config["price_monthly"] == 0:
            continue

        # Create product if needed
        if tier_id not in product_map:
            product = stripe.Product.create(
                name=f"AI Council {tier_config['name']}",
                description=", ".join(tier_config["features"]),
                metadata={"tier_id": tier_id}
            )
            product_map[tier_id] = product.id

        # Create price if needed
        if tier_id not in price_map:
            price = stripe.Price.create(
                product=product_map[tier_id],
                unit_amount=tier_config["price_monthly"],
                currency="usd",
                recurring={"interval": "month"},
                metadata={"tier_id": tier_id}
            )
            price_map[tier_id] = price.id

        _stripe_products[tier_id] = product_map[tier_id]
        _stripe_prices[tier_id] = price_map[tier_id]

        result[tier_id] = {
            "product_id": product_map[tier_id],
            "price_id": price_map[tier_id]
        }

    return result


def get_or_create_stripe_customer(user_id: str, email: str, access_token: Optional[str] = None) -> str:
    """
    Get or create a Stripe customer for a user.
    Stores the customer ID in Supabase user metadata.
    """
    supabase = _get_client(access_token)

    # Check if user already has a Stripe customer ID
    result = supabase.table('user_profiles').select('stripe_customer_id').eq('user_id', user_id).execute()

    if result.data and result.data[0].get('stripe_customer_id'):
        return result.data[0]['stripe_customer_id']

    # Search for existing customer by email
    existing = stripe.Customer.list(email=email, limit=1)
    if existing.data:
        customer_id = existing.data[0].id
    else:
        # Create new customer
        customer = stripe.Customer.create(
            email=email,
            metadata={"user_id": user_id}
        )
        customer_id = customer.id
        log_billing_event("Customer created", user_id=user_id)

    # Store in user profile (upsert)
    supabase.table('user_profiles').upsert({
        'user_id': user_id,
        'stripe_customer_id': customer_id,
        'updated_at': datetime.utcnow().isoformat() + 'Z'
    }, on_conflict='user_id').execute()

    return customer_id


def create_checkout_session(
    user_id: str,
    email: str,
    tier_id: str,
    success_url: str,
    cancel_url: str,
    access_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a Stripe Checkout session for subscribing to a tier.

    Args:
        user_id: Supabase user ID
        email: User's email
        tier_id: Subscription tier (pro, enterprise)
        success_url: URL to redirect on success
        cancel_url: URL to redirect on cancel
        access_token: User's JWT access token for RLS authentication

    Returns:
        Dict with checkout_url and session_id
    """
    if tier_id not in SUBSCRIPTION_TIERS or SUBSCRIPTION_TIERS[tier_id]["price_monthly"] == 0:
        raise ValueError(f"Invalid tier for checkout: {tier_id}")

    # Ensure products exist
    products = get_or_create_stripe_products()
    if tier_id not in products:
        raise ValueError(f"No Stripe product for tier: {tier_id}")

    # Get or create customer
    customer_id = get_or_create_stripe_customer(user_id, email, access_token=access_token)

    # Create checkout session
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{
            "price": products[tier_id]["price_id"],
            "quantity": 1,
        }],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user_id,
            "tier_id": tier_id
        },
        subscription_data={
            "metadata": {
                "user_id": user_id,
                "tier_id": tier_id
            }
        }
    )

    return {
        "checkout_url": session.url,
        "session_id": session.id
    }


def create_billing_portal_session(user_id: str, email: str, return_url: str, access_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a Stripe Billing Portal session for managing subscription.

    Args:
        user_id: Supabase user ID
        email: User's email
        return_url: URL to return to after portal
        access_token: User's JWT access token for RLS authentication

    Returns:
        Dict with portal_url
    """
    customer_id = get_or_create_stripe_customer(user_id, email, access_token=access_token)

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url
    )

    return {"portal_url": session.url}


def get_user_subscription(user_id: str, access_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Get the current subscription status for a user.

    Args:
        user_id: Supabase user ID
        access_token: User's JWT access token for RLS authentication

    Returns:
        Dict with tier, status, queries_used, queries_limit, period_end
    """
    supabase = _get_client(access_token)

    # Get user profile
    result = supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()

    if not result.data:
        # No profile - return free tier defaults
        return {
            "tier": "free",
            "status": "active",
            "queries_used": 0,
            "queries_limit": SUBSCRIPTION_TIERS["free"]["queries_per_month"],
            "period_end": None,
            "features": SUBSCRIPTION_TIERS["free"]["features"]
        }

    profile = result.data[0]
    tier = profile.get('subscription_tier', 'free')
    tier_config = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])

    return {
        "tier": tier,
        "status": profile.get('subscription_status', 'active'),
        "queries_used": profile.get('queries_used_this_period', 0),
        "queries_limit": tier_config["queries_per_month"],
        "period_end": profile.get('subscription_period_end'),
        "features": tier_config["features"]
    }


def check_can_query(user_id: str, access_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Check if user can make a council query based on their subscription.

    Args:
        user_id: Supabase user ID
        access_token: User's JWT access token for RLS authentication

    Returns:
        Dict with can_query (bool), reason (str if false), remaining (int)
    """
    subscription = get_user_subscription(user_id, access_token=access_token)

    # Check subscription status
    if subscription["status"] not in ("active", "trialing"):
        return {
            "can_query": False,
            "reason": "Subscription is not active",
            "remaining": 0
        }

    # Unlimited queries
    if subscription["queries_limit"] == -1:
        return {
            "can_query": True,
            "reason": None,
            "remaining": -1  # Unlimited
        }

    # Check usage
    remaining = subscription["queries_limit"] - subscription["queries_used"]
    if remaining <= 0:
        return {
            "can_query": False,
            "reason": f"Monthly query limit reached ({subscription['queries_limit']} queries). Upgrade to continue.",
            "remaining": 0
        }

    return {
        "can_query": True,
        "reason": None,
        "remaining": remaining
    }


def increment_query_usage(user_id: str, access_token: Optional[str] = None, raise_on_failure: bool = False) -> int:
    """
    Increment the query usage counter for a user using atomic database operation.
    Returns the new count, or -1 if increment failed (unless raise_on_failure=True).

    SECURITY: Uses PostgreSQL function for atomic increment to prevent race
    conditions where concurrent requests could bypass query limits.

    Args:
        user_id: Supabase user ID
        access_token: User's JWT access token for RLS authentication
        raise_on_failure: If True, raise ValueError on failure. If False (default),
                          return -1 and log the error. Set to False for post-response
                          increments where we don't want to break the user experience.
    """
    # Use service client for RPC call (function handles its own security)
    supabase = get_supabase_service()
    if not supabase:
        log_billing_event("Increment failed: service client unavailable", user_id=user_id, status="error")
        if raise_on_failure:
            raise ValueError("Query limit check unavailable - please try again")
        return -1

    try:
        # Call atomic increment function in database
        # This is a single atomic operation that cannot race
        result = supabase.rpc('increment_query_usage', {'p_user_id': user_id}).execute()

        if result.data is not None:
            return result.data

        # Fallback if function doesn't exist yet (migration not applied)
        log_billing_event("Atomic increment unavailable, using fallback", user_id=user_id, status="warning")
    except Exception as e:
        # Function might not exist yet - log and handle gracefully
        log_billing_event(f"Atomic increment failed: {type(e).__name__}: {str(e)}", user_id=user_id, status="warning")

    # SECURITY NOTE: If the RPC function doesn't exist, we can't atomically track usage.
    # Rather than block users entirely, we log the failure and continue.
    # The pre-query check (check_can_query) still works via the user_profiles table.
    # Apply the migration 20251224110000_atomic_query_increment.sql to fix this properly.
    log_billing_event(
        "Billing increment unavailable - migration may not be applied. Apply 20251224110000_atomic_query_increment.sql",
        user_id=user_id,
        status="warning"
    )

    if raise_on_failure:
        raise ValueError("Query limit check unavailable - please try again")
    return -1


# =============================================================================
# WEBHOOK EVENT HANDLERS
# =============================================================================

def _handle_checkout_completed(supabase, data: Dict[str, Any], event_id: str) -> None:
    """Handle checkout.session.completed event - subscription started via checkout."""
    user_id = data.get("metadata", {}).get("user_id")
    tier_id = data.get("metadata", {}).get("tier_id")

    if user_id and tier_id:
        supabase.table('user_profiles').upsert({
            'user_id': user_id,
            'subscription_tier': tier_id,
            'subscription_status': 'active',
            'stripe_subscription_id': data.get("subscription"),
            'queries_used_this_period': 0,
            'updated_at': datetime.utcnow().isoformat() + 'Z'
        }, on_conflict='user_id').execute()
        log_billing_event("Subscription started", user_id=user_id, tier=tier_id, status="active")


def _handle_subscription_updated(supabase, data: Dict[str, Any], event_id: str) -> None:
    """Handle customer.subscription.updated event - upgrade/downgrade/renewal."""
    status = data.get("status")
    tier_id = data.get("metadata", {}).get("tier_id")
    user_id = data.get("metadata", {}).get("user_id")
    period_end = data.get("current_period_end")

    if user_id:
        update_data: Dict[str, Any] = {
            'user_id': user_id,
            'subscription_status': status,
            'updated_at': datetime.utcnow().isoformat() + 'Z'
        }
        if tier_id:
            update_data['subscription_tier'] = tier_id
        if period_end:
            update_data['subscription_period_end'] = datetime.fromtimestamp(period_end).isoformat() + 'Z'

        supabase.table('user_profiles').upsert(update_data, on_conflict='user_id').execute()
        log_billing_event("Subscription updated", user_id=user_id, tier=tier_id, status=status)


def _handle_subscription_deleted(supabase, data: Dict[str, Any], event_id: str) -> None:
    """Handle customer.subscription.deleted event - subscription cancelled."""
    user_id = data.get("metadata", {}).get("user_id")

    if user_id:
        supabase.table('user_profiles').upsert({
            'user_id': user_id,
            'subscription_tier': 'free',
            'subscription_status': 'cancelled',
            'stripe_subscription_id': None,
            'updated_at': datetime.utcnow().isoformat() + 'Z'
        }, on_conflict='user_id').execute()
        log_billing_event("Subscription cancelled", user_id=user_id, tier="free", status="cancelled")


def _handle_invoice_paid(supabase, data: Dict[str, Any], event_id: str) -> None:
    """Handle invoice.paid event - payment successful, reset usage counter."""
    subscription_id = data.get("subscription")
    if subscription_id:
        subscription = stripe.Subscription.retrieve(subscription_id)
        user_id = subscription.metadata.get("user_id")

        if user_id:
            supabase.table('user_profiles').upsert({
                'user_id': user_id,
                'queries_used_this_period': 0,
                'subscription_period_end': datetime.fromtimestamp(
                    subscription.current_period_end
                ).isoformat() + 'Z',
                'updated_at': datetime.utcnow().isoformat() + 'Z'
            }, on_conflict='user_id').execute()
            log_billing_event("Usage reset on invoice payment", user_id=user_id)


def _handle_invoice_payment_failed(supabase, data: Dict[str, Any], event_id: str) -> None:
    """Handle invoice.payment_failed event - payment failed."""
    subscription_id = data.get("subscription")
    if subscription_id:
        subscription = stripe.Subscription.retrieve(subscription_id)
        user_id = subscription.metadata.get("user_id")

        if user_id:
            supabase.table('user_profiles').upsert({
                'user_id': user_id,
                'subscription_status': 'past_due',
                'updated_at': datetime.utcnow().isoformat() + 'Z'
            }, on_conflict='user_id').execute()
            log_billing_event("Payment failed", user_id=user_id, status="past_due")


# Event handler dispatch table
_WEBHOOK_HANDLERS: Dict[str, Callable[[Any, Dict[str, Any], str], None]] = {
    "checkout.session.completed": _handle_checkout_completed,
    "customer.subscription.updated": _handle_subscription_updated,
    "customer.subscription.deleted": _handle_subscription_deleted,
    "invoice.paid": _handle_invoice_paid,
    "invoice.payment_failed": _handle_invoice_payment_failed,
}


def handle_webhook_event(payload: bytes, sig_header: str) -> Dict[str, Any]:
    """
    Handle incoming Stripe webhook events.

    Uses a dispatch table to route events to specific handlers,
    reducing complexity and making it easy to add new event types.

    Args:
        payload: Raw request body
        sig_header: Stripe-Signature header value

    Returns:
        Dict with success status and message
    """
    # Validate and parse the webhook event
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return {"success": False, "error": "Invalid payload"}
    except stripe.error.SignatureVerificationError:
        return {"success": False, "error": "Invalid signature"}

    event_id = event["id"]
    event_type = event["type"]
    data = event["data"]["object"]

    log_billing_event(f"Webhook received: {event_type}", event_id=event_id)

    # Get service client (bypasses RLS for webhook operations)
    supabase = get_supabase_service()
    if not supabase:
        log_billing_event("Webhook error: service key not configured", status="error")
        return {"success": False, "error": "Service key not configured"}

    # SECURITY: Idempotency check - prevent replay attacks
    try:
        existing = supabase.table('processed_webhook_events').select('id').eq('event_id', event_id).maybe_single().execute()
        if existing and existing.data:
            log_billing_event("Webhook already processed (idempotency)", event_id=event_id)
            return {"success": True, "status": "already_processed", "event_type": event_type}

        # Mark event as being processed
        supabase.table('processed_webhook_events').insert({
            'event_id': event_id,
            'event_type': event_type,
            'processed_at': datetime.utcnow().isoformat() + 'Z'
        }).execute()
    except Exception as idempotency_err:
        # Continue gracefully if idempotency table doesn't exist
        log_billing_event(f"Idempotency check warning: {type(idempotency_err).__name__}", event_id=event_id)

    # Dispatch to the appropriate handler
    handler = _WEBHOOK_HANDLERS.get(event_type)
    if handler:
        handler(supabase, data, event_id)

    return {"success": True, "event_type": event_type}


def get_available_plans() -> List[Dict[str, Any]]:
    """
    Get list of available subscription plans for display.
    """
    plans = []
    for tier_id, config in SUBSCRIPTION_TIERS.items():
        plans.append({
            "id": tier_id,
            "name": config["name"],
            "price": config["price_monthly"] / 100 if config["price_monthly"] > 0 else 0,
            "price_display": f"${config['price_monthly'] / 100:.0f}/month" if config["price_monthly"] > 0 else "Free",
            "queries_limit": config["queries_per_month"],
            "queries_display": "Unlimited" if config["queries_per_month"] == -1 else f"{config['queries_per_month']}/month",
            "features": config["features"],
            "is_free": config["price_monthly"] == 0
        })
    return plans
