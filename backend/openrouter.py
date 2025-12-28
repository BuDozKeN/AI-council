"""OpenRouter API client for making LLM requests."""

import httpx
import json
import asyncio
import contextvars
import time
from typing import List, Dict, Any, Optional, AsyncGenerator
from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL
from .config import MOCK_LLM as _MOCK_LLM_INITIAL
from .config import ENABLE_PROMPT_CACHING, CACHE_SUPPORTED_MODELS


# =============================================================================
# CIRCUIT BREAKER IMPLEMENTATION
# =============================================================================
# Prevents cascading failures when OpenRouter is down by failing fast
# after a threshold of failures, then gradually recovering.

class CircuitBreaker:
    """
    Circuit breaker pattern for OpenRouter API resilience.

    States:
    - CLOSED: Normal operation, requests go through
    - OPEN: Too many failures, requests fail immediately
    - HALF_OPEN: Testing if service recovered, limited requests allowed
    """

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_max_calls: int = 3
    ):
        """
        Initialize circuit breaker.

        Args:
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before attempting recovery
            half_open_max_calls: Max calls allowed in half-open state
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = self.CLOSED
        self._failure_count = 0
        self._last_failure_time: Optional[float] = None
        self._half_open_calls = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> str:
        """Get current circuit state."""
        return self._state

    @property
    def is_open(self) -> bool:
        """Check if circuit is open (blocking requests)."""
        return self._state == self.OPEN

    async def can_execute(self) -> bool:
        """
        Check if a request can be executed.

        Returns:
            True if request should proceed, False if circuit is open
        """
        async with self._lock:
            if self._state == self.CLOSED:
                return True

            if self._state == self.OPEN:
                # Check if recovery timeout has passed
                if self._last_failure_time and \
                   time.time() - self._last_failure_time >= self.recovery_timeout:
                    # Transition to half-open
                    self._state = self.HALF_OPEN
                    self._half_open_calls = 0
                    return True
                return False

            if self._state == self.HALF_OPEN:
                # Allow limited calls in half-open state
                if self._half_open_calls < self.half_open_max_calls:
                    self._half_open_calls += 1
                    return True
                return False

            return True

    async def record_success(self) -> None:
        """Record a successful request."""
        async with self._lock:
            if self._state == self.HALF_OPEN:
                # Success in half-open means service recovered
                self._state = self.CLOSED
                self._failure_count = 0
                self._half_open_calls = 0
            elif self._state == self.CLOSED:
                # Reset failure count on success
                self._failure_count = 0

    async def record_failure(self) -> None:
        """Record a failed request."""
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()

            if self._state == self.HALF_OPEN:
                # Failure in half-open means service still down
                self._state = self.OPEN
                self._half_open_calls = 0
            elif self._state == self.CLOSED:
                if self._failure_count >= self.failure_threshold:
                    self._state = self.OPEN

    def get_status(self) -> Dict[str, Any]:
        """Get circuit breaker status for monitoring."""
        return {
            "state": self._state,
            "failure_count": self._failure_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
            "last_failure": self._last_failure_time,
            "seconds_until_recovery": max(
                0,
                self.recovery_timeout - (time.time() - (self._last_failure_time or 0))
            ) if self._last_failure_time else None
        }


# Global circuit breaker instance for OpenRouter
_circuit_breaker = CircuitBreaker(
    failure_threshold=5,      # Open after 5 consecutive failures
    recovery_timeout=60.0,    # Wait 60s before trying again
    half_open_max_calls=3     # Allow 3 test calls in half-open
)


class CircuitBreakerOpen(Exception):
    """Raised when circuit breaker is open and blocking requests."""
    def __init__(self, recovery_seconds: float):
        self.recovery_seconds = recovery_seconds
        super().__init__(
            f"OpenRouter circuit breaker is open. "
            f"Service appears unavailable. Retry in {recovery_seconds:.0f}s."
        )


def get_circuit_breaker_status() -> Dict[str, Any]:
    """Get the current circuit breaker status for monitoring/health checks."""
    return _circuit_breaker.get_status()

# Context variable for per-request API key override (BYOK)
# This allows setting the API key at the request level without threading it through all functions
_request_api_key: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar('request_api_key', default=None)


def set_request_api_key(key: Optional[str]) -> contextvars.Token:
    """
    Set the API key for the current async context (for BYOK support).
    Returns a token that can be used to reset the value.

    Usage:
        token = set_request_api_key(user_key)
        try:
            # All openrouter calls in this context will use user_key
            await query_model(...)
        finally:
            reset_request_api_key(token)
    """
    return _request_api_key.set(key)


def reset_request_api_key(token: contextvars.Token):
    """Reset the API key to its previous value using the token from set_request_api_key."""
    _request_api_key.reset(token)


def get_effective_api_key(explicit_key: Optional[str] = None) -> str:
    """
    Get the API key to use for a request.

    Priority:
    1. Explicitly passed key (function parameter)
    2. Context variable key (set via set_request_api_key)
    3. System key (OPENROUTER_API_KEY from environment)
    """
    if explicit_key:
        return explicit_key
    context_key = _request_api_key.get()
    if context_key:
        return context_key
    return OPENROUTER_API_KEY

# Module-level mock mode flag (can be changed at runtime via API)
MOCK_LLM = _MOCK_LLM_INITIAL

# Shared HTTP client with connection pooling for better performance
# This prevents connection exhaustion when making multiple parallel requests
_http_client: Optional[httpx.AsyncClient] = None

def get_http_client(timeout: float = 120.0) -> httpx.AsyncClient:
    """Get or create a shared HTTP client with connection pooling."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        # Create client with generous connection limits and timeouts
        # Increased from 20 to 100 to support 20 concurrent council queries
        # (each council query uses 5 models in parallel)
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=30.0),  # 30s connect timeout
            limits=httpx.Limits(
                max_connections=100,           # Support 20 concurrent councils
                max_keepalive_connections=50,  # Keep 50 warm connections
                keepalive_expiry=30.0          # Prevent stale connections
            ),
            http2=True  # Enable HTTP/2 for better multiplexing
        )
    return _http_client

