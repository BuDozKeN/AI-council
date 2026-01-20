"""
Helper functions for query_model_stream - extracted to reduce complexity from E(40) to B(8-10).

These functions support streaming LLM responses by handling:
- Circuit breaker checks
- Payload building with model-specific logic
- Response parsing (SSE format)
- Error detection and retry logic
- Usage data capture
- Timing instrumentation
"""

import json
import time
from typing import Optional, Dict, Any, List, Tuple


def _check_circuit_breaker_streaming(breaker) -> Optional[str]:
    """
    Check circuit breaker before streaming request.

    Args:
        breaker: Circuit breaker instance

    Returns:
        Error message if circuit is open, None if okay to proceed
    """
    import asyncio

    async def check():
        if not await breaker.can_execute():
            status = breaker.get_status()
            recovery_secs = status.get("seconds_until_recovery", 60)
            return f"[Error: Model temporarily unavailable. Please retry in {recovery_secs:.0f}s]"
        return None

    return asyncio.create_task(check())


def _build_streaming_payload(
    model: str,
    cached_messages: List[Dict[str, str]],
    temperature: Optional[float],
    max_tokens: Optional[int],
    top_p: Optional[float]
) -> Dict[str, Any]:
    """
    Build the API request payload for streaming.

    Handles model-specific parameters (reasoning, thinking, etc.)

    Args:
        model: Model identifier
        cached_messages: Messages with cache control applied
        temperature: Optional temperature parameter
        max_tokens: Optional max tokens
        top_p: Optional nucleus sampling parameter

    Returns:
        Complete payload dict
    """
    payload = {
        "model": model,
        "messages": cached_messages,
        "stream": True,
        "max_tokens": max_tokens if max_tokens is not None else 16384,
        "usage": {"include": True},  # Required for token usage in streaming
    }

    # Add optional LLM parameters
    if temperature is not None:
        payload["temperature"] = temperature
    if top_p is not None:
        payload["top_p"] = top_p

    # Model-specific reasoning parameter handling
    # - Gemini 3 Pro: mandatory thinking (cannot be excluded)
    # - Gemini 2.5: uses thinkingBudget instead
    # - Kimi K2: does not support reasoning parameter
    # - Grok: does not support reasoning parameter
    is_gemini_3 = "gemini-3" in model.lower()
    is_gemini_2_5 = "gemini-2.5" in model.lower()
    is_kimi = "kimi" in model.lower() or "moonshot" in model.lower()
    is_grok = "grok" in model.lower()
    supports_reasoning = not is_gemini_3 and not is_gemini_2_5 and not is_kimi and not is_grok

    if supports_reasoning:
        # Exclude reasoning/thinking tokens - show only final answer
        payload["reasoning"] = {"exclude": True}

    return payload


def _is_retryable_error(error_msg: str, error_code: int) -> bool:
    """
    Determine if an error should trigger a retry.

    Args:
        error_msg: Error message from API
        error_code: HTTP status code or error code

    Returns:
        True if error is retryable
    """
    msg_lower = error_msg.lower()
    return (
        'overloaded' in msg_lower or
        'rate' in msg_lower or
        'internal server' in msg_lower or
        error_code in [429, 500, 502, 503, 504]
    )


def _calculate_retry_delay(retries: int, error_code: int) -> float:
    """
    Calculate backoff delay for retry.

    Args:
        retries: Current retry count
        error_code: Error code (429 for rate limit)

    Returns:
        Delay in seconds
    """
    from .openrouter import calculate_backoff_with_jitter

    # Rate limits get longer base delay
    base = 5.0 if error_code == 429 else 2.0
    return calculate_backoff_with_jitter(retries, base_delay=base)


def _parse_sse_data_line(data_str: str) -> Optional[Dict[str, Any]]:
    """
    Parse a Server-Sent Events data line.

    Args:
        data_str: Data string after "data: " prefix

    Returns:
        Parsed dict or None if malformed/DONE
    """
    if data_str.strip() == "[DONE]":
        return None

    try:
        return json.loads(data_str)
    except json.JSONDecodeError:
        return None


