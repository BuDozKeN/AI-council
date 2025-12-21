"""OpenRouter API client for making LLM requests."""

import httpx
import json
from typing import List, Dict, Any, Optional, AsyncGenerator
from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL
from .config import MOCK_LLM as _MOCK_LLM_INITIAL
from .config import ENABLE_PROMPT_CACHING, CACHE_SUPPORTED_MODELS

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
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=30.0),  # 30s connect timeout
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            http2=True  # Enable HTTP/2 for better multiplexing
        )
    return _http_client

# Conditional import of mock functions when mock mode is enabled
# These will be set dynamically if mock mode is toggled via API
generate_mock_response = None
generate_mock_response_stream = None

if MOCK_LLM:
    from .mock_llm import generate_mock_response, generate_mock_response_stream
    print("[MOCK] MOCK MODE ENABLED - No real API calls will be made", flush=True)

# Log caching status on startup
if ENABLE_PROMPT_CACHING:
    print("[CACHE] PROMPT CACHING ENABLED - cache_control will be added to supported models", flush=True)
else:
    print("[CACHE] Prompt caching DISABLED - using standard message format", flush=True)


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
            print(f"[CACHE] Added cache_control to system message for {model} ({len(content)} chars)", flush=True)
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
    timeout: float = 120.0
) -> Optional[Dict[str, Any]]:
    """
    Query a single model via OpenRouter API.

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds

    Returns:
        Response dict with 'content' and optional 'reasoning_details', or None if failed
    """
    # === MOCK MODE INTERCEPT ===
    if MOCK_LLM:
        return await generate_mock_response(model, messages)

    # === REAL API CALL ===
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
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

        return {
            'content': message.get('content'),
            'reasoning_details': message.get('reasoning_details')
        }

    except httpx.TimeoutException as e:
        print(f"[TIMEOUT] Model {model}: Request timed out after {timeout}s", flush=True)
        return None
    except httpx.HTTPStatusError as e:
        print(f"[HTTP ERROR] Model {model}: Status {e.response.status_code} - {e.response.text[:200]}", flush=True)
        return None
    except Exception as e:
        print(f"[ERROR] Model {model}: {type(e).__name__}: {e}", flush=True)
        return None


