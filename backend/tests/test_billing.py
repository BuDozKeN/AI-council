"""
Tests for billing.py - Stripe billing and subscription management.

These tests verify:
1. Subscription tier logic
2. Query limit checking
3. Plan listing
4. Webhook handling (with mocked Stripe)
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

# Import the module under test
from backend.billing import (
    check_can_query,
    get_available_plans,
    get_user_subscription,
    handle_webhook_event,
    increment_query_usage,
    _get_client,
)
from backend.config import SUBSCRIPTION_TIERS


# =============================================================================
# _get_client Tests
# =============================================================================

class TestGetClient:
    """Test Supabase client selection logic."""

    def test_returns_auth_client_with_token(self):
        """Should use auth client when access token provided."""
        with patch('backend.billing.get_supabase_with_auth') as mock_auth:
            with patch('backend.billing.get_supabase') as mock_regular:
                mock_auth.return_value = MagicMock(name="auth_client")

                client = _get_client("valid-token")

                mock_auth.assert_called_once_with("valid-token")
                mock_regular.assert_not_called()

    def test_returns_regular_client_without_token(self):
        """Should use regular client when no access token."""
        with patch('backend.billing.get_supabase_with_auth') as mock_auth:
            with patch('backend.billing.get_supabase') as mock_regular:
                mock_regular.return_value = MagicMock(name="regular_client")

                client = _get_client(None)

                mock_regular.assert_called_once()
                mock_auth.assert_not_called()


# =============================================================================
# get_available_plans Tests
# =============================================================================

class TestGetAvailablePlans:
    """Test plan listing logic."""

    def test_returns_all_tiers(self):
        """Should return all subscription tiers."""
        plans = get_available_plans()
        assert len(plans) == len(SUBSCRIPTION_TIERS)

    def test_free_tier_is_free(self):
        """Should mark free tier correctly."""
        plans = get_available_plans()
        free_plan = next(p for p in plans if p["id"] == "free")

        assert free_plan["is_free"] is True
        assert free_plan["price"] == 0
        assert "Free" in free_plan["price_display"]

    def test_pro_tier_pricing(self):
        """Should calculate pro tier price correctly."""
        plans = get_available_plans()
        pro_plan = next(p for p in plans if p["id"] == "pro")

        # Config has 2900 cents = $29
        assert pro_plan["price"] == 29.0
        assert pro_plan["is_free"] is False
        assert "$29" in pro_plan["price_display"]

    def test_enterprise_unlimited_display(self):
        """Should display unlimited for enterprise."""
        plans = get_available_plans()
        enterprise = next(p for p in plans if p["id"] == "enterprise")

        assert enterprise["queries_limit"] == -1
        assert "Unlimited" in enterprise["queries_display"]

    def test_all_plans_have_required_fields(self):
        """Should include all required fields for each plan."""
        plans = get_available_plans()
        required_fields = ["id", "name", "price", "price_display",
                          "queries_limit", "queries_display", "features", "is_free"]

        for plan in plans:
            for field in required_fields:
                assert field in plan, f"Missing {field} in plan {plan.get('id', 'unknown')}"

    def test_features_is_list(self):
        """Should return features as list."""
        plans = get_available_plans()
        for plan in plans:
            assert isinstance(plan["features"], list)
            assert len(plan["features"]) > 0


# =============================================================================
# check_can_query Tests
# =============================================================================

class TestCheckCanQuery:
    """Test query limit checking logic."""

    def test_active_subscription_with_queries_remaining(self):
        """Should allow query when active with remaining quota."""
        with patch('backend.billing.get_user_subscription') as mock_sub:
            mock_sub.return_value = {
                "tier": "pro",
                "status": "active",
                "queries_used": 50,
                "queries_limit": 100,
                "period_end": None,
                "features": []
            }

            result = check_can_query("user-123")

            assert result["can_query"] is True
            assert result["remaining"] == 50
            assert result["reason"] is None

    def test_inactive_subscription_blocked(self):
        """Should block query when subscription inactive."""
        with patch('backend.billing.get_user_subscription') as mock_sub:
            mock_sub.return_value = {
                "tier": "pro",
                "status": "canceled",
                "queries_used": 0,
                "queries_limit": 100,
                "period_end": None,
                "features": []
            }

            result = check_can_query("user-123")

            assert result["can_query"] is False
            assert result["remaining"] == 0
            assert "not active" in result["reason"].lower()

    def test_trialing_subscription_allowed(self):
        """Should allow query during trial period."""
        with patch('backend.billing.get_user_subscription') as mock_sub:
            mock_sub.return_value = {
                "tier": "pro",
                "status": "trialing",
                "queries_used": 10,
                "queries_limit": 100,
                "period_end": None,
                "features": []
            }

            result = check_can_query("user-123")

            assert result["can_query"] is True
            assert result["remaining"] == 90

    def test_unlimited_queries_enterprise(self):
        """Should return -1 remaining for unlimited tier."""
        with patch('backend.billing.get_user_subscription') as mock_sub:
            mock_sub.return_value = {
                "tier": "enterprise",
                "status": "active",
                "queries_used": 9999,  # High usage doesn't matter
                "queries_limit": -1,    # Unlimited
                "period_end": None,
                "features": []
            }

            result = check_can_query("user-123")

            assert result["can_query"] is True
            assert result["remaining"] == -1

    def test_query_limit_reached(self):
        """Should block when monthly limit reached."""
        with patch('backend.billing.get_user_subscription') as mock_sub:
            mock_sub.return_value = {
                "tier": "free",
                "status": "active",
                "queries_used": 5,
                "queries_limit": 5,
                "period_end": None,
                "features": []
            }

            result = check_can_query("user-123")

            assert result["can_query"] is False
            assert result["remaining"] == 0
            assert "limit" in result["reason"].lower()

    def test_query_limit_exceeded(self):
        """Should block when usage exceeds limit (edge case)."""
        with patch('backend.billing.get_user_subscription') as mock_sub:
            mock_sub.return_value = {
                "tier": "free",
                "status": "active",
                "queries_used": 10,  # Somehow exceeded
                "queries_limit": 5,
                "period_end": None,
                "features": []
            }

            result = check_can_query("user-123")

            assert result["can_query"] is False
            assert result["remaining"] == 0

    def test_one_query_remaining(self):
        """Should allow when exactly one query remaining."""
        with patch('backend.billing.get_user_subscription') as mock_sub:
            mock_sub.return_value = {
                "tier": "pro",
                "status": "active",
                "queries_used": 99,
                "queries_limit": 100,
                "period_end": None,
                "features": []
            }

            result = check_can_query("user-123")

            assert result["can_query"] is True
            assert result["remaining"] == 1


# =============================================================================
# get_user_subscription Tests
# =============================================================================

class TestGetUserSubscription:
    """Test subscription retrieval logic."""

    def test_returns_user_subscription_data(self):
        """Should return subscription details from database."""
        mock_profile = {
            "subscription_tier": "pro",
            "subscription_status": "active",
            "queries_used_this_period": 25,
            "subscription_period_end": "2026-02-01T00:00:00Z"
        }

        with patch('backend.billing._get_client') as mock_client:
            mock_table = MagicMock()
            # Note: billing uses .execute() without .single(), returns data as list
            mock_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[mock_profile]  # Returns list, code accesses [0]
            )
            mock_client.return_value.table.return_value = mock_table

            result = get_user_subscription("user-123")

            assert result["tier"] == "pro"
            assert result["status"] == "active"
            assert result["queries_used"] == 25
            assert result["queries_limit"] == 100  # From SUBSCRIPTION_TIERS

    def test_defaults_to_free_tier(self):
        """Should default to free tier for new users."""
        with patch('backend.billing._get_client') as mock_client:
            mock_table = MagicMock()
            # Empty data list = no profile found
            mock_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[]  # Empty list
            )
            mock_client.return_value.table.return_value = mock_table

            result = get_user_subscription("new-user")

            assert result["tier"] == "free"
            assert result["queries_limit"] == 5  # Free tier limit

    def test_includes_tier_features(self):
        """Should include features from tier config."""
        mock_profile = {
            "subscription_tier": "enterprise",
            "subscription_status": "active",
            "queries_used_this_period": 0
        }

        with patch('backend.billing._get_client') as mock_client:
            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[mock_profile]
            )
            mock_client.return_value.table.return_value = mock_table

            result = get_user_subscription("user-123")

            assert "features" in result
            assert isinstance(result["features"], list)
            assert len(result["features"]) > 0


# =============================================================================
# increment_query_usage Tests
# =============================================================================

class TestIncrementQueryUsage:
    """Test query usage increment logic."""

    def test_calls_atomic_rpc(self):
        """Should use atomic RPC function for increment."""
        with patch('backend.billing.get_supabase_service') as mock_service:
            mock_client = MagicMock()
            mock_client.rpc.return_value.execute.return_value = MagicMock(data=51)
            mock_service.return_value = mock_client

            result = increment_query_usage("user-123")

            mock_client.rpc.assert_called_once_with('increment_query_usage', {'p_user_id': 'user-123'})
            assert result == 51

    def test_returns_negative_when_service_unavailable(self):
        """Should return -1 when service client unavailable (non-blocking by default)."""
        with patch('backend.billing.get_supabase_service') as mock_service:
            with patch('backend.billing.log_billing_event'):
                mock_service.return_value = None

                # Default behavior: returns -1 to not block the user experience
                result = increment_query_usage("user-123")
                assert result == -1

    def test_returns_negative_on_rpc_failure(self):
        """Should return -1 when RPC fails (non-blocking by default)."""
        with patch('backend.billing.get_supabase_service') as mock_service:
            with patch('backend.billing.log_billing_event'):
                mock_client = MagicMock()
                mock_client.rpc.side_effect = Exception("RPC failed")
                mock_service.return_value = mock_client

                # Default behavior: returns -1 to not block the user experience
                result = increment_query_usage("user-123")
                assert result == -1

    def test_raises_when_raise_on_failure_true(self):
        """Should raise ValueError when raise_on_failure=True and RPC fails."""
        with patch('backend.billing.get_supabase_service') as mock_service:
            with patch('backend.billing.log_billing_event'):
                mock_client = MagicMock()
                mock_client.rpc.side_effect = Exception("RPC failed")
                mock_service.return_value = mock_client

                with pytest.raises(ValueError) as exc_info:
                    increment_query_usage("user-123", raise_on_failure=True)

                assert "unavailable" in str(exc_info.value).lower()


# =============================================================================
# handle_webhook_event Tests
# =============================================================================

class TestHandleWebhookEvent:
    """Test Stripe webhook handling."""

    def test_invalid_payload_returns_error(self):
        """Should return error for invalid payload."""
        with patch('backend.billing.stripe.Webhook.construct_event') as mock_construct:
            mock_construct.side_effect = ValueError("Invalid payload")

            result = handle_webhook_event(b"invalid", "sig-header")

            assert result["success"] is False
            assert "payload" in result["error"].lower()

    def test_invalid_signature_returns_error(self):
        """Should return error for invalid signature."""
        import stripe

        with patch('backend.billing.stripe.Webhook.construct_event') as mock_construct:
            mock_construct.side_effect = stripe.error.SignatureVerificationError(
                "Invalid signature", "sig-header"
            )

            result = handle_webhook_event(b"payload", "bad-sig")

            assert result["success"] is False
            assert "signature" in result["error"].lower()

    def test_successful_checkout_updates_subscription(self):
        """Should update user subscription on successful checkout."""
        # Webhook handler uses dict-style access: event["type"], event["data"]["object"]
        mock_event = {
            "id": "evt_123",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "mode": "subscription",
                    "subscription": "sub_123",
                    "metadata": {"user_id": "user-123", "tier_id": "pro"}
                }
            }
        }

        with patch('backend.billing.stripe.Webhook.construct_event', return_value=mock_event):
            with patch('backend.billing.get_supabase_service') as mock_db:
                mock_client = MagicMock()
                mock_table = MagicMock()
                mock_client.table.return_value = mock_table
                # Mock idempotency check - event not yet processed
                mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)
                mock_db.return_value = mock_client
                with patch('backend.billing.log_billing_event'):
                    result = handle_webhook_event(b"payload", "valid-sig")

                assert result["success"] is True
                assert result["event_type"] == "checkout.session.completed"

    def test_subscription_deleted_downgrades_user(self):
        """Should downgrade to free on subscription deletion."""
        mock_event = {
            "id": "evt_456",
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "metadata": {"user_id": "user-456"}
                }
            }
        }

        with patch('backend.billing.stripe.Webhook.construct_event', return_value=mock_event):
            with patch('backend.billing.get_supabase_service') as mock_db:
                mock_client = MagicMock()
                mock_table = MagicMock()
                mock_client.table.return_value = mock_table
                mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)
                mock_db.return_value = mock_client
                with patch('backend.billing.log_billing_event'):
                    result = handle_webhook_event(b"payload", "valid-sig")

                assert result["success"] is True

    def test_unknown_event_type_succeeds(self):
        """Should succeed for unhandled event types."""
        mock_event = {
            "id": "evt_789",
            "type": "some.unknown.event",
            "data": {
                "object": {}
            }
        }

        with patch('backend.billing.stripe.Webhook.construct_event', return_value=mock_event):
            with patch('backend.billing.get_supabase_service') as mock_db:
                mock_client = MagicMock()
                mock_table = MagicMock()
                mock_client.table.return_value = mock_table
                mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)
                mock_db.return_value = mock_client
                with patch('backend.billing.log_billing_event'):
                    result = handle_webhook_event(b"payload", "valid-sig")

                assert result["success"] is True


# =============================================================================
# Subscription Tier Configuration Tests
# =============================================================================

class TestSubscriptionTiersConfig:
    """Test that SUBSCRIPTION_TIERS config is valid."""

    def test_free_tier_exists(self):
        """Should have a free tier."""
        assert "free" in SUBSCRIPTION_TIERS
        assert SUBSCRIPTION_TIERS["free"]["price_monthly"] == 0

    def test_all_tiers_have_required_fields(self):
        """Should have all required fields in each tier."""
        required_fields = ["name", "price_monthly", "queries_per_month", "features"]

        for tier_id, config in SUBSCRIPTION_TIERS.items():
            for field in required_fields:
                assert field in config, f"Missing {field} in tier {tier_id}"

    def test_enterprise_has_unlimited_queries(self):
        """Should have unlimited queries for enterprise."""
        assert "enterprise" in SUBSCRIPTION_TIERS
        assert SUBSCRIPTION_TIERS["enterprise"]["queries_per_month"] == -1

    def test_prices_are_in_cents(self):
        """Should have prices in cents (not dollars)."""
        for tier_id, config in SUBSCRIPTION_TIERS.items():
            price = config["price_monthly"]
            if price > 0:
                # Prices should be > 100 (at least $1)
                assert price >= 100, f"Price {price} for {tier_id} seems like dollars not cents"

    def test_query_limits_are_reasonable(self):
        """Should have reasonable query limits."""
        for tier_id, config in SUBSCRIPTION_TIERS.items():
            limit = config["queries_per_month"]
            # Either unlimited (-1) or positive
            assert limit == -1 or limit > 0, f"Invalid limit {limit} for {tier_id}"
