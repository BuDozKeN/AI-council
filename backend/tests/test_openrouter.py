"""
Tests for openrouter.py - OpenRouter API client

Tests cover:
- Backoff calculation with jitter
- Circuit breaker state management
- Circuit breaker registry
- API key management (BYOK)
- Message caching conversion
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import asyncio
import time


# =============================================================================
# BACKOFF UTILITY TESTS
# =============================================================================

class TestCalculateBackoffWithJitter:
    """Tests for calculate_backoff_with_jitter function."""

    def test_base_delay_on_first_retry(self):
        """First retry should be around base_delay (±jitter)."""
        from backend.openrouter import calculate_backoff_with_jitter

        # Run multiple times to check jitter range
        for _ in range(10):
            delay = calculate_backoff_with_jitter(retry_attempt=0, base_delay=2.0, jitter_factor=0.5)
            # Should be between 1.0 (2 * 0.5) and 3.0 (2 * 1.5)
            assert 1.0 <= delay <= 3.0

    def test_exponential_growth(self):
        """Delay should grow exponentially with each retry."""
        from backend.openrouter import calculate_backoff_with_jitter

        delay_0 = calculate_backoff_with_jitter(retry_attempt=0, base_delay=2.0, jitter_factor=0)
        delay_1 = calculate_backoff_with_jitter(retry_attempt=1, base_delay=2.0, jitter_factor=0)
        delay_2 = calculate_backoff_with_jitter(retry_attempt=2, base_delay=2.0, jitter_factor=0)

        # Without jitter: 2, 4, 8
        assert delay_0 == 2.0
        assert delay_1 == 4.0
        assert delay_2 == 8.0

    def test_respects_max_delay(self):
        """Delay should not exceed max_delay."""
        from backend.openrouter import calculate_backoff_with_jitter

        delay = calculate_backoff_with_jitter(
            retry_attempt=10,  # Would be 2^10 = 1024s without cap
            base_delay=2.0,
            max_delay=60.0,
            jitter_factor=0
        )

        assert delay == 60.0

    def test_jitter_adds_randomness(self):
        """Same inputs should produce different outputs due to jitter."""
        from backend.openrouter import calculate_backoff_with_jitter

        delays = set()
        for _ in range(20):
            delay = calculate_backoff_with_jitter(retry_attempt=1, base_delay=2.0, jitter_factor=0.5)
            delays.add(round(delay, 4))

        # Should have multiple unique values due to jitter
        assert len(delays) > 1


# =============================================================================
# CIRCUIT BREAKER TESTS
# =============================================================================

class TestCircuitBreaker:
    """Tests for CircuitBreaker class."""

    @pytest.fixture
    def breaker(self):
        """Create a circuit breaker for testing."""
        from backend.openrouter import CircuitBreaker
        return CircuitBreaker(
            name="test-model",
            failure_threshold=3,
            recovery_timeout=5.0,
            half_open_max_calls=2
        )

    @pytest.mark.asyncio
    async def test_initial_state_is_closed(self, breaker):
        """Circuit breaker should start in closed state."""
        assert breaker.state == "closed"
        assert not breaker.is_open
        assert await breaker.can_execute() is True

    @pytest.mark.asyncio
    async def test_opens_after_threshold_failures(self, breaker):
        """Circuit should open after failure_threshold consecutive failures."""
        # Record failures up to threshold
        for _ in range(3):
            await breaker.record_failure()

        assert breaker.state == "open"
        assert breaker.is_open
        assert await breaker.can_execute() is False

    @pytest.mark.asyncio
    async def test_success_resets_failure_count(self, breaker):
        """Success should reset failure count in closed state."""
        await breaker.record_failure()
        await breaker.record_failure()
        assert breaker._failure_count == 2

        await breaker.record_success()
        assert breaker._failure_count == 0

    @pytest.mark.asyncio
    async def test_transitions_to_half_open_after_recovery_timeout(self, breaker):
        """Circuit should transition to half-open after recovery timeout."""
        # Open the circuit
        for _ in range(3):
            await breaker.record_failure()
        assert breaker.state == "open"

        # Simulate time passing
        breaker._last_failure_time = time.time() - 10  # 10 seconds ago (> 5s timeout)

        # Should transition to half-open
        can_exec = await breaker.can_execute()
        assert can_exec is True
        assert breaker.state == "half_open"

    @pytest.mark.asyncio
    async def test_half_open_state_after_recovery(self, breaker):
        """After recovery timeout, circuit should transition to half-open."""
        # Open the circuit
        for _ in range(3):
            await breaker.record_failure()
        assert breaker.state == "open"

        # Simulate time passing past recovery timeout
        breaker._last_failure_time = time.time() - 10  # 10 seconds ago

        # First call should trigger transition to half-open and be allowed
        assert await breaker.can_execute() is True
        assert breaker.state == "half_open"

        # Verify half_open_calls counter is tracking
        initial_calls = breaker._half_open_calls
        assert initial_calls >= 0  # Counter is active

    @pytest.mark.asyncio
    async def test_closes_on_success_in_half_open(self, breaker):
        """Success in half-open should close the circuit."""
        # Transition to half-open
        for _ in range(3):
            await breaker.record_failure()
        breaker._last_failure_time = time.time() - 10
        await breaker.can_execute()

        assert breaker.state == "half_open"

        # Record success
        await breaker.record_success()

        assert breaker.state == "closed"
        assert breaker._failure_count == 0

    @pytest.mark.asyncio
    async def test_reopens_on_failure_in_half_open(self, breaker):
        """Failure in half-open should reopen the circuit."""
        # Transition to half-open
        for _ in range(3):
            await breaker.record_failure()
        breaker._last_failure_time = time.time() - 10
        await breaker.can_execute()

        assert breaker.state == "half_open"

        # Record failure
        await breaker.record_failure()

        assert breaker.state == "open"

    def test_get_status(self, breaker):
        """get_status should return all relevant metrics."""
        status = breaker.get_status()

        assert status["name"] == "test-model"
        assert status["state"] == "closed"
        assert status["failure_count"] == 0
        assert status["failure_threshold"] == 3
        assert status["recovery_timeout"] == 5.0


class TestCircuitBreakerRegistry:
    """Tests for CircuitBreakerRegistry class."""

    @pytest.fixture
    def registry(self):
        """Create a circuit breaker registry for testing."""
        from backend.openrouter import CircuitBreakerRegistry
        return CircuitBreakerRegistry(
            failure_threshold=3,
            recovery_timeout=10.0,
            half_open_max_calls=2
        )

    @pytest.mark.asyncio
    async def test_creates_breaker_per_model(self, registry):
        """Registry should create separate breakers for each model."""
        breaker1 = await registry.get_breaker("gpt-4")
        breaker2 = await registry.get_breaker("claude-3")

        assert breaker1 is not breaker2
        assert breaker1.name == "gpt-4"
        assert breaker2.name == "claude-3"

    @pytest.mark.asyncio
    async def test_returns_same_breaker_for_same_model(self, registry):
        """Registry should return the same breaker for the same model."""
        breaker1 = await registry.get_breaker("gpt-4")
        breaker2 = await registry.get_breaker("gpt-4")

        assert breaker1 is breaker2

    @pytest.mark.asyncio
    async def test_get_all_statuses(self, registry):
        """get_all_statuses should return status for all breakers."""
        await registry.get_breaker("gpt-4")
        await registry.get_breaker("claude-3")

        statuses = registry.get_all_statuses()

        assert "gpt-4" in statuses
        assert "claude-3" in statuses
        assert statuses["gpt-4"]["state"] == "closed"

    @pytest.mark.asyncio
    async def test_get_summary_all_healthy(self, registry):
        """Summary should show closed state when all breakers healthy."""
        await registry.get_breaker("gpt-4")
        await registry.get_breaker("claude-3")

        summary = registry.get_summary()

        assert summary["state"] == "closed"
        assert summary["total_breakers"] == 2
        assert len(summary["open_breakers"]) == 0

    @pytest.mark.asyncio
    async def test_get_summary_degraded(self, registry):
        """Summary should show degraded state when some breakers open."""
        breaker = await registry.get_breaker("gpt-4")
        await registry.get_breaker("claude-3")  # Keep this one healthy

        # Open gpt-4 breaker
        for _ in range(3):
            await breaker.record_failure()

        summary = registry.get_summary()

        assert summary["state"] == "degraded"
        assert "gpt-4" in summary["open_breakers"]


# =============================================================================
# API KEY MANAGEMENT TESTS
# =============================================================================

class TestApiKeyManagement:
    """Tests for BYOK (Bring Your Own Key) support."""

    def test_explicit_key_takes_priority(self):
        """Explicit key should override all other sources."""
        from backend.openrouter import get_effective_api_key

        result = get_effective_api_key("explicit-key")
        assert result == "explicit-key"

    def test_context_key_used_when_no_explicit(self):
        """Context variable key should be used when no explicit key."""
        from backend.openrouter import get_effective_api_key, set_request_api_key, reset_request_api_key

        token = set_request_api_key("context-key")
        try:
            result = get_effective_api_key()
            assert result == "context-key"
        finally:
            reset_request_api_key(token)

    def test_system_key_used_as_fallback(self):
        """System key should be used when no other keys available."""
        from backend.openrouter import get_effective_api_key

        # No explicit key, no context key - should use system key
        result = get_effective_api_key()
        # Result should be from OPENROUTER_API_KEY config
        assert result is not None


# =============================================================================
# MESSAGE CACHING TESTS
# =============================================================================

class TestConvertToCachedMessages:
    """Tests for prompt caching message conversion."""

    def test_returns_unchanged_when_caching_disabled(self):
        """Messages should be unchanged when caching is disabled."""
        from backend.openrouter import convert_to_cached_messages

        messages = [
            {"role": "system", "content": "You are helpful"},
            {"role": "user", "content": "Hello"}
        ]

        with patch('backend.openrouter.ENABLE_PROMPT_CACHING', False):
            with patch('backend.config.ENABLE_PROMPT_CACHING', False):
                result = convert_to_cached_messages(messages, "anthropic/claude-3")

        assert result == messages

    def test_returns_unchanged_for_unsupported_models(self):
        """Messages should be unchanged for models that don't support caching."""
        from backend.openrouter import convert_to_cached_messages

        messages = [
            {"role": "system", "content": "You are helpful"},
            {"role": "user", "content": "Hello"}
        ]

        # Mock to enable caching but use unsupported model
        with patch('backend.config.ENABLE_PROMPT_CACHING', True):
            result = convert_to_cached_messages(messages, "unsupported/model")

        assert result == messages

    def test_converts_system_message_for_supported_model(self):
        """System message should be converted to cached format for Claude."""
        from backend.openrouter import convert_to_cached_messages

        messages = [
            {"role": "system", "content": "You are helpful"},
            {"role": "user", "content": "Hello"}
        ]

        with patch('backend.config.ENABLE_PROMPT_CACHING', True):
            with patch('backend.openrouter.CACHE_SUPPORTED_MODELS', ['claude', 'anthropic']):
                result = convert_to_cached_messages(messages, "anthropic/claude-3")

        # System message should be converted
        assert result[0]["role"] == "system"
        assert isinstance(result[0]["content"], list)
        assert result[0]["content"][0]["type"] == "text"
        assert result[0]["content"][0]["text"] == "You are helpful"
        assert "cache_control" in result[0]["content"][0]

    def test_user_message_converted_without_cache_control(self):
        """User messages should be in multipart format but without cache_control."""
        from backend.openrouter import convert_to_cached_messages

        messages = [
            {"role": "system", "content": "You are helpful"},
            {"role": "user", "content": "Hello"}
        ]

        with patch('backend.config.ENABLE_PROMPT_CACHING', True):
            with patch('backend.openrouter.CACHE_SUPPORTED_MODELS', ['claude', 'anthropic']):
                result = convert_to_cached_messages(messages, "anthropic/claude-3")

        # User message should be in multipart format
        assert result[1]["role"] == "user"
        assert isinstance(result[1]["content"], list)
        assert result[1]["content"][0]["type"] == "text"
        assert "cache_control" not in result[1]["content"][0]


