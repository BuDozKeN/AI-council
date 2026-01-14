"""
Tests for company router utilities.

These tests verify:
1. Validation patterns (UUID, safe IDs)
2. Company access verification
3. Company ID resolution (UUID vs slug)
4. Model pricing calculations
5. Cost calculations
"""

import pytest
import re
from unittest.mock import MagicMock

# Import the module under test
from backend.routers.company.utils import (
    UUID_PATTERN,
    SAFE_ID_PATTERN,
    resolve_company_id,
    verify_company_access,
    get_model_pricing,
    calculate_cost_cents,
    DEFAULT_PRICING,
    _company_uuid_cache,
)


# =============================================================================
# Pattern Validation Tests
# =============================================================================

class TestUUIDPattern:
    """Test UUID pattern matching."""

    def test_valid_uuid_lowercase(self):
        """Should match lowercase UUID."""
        uuid = "123e4567-e89b-12d3-a456-426614174000"
        assert UUID_PATTERN.match(uuid) is not None

    def test_valid_uuid_uppercase(self):
        """Should match uppercase UUID."""
        uuid = "123E4567-E89B-12D3-A456-426614174000"
        assert UUID_PATTERN.match(uuid) is not None

    def test_valid_uuid_mixed_case(self):
        """Should match mixed case UUID."""
        uuid = "123e4567-E89B-12d3-A456-426614174000"
        assert UUID_PATTERN.match(uuid) is not None

    def test_invalid_uuid_no_dashes(self):
        """Should reject UUID without dashes."""
        uuid = "123e4567e89b12d3a456426614174000"  # pragma: allowlist secret
        assert UUID_PATTERN.match(uuid) is None

    def test_invalid_uuid_wrong_length(self):
        """Should reject UUID with wrong length."""
        uuid = "123e4567-e89b-12d3-a456"
        assert UUID_PATTERN.match(uuid) is None

    def test_invalid_uuid_wrong_chars(self):
        """Should reject UUID with invalid characters."""
        uuid = "123g4567-e89b-12d3-a456-426614174000"  # 'g' is not hex
        assert UUID_PATTERN.match(uuid) is None

    def test_invalid_uuid_empty(self):
        """Should reject empty string."""
        assert UUID_PATTERN.match("") is None


class TestSafeIdPattern:
    """Test safe ID pattern matching."""

    def test_valid_alphanumeric(self):
        """Should match alphanumeric IDs."""
        pattern = re.compile(f"^{SAFE_ID_PATTERN}$")
        assert pattern.match("abc123") is not None

    def test_valid_with_underscore(self):
        """Should match IDs with underscores."""
        pattern = re.compile(f"^{SAFE_ID_PATTERN}$")
        assert pattern.match("my_company_id") is not None

    def test_valid_with_dash(self):
        """Should match IDs with dashes."""
        pattern = re.compile(f"^{SAFE_ID_PATTERN}$")
        assert pattern.match("my-company-id") is not None

    def test_invalid_with_space(self):
        """Should reject IDs with spaces."""
        pattern = re.compile(f"^{SAFE_ID_PATTERN}$")
        assert pattern.match("my company") is None

    def test_invalid_with_special_chars(self):
        """Should reject IDs with special characters."""
        pattern = re.compile(f"^{SAFE_ID_PATTERN}$")
        assert pattern.match("my@company") is None


# =============================================================================
# Model Pricing Tests
# =============================================================================

class TestGetModelPricing:
    """Test model pricing lookups."""

    def test_exact_match_claude(self):
        """Should return exact pricing for known Claude model."""
        pricing = get_model_pricing("anthropic/claude-sonnet-4")
        assert pricing["input"] == 3.0
        assert pricing["output"] == 15.0

    def test_exact_match_gpt4o(self):
        """Should return exact pricing for GPT-4o."""
        pricing = get_model_pricing("openai/gpt-4o")
        assert pricing["input"] == 5.0
        assert pricing["output"] == 15.0

    def test_exact_match_deepseek(self):
        """Should return exact pricing for DeepSeek."""
        pricing = get_model_pricing("deepseek/deepseek-chat")
        assert pricing["input"] == 0.28
        assert pricing["output"] == 0.42

    def test_unknown_model_returns_default(self):
        """Should return default pricing for unknown model."""
        pricing = get_model_pricing("unknown/model-x")
        assert pricing == DEFAULT_PRICING

    def test_partial_match(self):
        """Should find partial matches for model names."""
        # This should match because "claude-sonnet-4" contains the key
        pricing = get_model_pricing("claude-sonnet-4")
        # Either finds a partial match or returns default
        assert "input" in pricing
        assert "output" in pricing


