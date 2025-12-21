"""
Stripe billing integration for AI Council.
Handles subscriptions, checkout sessions, and usage tracking.
"""

import stripe
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from .config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUBSCRIPTION_TIERS
from .database import get_supabase, get_supabase_with_auth, get_supabase_service
from .security import log_billing_event, mask_email


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
            print(f"[Stripe] Created product for {tier_id}: {product.id}")

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
            print(f"[Stripe] Created price for {tier_id}: {price.id}")

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

    # Get tier-specific limits
    tier = subscription.get("tier", "free")
    tier_config = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
    monthly_limit = tier_config.get("queries_per_month", 5)
    daily_limit = tier_config.get("queries_per_day", 5)

    # Check monthly usage
    if monthly_limit > 0:
        remaining = monthly_limit - subscription["queries_used"]
        if remaining <= 0:
            return {
                "can_query": False,
                "reason": f"Monthly query limit reached ({monthly_limit} queries). Upgrade to continue.",
                "remaining": 0
            }

    remaining_monthly = monthly_limit - subscription["queries_used"] if monthly_limit > 0 else -1

    return {
        "can_query": True,
        "reason": None,
        "remaining": remaining_monthly,
        "daily_limit": daily_limit,
        "monthly_limit": monthly_limit
    }


def check_and_increment_usage(user_id: str, access_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Atomically check usage limits and increment counters if allowed.
    This is the preferred method for production use - combines check and increment
    in a single atomic operation to prevent race conditions.

    Args:
        user_id: Supabase user ID
        access_token: User's JWT access token for RLS authentication

    Returns:
        Dict with allowed (bool), reason (str if false), queries_today, queries_this_period
    """
    subscription = get_user_subscription(user_id, access_token=access_token)

    # Check subscription status first
    if subscription["status"] not in ("active", "trialing"):
        return {
            "allowed": False,
            "reason": "Subscription is not active",
            "queries_today": 0,
            "queries_this_period": 0
        }

    # Get tier-specific limits
    tier = subscription.get("tier", "free")
    tier_config = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
    monthly_limit = tier_config.get("queries_per_month", 5)
    daily_limit = tier_config.get("queries_per_day", 5)

    # Try atomic database function
    supabase = get_supabase_service()
    if supabase:
        try:
            result = supabase.rpc('check_and_increment_usage', {
                'p_user_id': user_id,
                'p_daily_limit': daily_limit,
                'p_monthly_limit': monthly_limit
            }).execute()

            if result.data and len(result.data) > 0:
                row = result.data[0]
                return {
                    "allowed": row.get("allowed", False),
                    "reason": row.get("reason"),
                    "queries_today": row.get("queries_today", 0),
                    "queries_this_period": row.get("queries_this_period", 0),
                    "daily_remaining": row.get("daily_remaining", 0),
                    "monthly_remaining": row.get("monthly_remaining", 0)
                }
        except Exception as e:
            log_billing_event(f"Atomic check_and_increment failed: {e}", status="warning")

    # Fallback: non-atomic check (less safe but functional)
    check_result = check_can_query(user_id, access_token)
    if not check_result.get("can_query"):
        return {
            "allowed": False,
            "reason": check_result.get("reason"),
            "queries_today": 0,
            "queries_this_period": subscription.get("queries_used", 0)
        }

    # If allowed, increment (non-atomic fallback)
    new_count = increment_query_usage(user_id, access_token)
    return {
        "allowed": True,
        "reason": None,
        "queries_today": 0,  # Unknown in fallback mode
        "queries_this_period": new_count
    }


def increment_query_usage(user_id: str, access_token: Optional[str] = None) -> int:
    """
    Atomically increment the query usage counter for a user.
    Returns the new count.

    Uses database function to prevent race conditions where concurrent
    requests could both read the same count and increment to the same value.

    Args:
        user_id: Supabase user ID
        access_token: User's JWT access token for RLS authentication
    """
    # Use service client for RPC calls (more reliable)
    supabase = get_supabase_service()

    if supabase:
        try:
            # Use atomic database function
            result = supabase.rpc('increment_query_usage', {'p_user_id': user_id}).execute()
            if result.data and len(result.data) > 0:
                return result.data[0].get('new_count', 1)
        except Exception as e:
            # Log but don't fail - fall back to non-atomic method
            log_billing_event(f"Atomic increment failed, using fallback: {e}", status="warning")

    # Fallback: non-atomic increment (only if RPC fails)
    supabase = _get_client(access_token)
    result = supabase.table('user_profiles').select('queries_used_this_period').eq('user_id', user_id).execute()

    current = 0
    if result.data:
        current = result.data[0].get('queries_used_this_period', 0) or 0

    new_count = current + 1

    supabase.table('user_profiles').upsert({
        'user_id': user_id,
        'queries_used_this_period': new_count,
        'updated_at': datetime.utcnow().isoformat() + 'Z'
    }, on_conflict='user_id').execute()

    return new_count


def record_token_usage(user_id: str, tokens_input: int, tokens_output: int) -> bool:
    """
    Record token usage for cost tracking.

    Args:
        user_id: Supabase user ID
        tokens_input: Number of input tokens used
        tokens_output: Number of output tokens generated

    Returns:
        True if recorded successfully, False otherwise
    """
    supabase = get_supabase_service()
    if not supabase:
        return False

    try:
        supabase.rpc('record_token_usage', {
            'p_user_id': user_id,
            'p_tokens_input': tokens_input,
            'p_tokens_output': tokens_output
        }).execute()
        return True
    except Exception as e:
        log_billing_event(f"Failed to record token usage: {e}", status="warning")
        return False


def handle_webhook_event(payload: bytes, sig_header: str) -> Dict[str, Any]:
    """
    Handle incoming Stripe webhook events.

    Args:
        payload: Raw request body
        sig_header: Stripe-Signature header value

    Returns:
        Dict with success status and message
    """
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return {"success": False, "error": "Invalid payload"}
    except stripe.error.SignatureVerificationError:
        return {"success": False, "error": "Invalid signature"}

    event_type = event["type"]
    data = event["data"]["object"]

    log_billing_event(f"Webhook received: {event_type}")

    # Use service role client to bypass RLS for webhook operations
    # The anon client fails because RLS policies require auth.uid() = user_id
    # and webhooks have no authenticated user context
    supabase = get_supabase_service()
    if not supabase:
        log_billing_event("Webhook error: service key not configured", status="error")
        return {"success": False, "error": "Service key not configured"}

    if event_type == "checkout.session.completed":
        # Subscription started via checkout
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

    elif event_type == "customer.subscription.updated":
        # Subscription changed (upgrade/downgrade/renewal)
        subscription_id = data.get("id")
        status = data.get("status")
        tier_id = data.get("metadata", {}).get("tier_id")
        user_id = data.get("metadata", {}).get("user_id")
        period_end = data.get("current_period_end")

        if user_id:
            update_data = {
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

    elif event_type == "customer.subscription.deleted":
        # Subscription cancelled
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

    elif event_type == "invoice.paid":
        # Payment successful - reset usage counter for new period
        subscription_id = data.get("subscription")
        if subscription_id:
            # Get subscription to find user
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

    elif event_type == "invoice.payment_failed":
        # Payment failed
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