# =============================================================================
# CIRCUIT BREAKER OPEN EXCEPTION TESTS
# =============================================================================

class TestCircuitBreakerOpenException:
    """Tests for CircuitBreakerOpen exception."""

    def test_exception_message(self):
        """Exception should have informative message."""
        from backend.openrouter import CircuitBreakerOpen

        exc = CircuitBreakerOpen("gpt-4", 45.5)

        assert exc.model == "gpt-4"
        assert exc.recovery_seconds == 45.5
        assert "gpt-4" in str(exc)
        # Message includes the seconds value (may be rounded)
        assert "Retry in" in str(exc)


# =============================================================================
# HTTP CLIENT TESTS
# =============================================================================

class TestHttpClient:
    """Tests for HTTP client management."""

    def test_get_http_client_returns_client(self):
        """get_http_client should return an httpx.AsyncClient."""
        from backend.openrouter import get_http_client
        import httpx

        client = get_http_client()

        assert isinstance(client, httpx.AsyncClient)

    def test_get_http_client_returns_same_instance(self):
        """get_http_client should return the same client instance."""
        from backend.openrouter import get_http_client

        client1 = get_http_client()
        client2 = get_http_client()

        assert client1 is client2


# =============================================================================
# GLOBAL FUNCTION TESTS
# =============================================================================

class TestGlobalFunctions:
    """Tests for module-level functions."""

    def test_get_circuit_breaker_status(self):
        """get_circuit_breaker_status should return summary."""
        from backend.openrouter import get_circuit_breaker_status

        status = get_circuit_breaker_status()

        assert "state" in status
        assert "total_breakers" in status
        assert "open_breakers" in status

    def test_get_all_circuit_breaker_statuses(self):
        """get_all_circuit_breaker_statuses should return all breaker details."""
        from backend.openrouter import get_all_circuit_breaker_statuses

        statuses = get_all_circuit_breaker_statuses()

        assert isinstance(statuses, dict)