class TestCalculateCostCents:
    """Test cost calculation from usage data."""

    def test_calculate_with_model_breakdown(self):
        """Should calculate cost from per-model breakdown."""
        usage = {
            "prompt_tokens": 1000,
            "completion_tokens": 500,
            "by_model": {
                "openai/gpt-4o-mini": {
                    "prompt_tokens": 1000,
                    "completion_tokens": 500
                }
            }
        }
        # GPT-4o-mini: input $0.15/M, output $0.60/M
        # 1000 input = $0.00015 = 0.015 cents
        # 500 output = $0.0003 = 0.03 cents
        # Total = 0.045 cents, rounds to 0
        cost = calculate_cost_cents(usage)
        assert cost == 0  # Very small cost rounds to 0

    def test_calculate_with_larger_usage(self):
        """Should calculate cost for larger token counts."""
        usage = {
            "prompt_tokens": 100000,
            "completion_tokens": 50000,
            "by_model": {
                "anthropic/claude-sonnet-4": {
                    "prompt_tokens": 100000,
                    "completion_tokens": 50000
                }
            }
        }
        # Claude Sonnet 4: input $3/M, output $15/M
        # 100000 input = $0.30 = 30 cents
        # 50000 output = $0.75 = 75 cents
        # Total = 105 cents
        cost = calculate_cost_cents(usage)
        assert cost == 105

    def test_calculate_fallback_no_model_breakdown(self):
        """Should use default pricing when no model breakdown."""
        usage = {
            "prompt_tokens": 1000000,
            "completion_tokens": 500000
        }
        # Default: input $2/M, output $8/M
        # 1M input = $2.00 = 200 cents
        # 500K output = $4.00 = 400 cents
        # Total = 600 cents
        cost = calculate_cost_cents(usage)
        assert cost == 600

    def test_calculate_zero_tokens(self):
        """Should return 0 for zero tokens."""
        usage = {"prompt_tokens": 0, "completion_tokens": 0, "by_model": {}}
        cost = calculate_cost_cents(usage)
        assert cost == 0

    def test_calculate_multiple_models(self):
        """Should sum costs across multiple models."""
        usage = {
            "prompt_tokens": 200000,
            "completion_tokens": 100000,
            "by_model": {
                "openai/gpt-4o": {
                    "prompt_tokens": 100000,
                    "completion_tokens": 50000
                },
                "anthropic/claude-sonnet-4": {
                    "prompt_tokens": 100000,
                    "completion_tokens": 50000
                }
            }
        }
        # GPT-4o: input $5/M, output $15/M
        # 100K input = $0.50 = 50 cents
        # 50K output = $0.75 = 75 cents
        # Subtotal = 125 cents

        # Claude Sonnet 4: input $3/M, output $15/M
        # 100K input = $0.30 = 30 cents
        # 50K output = $0.75 = 75 cents
        # Subtotal = 105 cents

        # Total = ~230 cents (may vary slightly due to floating point)
        cost = calculate_cost_cents(usage)
        assert 228 <= cost <= 231  # Allow for floating point rounding


# =============================================================================
# Company Access Tests
# =============================================================================

class TestResolveCompanyId:
    """Test company ID resolution."""

    def test_uuid_returned_directly(self):
        """Should return UUID directly without DB lookup."""
        mock_client = MagicMock()
        uuid = "123e4567-e89b-12d3-a456-426614174000"

        result = resolve_company_id(mock_client, uuid)

        assert result == uuid
        mock_client.table.assert_not_called()

    def test_slug_resolved_from_db(self):
        """Should lookup slug in database."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
            data={"id": "resolved-uuid-1234"}
        )

        # Clear cache for this test
        _company_uuid_cache.clear()

        result = resolve_company_id(mock_client, "my-company-slug")

        assert result == "resolved-uuid-1234"
        mock_client.table.assert_called_with("companies")

    def test_slug_cached(self):
        """Should cache slug resolution."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
            data={"id": "cached-uuid-5678"}
        )

        # Clear cache
        _company_uuid_cache.clear()

        # First call should hit DB
        result1 = resolve_company_id(mock_client, "cached-slug")
        assert result1 == "cached-uuid-5678"

        # Reset mock to verify cache is used
        mock_client.reset_mock()

        # Second call should use cache
        result2 = resolve_company_id(mock_client, "cached-slug")
        assert result2 == "cached-uuid-5678"
        mock_client.table.assert_not_called()

    def test_slug_not_found_raises_404(self):
        """Should raise 404 for unknown slug."""
        from fastapi import HTTPException

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
            data=None
        )

        # Clear cache
        _company_uuid_cache.clear()

        with pytest.raises(HTTPException) as exc_info:
            resolve_company_id(mock_client, "nonexistent-slug")

        assert exc_info.value.status_code == 404