async def query_model_stream(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0,
    max_retries: int = 3
) -> AsyncGenerator[str, None]:
    """
    Query a single model via OpenRouter API with streaming.

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds
        max_retries: Number of retries for overloaded/rate-limited errors

    Yields:
        Text chunks as they arrive from the model
    """
    # === MOCK MODE INTERCEPT ===
    if MOCK_LLM:
        async for chunk in generate_mock_response_stream(model, messages):
            yield chunk
        return

    # === REAL API CALL ===
    import asyncio

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
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

    # Use the shared HTTP client for connection pooling
    client = get_http_client(timeout)

    while retries <= max_retries:
        should_retry = False
        try:
            print(f"[STREAM START] {model}: Connecting..." + (f" (retry {retries})" if retries > 0 else ""), flush=True)
            async with client.stream(
                "POST",
                OPENROUTER_API_URL,
                headers=headers,
                json=payload
            ) as response:
                # Check for HTTP errors BEFORE reading stream - this lets us capture error body
                if response.status_code >= 400:
                    # Read the full error response body
                    error_body = await response.aread()
                    error_text = error_body.decode('utf-8')[:1000]
                    print(f"[HTTP ERROR] Model {model}: Status {response.status_code} - {error_text}", flush=True)
                    if response.status_code == 400:
                        print(f"[400 DEBUG] {model}: This often means context too long, invalid request format, or model-specific restrictions", flush=True)
                    yield f"[Error: Status {response.status_code}]"
                    return

                print(f"[STREAM CONNECTED] {model}: Status {response.status_code}", flush=True)

                line_count = 0
                token_count = 0
                first_data_logged = False
                finish_reason = None
                async for line in response.aiter_lines():
                    line_count += 1
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        if data_str.strip() == "[DONE]":
                            done_msg = f"[STREAM DONE] {model}: Received [DONE] after {line_count} lines, {token_count} tokens"
                            if finish_reason == "length":
                                done_msg += " [TRUNCATED - hit max_tokens limit!]"
                            print(done_msg, flush=True)
                            return  # Successfully completed
                        try:
                            data = json.loads(data_str)
                            # Log first data packet to see structure
                            if not first_data_logged:
                                print(f"[STREAM FIRST DATA] {model}: {json.dumps(data)[:500]}", flush=True)
                                first_data_logged = True

                            # Check for error response (Overloaded, rate limit, server errors, etc.)
                            if 'error' in data:
                                error_msg = data['error'].get('message', 'Unknown error')
                                error_code = data['error'].get('code', 0)
                                print(f"[STREAM ERROR RESPONSE] {model}: {error_msg} (code: {error_code})", flush=True)

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
                                    print(f"[RETRY] {model}: Rate limited, will retry in {wait_time}s...", flush=True)
                                    await asyncio.sleep(wait_time)
                                    break  # Break inner loop to retry
                                yield f"[Error: {error_msg}]"
                                return

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
                            print(f"[STREAM JSON ERROR] {model}: Failed to parse: {data_str[:100]}", flush=True)
                            continue

                if line_count == 0:
                    print(f"[STREAM EMPTY] {model}: No lines received!", flush=True)
                elif token_count == 0:
                    print(f"[STREAM NO TOKENS] {model}: {line_count} lines but 0 tokens!", flush=True)

                if not should_retry:
                    return  # Done, exit the retry loop

        except httpx.TimeoutException as e:
            print(f"[TIMEOUT] Model {model}: Streaming timed out after {timeout}s", flush=True)
            yield f"[Error: Timeout after {timeout}s]"
            return
        except httpx.HTTPStatusError as e:
            error_msg = f"Status {e.response.status_code}"
            error_detail = "Unknown error"
            # In streaming mode, try multiple methods to read the error
            try:
                # Try to read the response body
                if hasattr(e.response, '_content') and e.response._content:
                    error_detail = e.response._content.decode('utf-8')[:500]
                elif hasattr(e.response, 'content') and e.response.content:
                    error_detail = e.response.content.decode('utf-8')[:500]
                else:
                    # Try async read
                    error_body = await e.response.aread()
                    error_detail = error_body.decode('utf-8')[:500]
            except Exception as read_err:
                error_detail = f"Could not read error response: {type(read_err).__name__}"

            print(f"[HTTP ERROR] Model {model}: {error_msg} - {error_detail}", flush=True)

            # For 400 errors, also log what might be wrong
            if e.response.status_code == 400:
                print(f"[400 DEBUG] {model}: This is often caused by: context too long, invalid characters, or model-specific restrictions", flush=True)

            yield f"[Error: {error_msg}]"
            return
        except (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError) as e:
            # Connection errors are often transient - retry them
            error_type = type(e).__name__
            error_str = str(e) if str(e) else f"{error_type} - Connection failed"
            print(f"[CONNECTION ERROR] Model {model}: {error_type}: {e}", flush=True)
            if retries < max_retries:
                print(f"[RETRY] Model {model}: Retrying after connection error (attempt {retries + 1}/{max_retries})", flush=True)
                await asyncio.sleep(2)  # Wait before retry
                retries += 1
                continue  # Retry the loop
            yield f"[Error: {error_str}]"
            return
        except Exception as e:
            error_type = type(e).__name__
            error_str = str(e) if str(e) else f"{error_type} - Connection failed"
            print(f"[ERROR] Model {model}: {error_type}: {e}", flush=True)
            yield f"[Error: {error_str}]"
            return

        retries += 1


async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, str]]
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel.

    Args:
        models: List of OpenRouter model identifiers
        messages: List of message dicts to send to each model

    Returns:
        Dict mapping model identifier to response dict (or None if failed)
    """
    import asyncio

    # Create tasks for all models
    tasks = [query_model(model, messages) for model in models]

    # Wait for all to complete
    responses = await asyncio.gather(*tasks)

    # Map models to their responses
    return {model: response for model, response in zip(models, responses)}