# Conditional import of mock functions when mock mode is enabled
# These will be set dynamically if mock mode is toggled via API
generate_mock_response = None
generate_mock_response_stream = None

if MOCK_LLM:
    from .mock_llm import generate_mock_response, generate_mock_response_stream


def convert_to_cached_messages(
    messages: List[Dict[str, Any]],
    model: str
) -> List[Dict[str, Any]]:
    """
    Convert standard messages to cached format for supported models.

    KILL SWITCH: Set ENABLE_PROMPT_CACHING=false in .env to disable this.

    When caching is enabled and model supports it:
    - System message content is wrapped with cache_control
    - This allows OpenRouter to cache the static context

    When caching is disabled OR model doesn't support it:
    - Returns messages unchanged (standard format)

    Args:
        messages: Standard message list [{"role": "system", "content": "..."}]
        model: The model identifier to check for cache support

    Returns:
        Messages in cached format if applicable, otherwise unchanged
    """
    # KILL SWITCH CHECK - read from config dynamically to support runtime toggle
    from .config import ENABLE_PROMPT_CACHING as caching_enabled
    if not caching_enabled:
        return messages

    # Check if model supports cache_control
    model_supports_cache = any(
        supported in model for supported in CACHE_SUPPORTED_MODELS
    )

    if not model_supports_cache:
        return messages

    # Convert messages to cached format
    cached_messages = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "system" and isinstance(content, str) and content:
            # Convert system message to multipart format with cache_control
            cached_messages.append({
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": content,
                        "cache_control": {"type": "ephemeral"}
                    }
                ]
            })
        elif role == "user" and isinstance(content, str) and content:
            # Keep user messages in multipart format for consistency
            # but without cache_control (dynamic content)
            cached_messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": content
                    }
                ]
            })
        else:
            # Keep other messages unchanged
            cached_messages.append(msg)

    return cached_messages