def _extract_usage_data(
    data: Dict[str, Any],
    model: str,
    request_start_time: float,
    time_to_first_token: Optional[float]
) -> Optional[Dict[str, Any]]:
    """
    Extract usage metrics from streaming response chunk.

    Args:
        data: Parsed JSON data from stream
        model: Model identifier
        request_start_time: Request start timestamp
        time_to_first_token: First token timestamp (optional)

    Returns:
        Usage data dict or None
    """
    if 'usage' not in data:
        return None

    usage = data['usage']
    total_latency = time.time() - request_start_time

    return {
        'prompt_tokens': usage.get('prompt_tokens', 0),
        'completion_tokens': usage.get('completion_tokens', 0),
        'total_tokens': usage.get('total_tokens', 0),
        'cache_creation_input_tokens': usage.get('cache_creation_input_tokens', 0),
        'cache_read_input_tokens': usage.get('cache_read_input_tokens', 0),
        'model': model,
        # Timing metrics for observability
        'time_to_first_token_ms': round(time_to_first_token * 1000) if time_to_first_token else None,
        'total_latency_ms': round(total_latency * 1000),
    }


def _extract_content_from_delta(data: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract content and finish_reason from streaming delta.

    Args:
        data: Parsed JSON data from stream

    Returns:
        Tuple of (content, finish_reason)
    """
    choice = data.get('choices', [{}])[0]
    delta = choice.get('delta', {})
    finish_reason = choice.get('finish_reason')
    content = delta.get('content', '')

    return content, finish_reason


def _should_retry_connection_error(retries: int, max_retries: int) -> bool:
    """
    Determine if connection error should trigger retry.

    Args:
        retries: Current retry count
        max_retries: Maximum retries allowed

    Returns:
        True if should retry
    """
    return retries < max_retries


def _format_usage_event(usage_data: Dict[str, Any]) -> str:
    """
    Format usage data as SSE event string.

    Args:
        usage_data: Usage metrics dict

    Returns:
        Formatted event string
    """
    return f"[USAGE:{json.dumps(usage_data)}]"


def _handle_http_error_response(status_code: int, breaker) -> Tuple[str, bool]:
    """
    Handle HTTP error response during streaming.

    Args:
        status_code: HTTP status code
        breaker: Circuit breaker instance

    Returns:
        Tuple of (error_message, should_record_failure)
    """
    import asyncio

    should_record = status_code >= 500
    error_msg = f"[Error: Status {status_code}]"

    if should_record:
        asyncio.create_task(breaker.record_failure())

    return error_msg, should_record


async def _process_sse_stream(
    response,
    model: str,
    breaker,
    request_start_time: float,
    retries: int,
    max_retries: int
):
    """
    Process Server-Sent Events stream from OpenRouter API.

    This is the core streaming logic extracted to reduce complexity.

    Args:
        response: HTTP response object with streaming capability
        model: Model identifier
        breaker: Circuit breaker instance
        request_start_time: Request start timestamp
        retries: Current retry count
        max_retries: Maximum retries allowed

    Yields:
        Content chunks, usage events, error messages, or control tuples
        Control tuples: (should_retry: bool, new_retries: int)
    """
    import asyncio

    time_to_first_token: Optional[float] = None
    usage_data = None
    should_retry = False

    async for line in response.aiter_lines():
        if not line.startswith("data: "):
            continue

        data_str = line[6:]  # Remove "data: " prefix
        if data_str.strip() == "[DONE]":
            await breaker.record_success()
            if usage_data:
                yield _format_usage_event(usage_data)
            yield (False, retries)  # Signal done
            return

        data = _parse_sse_data_line(data_str)
        if not data:
            continue  # Malformed JSON

        # Check for error response
        if 'error' in data:
            error_msg = data['error'].get('message', 'Unknown error')
            error_code = data['error'].get('code', 0)

            if _is_retryable_error(error_msg, error_code) and retries < max_retries:
                should_retry = True
                wait_time = _calculate_retry_delay(retries, error_code)
                await asyncio.sleep(wait_time)
                yield (True, retries + 1)  # Signal retry needed
                return

            yield f"[Error: {error_msg}]"
            yield (False, retries)  # Signal done
            return

        # Extract usage metrics
        usage = _extract_usage_data(data, model, request_start_time, time_to_first_token)
        if usage:
            usage_data = usage

        # Extract content
        content, finish_reason = _extract_content_from_delta(data)

        # Handle truncation
        if finish_reason == 'length':
            yield "[TRUNCATED]"
            await breaker.record_success()
            if usage_data:
                yield _format_usage_event(usage_data)
            yield (False, retries)  # Signal done
            return

        # Yield content tokens
        if content:
            if time_to_first_token is None:
                time_to_first_token = time.time() - request_start_time
            yield content

    # Stream ended naturally
    yield (should_retry, retries)