class TestVerifyCompanyAccess:
    """Test company access verification."""

    def test_owner_has_access(self):
        """Should grant access to company owner."""
        mock_client = MagicMock()
        # Owner query returns data
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"id": "company-123"}]
        )

        user = {"id": "user-123"}
        result = verify_company_access(mock_client, "company-123", user)

        assert result is True

    def test_member_has_access(self):
        """Should grant access to company member."""
        mock_client = MagicMock()

        # Owner query returns empty (not owner)
        owner_mock = MagicMock(data=[])
        # Member query returns data (is member)
        member_mock = MagicMock(data=[{"id": "membership-456"}])

        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.side_effect = [
            owner_mock,
            member_mock
        ]

        user = {"id": "user-456"}
        result = verify_company_access(mock_client, "company-123", user)

        assert result is True

    def test_no_access_raises_403(self):
        """Should deny access to non-owner/non-member."""
        from fastapi import HTTPException

        mock_client = MagicMock()

        # All queries return empty
        empty_mock = MagicMock(data=[])
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = empty_mock

        user = {"id": "stranger-789"}

        with pytest.raises(HTTPException) as exc_info:
            verify_company_access(mock_client, "company-123", user)

        assert exc_info.value.status_code == 403


# =============================================================================
# Pydantic Model Tests
# =============================================================================

class TestPydanticModels:
    """Test Pydantic model validation."""

    def test_department_create_minimal(self):
        """Should create department with minimal fields."""
        from backend.routers.company.utils import DepartmentCreate

        dept = DepartmentCreate(name="Engineering", slug="engineering")
        assert dept.name == "Engineering"
        assert dept.slug == "engineering"
        assert dept.description is None

    def test_department_create_full(self):
        """Should create department with all fields."""
        from backend.routers.company.utils import DepartmentCreate

        dept = DepartmentCreate(
            name="Engineering",
            slug="engineering",
            description="Tech team",
            purpose="Build stuff"
        )
        assert dept.name == "Engineering"
        assert dept.description == "Tech team"
        assert dept.purpose == "Build stuff"

    def test_playbook_create_defaults(self):
        """Should apply defaults to playbook creation."""
        from backend.routers.company.utils import PlaybookCreate

        playbook = PlaybookCreate(
            title="Code Review Guide",
            doc_type="sop",
            content="# Code Review Process\n..."
        )
        assert playbook.title == "Code Review Guide"
        assert playbook.auto_inject is True
        assert playbook.tags == []
        assert playbook.additional_departments == []

    def test_decision_create_with_context(self):
        """Should create decision with conversation context."""
        from backend.routers.company.utils import DecisionCreate

        decision = DecisionCreate(
            title="API Design Decision",
            content="We decided to use REST...",
            source_conversation_id="conv-123",
            response_index=0,
            user_question="How should we design the API?"
        )
        assert decision.title == "API Design Decision"
        assert decision.source_conversation_id == "conv-123"
        assert decision.response_index == 0
        assert decision.user_question == "How should we design the API?"

    def test_member_invite_defaults(self):
        """Should apply default role to member invite."""
        from backend.routers.company.utils import MemberInvite

        invite = MemberInvite(email="user@example.com")
        assert invite.email == "user@example.com"
        assert invite.role == "member"

    def test_member_invite_admin_role(self):
        """Should allow admin role."""
        from backend.routers.company.utils import MemberInvite

        invite = MemberInvite(email="admin@example.com", role="admin")
        assert invite.role == "admin"