async def query_model(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0,
    api_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Query a single model via OpenRouter API.

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds
        api_key: Optional API key override (for BYOK). Uses system key if not provided.

    Returns:
        Response dict with 'content' and optional 'reasoning_details', or None if failed

    Raises:
        CircuitBreakerOpen: If circuit breaker is open due to repeated failures
    """
    # === MOCK MODE INTERCEPT ===
    if MOCK_LLM:
        return await generate_mock_response(model, messages)

    # === CIRCUIT BREAKER CHECK ===
    if not await _circuit_breaker.can_execute():
        status = _circuit_breaker.get_status()
        raise CircuitBreakerOpen(status.get("seconds_until_recovery", 60))

    # === REAL API CALL ===
    # Use provided API key, context variable, or fall back to system key
    effective_key = get_effective_api_key(api_key)
    headers = {
        "Authorization": f"Bearer {effective_key}",
        "Content-Type": "application/json",
    }

    # Apply prompt caching if enabled (KILL SWITCH: set ENABLE_PROMPT_CACHING=false to disable)
    cached_messages = convert_to_cached_messages(messages, model)

    payload = {
        "model": model,
        "messages": cached_messages,
        "max_tokens": 4096,  # Explicit limit to prevent truncation (especially for DeepSeek)
    }

    try:
        # Use shared HTTP client for connection pooling (same as streaming)
        client = get_http_client(timeout)
        response = await client.post(
            OPENROUTER_API_URL,
            headers=headers,
            json=payload
        )
        response.raise_for_status()

        data = response.json()
        message = data['choices'][0]['message']

        # Record success with circuit breaker
        await _circuit_breaker.record_success()

        # Extract usage data for cost tracking
        usage = data.get('usage', {})

        return {
            'content': message.get('content'),
            'reasoning_details': message.get('reasoning_details'),
            'usage': {
                'prompt_tokens': usage.get('prompt_tokens', 0),
                'completion_tokens': usage.get('completion_tokens', 0),
                'total_tokens': usage.get('total_tokens', 0),
                # Cache-specific metrics (Anthropic/Gemini)
                'cache_creation_input_tokens': usage.get('cache_creation_input_tokens', 0),
                'cache_read_input_tokens': usage.get('cache_read_input_tokens', 0),
            },
            'model': model,
        }

    except httpx.TimeoutException:
        await _circuit_breaker.record_failure()
        return None
    except httpx.HTTPStatusError as e:
        # Only count 5xx errors as failures (server issues)
        # 4xx errors are client issues, not service failures
        if e.response.status_code >= 500:
            await _circuit_breaker.record_failure()
        return None
    except (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError):
        # Connection errors indicate service issues
        await _circuit_breaker.record_failure()
        return None
    except Exception:
        return None


async def query_model_stream(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0,
    max_retries: int = 3,
    api_key: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Query a single model via OpenRouter API with streaming.

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds
        max_retries: Number of retries for overloaded/rate-limited errors
        api_key: Optional API key override (for BYOK). Uses system key if not provided.

    Yields:
        Text chunks as they arrive from the model
    """
    # === MOCK MODE INTERCEPT ===
    if MOCK_LLM:
        async for chunk in generate_mock_response_stream(model, messages):
            yield chunk
        return

    # === CIRCUIT BREAKER CHECK ===
    if not await _circuit_breaker.can_execute():
        status = _circuit_breaker.get_status()
        recovery_secs = status.get("seconds_until_recovery", 60)
        yield f"[Error: AI Council temporarily unavailable. Please retry in {recovery_secs:.0f}s]"
        return

    # === REAL API CALL ===
    # Use provided API key, context variable, or fall back to system key
    effective_key = get_effective_api_key(api_key)
    headers = {
        "Authorization": f"Bearer {effective_key}",
        "Content-Type": "application/json",
    }

    # Apply prompt caching if enabled (KILL SWITCH: set ENABLE_PROMPT_CACHING=false to disable)
    cached_messages = convert_to_cached_messages(messages, model)

    payload = {
        "model": model,
        "messages": cached_messages,
        "stream": True,
        "max_tokens": 16384,  # Higher limit to prevent truncation
    }

    retries = 0
    should_retry = False
    stream_succeeded = False

    # Use the shared HTTP client for connection pooling
    client = get_http_client(timeout)

    while retries <= max_retries:
        should_retry = False
        try:
            async with client.stream(
                "POST",
                OPENROUTER_API_URL,
                headers=headers,
                json=payload
            ) as response:
                # Check for HTTP errors BEFORE reading stream - this lets us capture error body
                if response.status_code >= 400:
                    # Record failure for 5xx errors
                    if response.status_code >= 500:
                        await _circuit_breaker.record_failure()
                    yield f"[Error: Status {response.status_code}]"
                    return

                line_count = 0
                token_count = 0
                finish_reason = None
                usage_data = None  # Capture usage from final chunk
                async for line in response.aiter_lines():
                    line_count += 1
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        if data_str.strip() == "[DONE]":
                            # Successfully completed - record success
                            await _circuit_breaker.record_success()
                            # Yield usage data as final event if captured
                            if usage_data:
                                yield f"[USAGE:{json.dumps(usage_data)}]"
                            return
                        try:
                            data = json.loads(data_str)

                            # Check for error response (Overloaded, rate limit, server errors, etc.)
                            if 'error' in data:
                                error_msg = data['error'].get('message', 'Unknown error')
                                error_code = data['error'].get('code', 0)

                                # Retry on overloaded, rate limit, or server errors (500, 503)
                                is_retryable = (
                                    'overloaded' in error_msg.lower() or
                                    'rate' in error_msg.lower() or
                                    'internal server' in error_msg.lower() or
                                    error_code in [429, 500, 502, 503, 504]
                                )
                                if is_retryable and retries < max_retries:
                                    should_retry = True
                                    # Use exponential backoff: 5s, 10s (longer for rate limits)
                                    wait_time = (retries + 1) * 5
                                    await asyncio.sleep(wait_time)
                                    break  # Break inner loop to retry
                                yield f"[Error: {error_msg}]"
                                return

                            # Capture usage data (sent in final chunk before [DONE])
                            if 'usage' in data:
                                usage = data['usage']
                                usage_data = {
                                    'prompt_tokens': usage.get('prompt_tokens', 0),
                                    'completion_tokens': usage.get('completion_tokens', 0),
                                    'total_tokens': usage.get('total_tokens', 0),
                                    'cache_creation_input_tokens': usage.get('cache_creation_input_tokens', 0),
                                    'cache_read_input_tokens': usage.get('cache_read_input_tokens', 0),
                                    'model': model,
                                }

                            choice = data.get('choices', [{}])[0]
                            delta = choice.get('delta', {})

                            # Check for finish_reason (indicates truncation if "length")
                            fr = choice.get('finish_reason')
                            if fr:
                                finish_reason = fr

                            # Capture both 'content' and 'reasoning' fields
                            # Gemini sends thinking in 'reasoning' and final answer in 'content'
                            content = delta.get('content', '')
                            reasoning = delta.get('reasoning', '')

                            # Yield content if present (the actual answer)
                            if content:
                                token_count += 1
                                yield content
                            # Also yield reasoning if present (Gemini's thinking)
                            if reasoning:
                                token_count += 1
                                yield reasoning
                        except json.JSONDecodeError:
                            continue  # Skip malformed JSON lines

                if not should_retry:
                    return  # Done, exit the retry loop

        except httpx.TimeoutException:
            await _circuit_breaker.record_failure()
            yield f"[Error: Timeout after {timeout}s]"
            return
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                await _circuit_breaker.record_failure()
            yield f"[Error: Status {e.response.status_code}]"
            return
        except (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError):
            # Connection errors are often transient - retry them
            if retries < max_retries:
                await asyncio.sleep(2)  # Wait before retry
                retries += 1
                continue  # Retry the loop
            # Final retry failed - record failure
            await _circuit_breaker.record_failure()
            yield "[Error: Connection failed]"
            return
        except Exception:
            yield "[Error: Request failed]"
            return

        retries += 1


async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, str]],
    api_key: Optional[str] = None
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel.

    Args:
        models: List of OpenRouter model identifiers
        messages: List of message dicts to send to each model
        api_key: Optional API key override (for BYOK). Uses system key if not provided.

    Returns:
        Dict mapping model identifier to response dict (or None if failed)
    """
    import asyncio

    # Create tasks for all models
    tasks = [query_model(model, messages, api_key=api_key) for model in models]

    # Wait for all to complete
    responses = await asyncio.gather(*tasks)

    # Map models to their responses
    return {model: response for model, response in zip(models, responses)}
