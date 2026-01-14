"""
Helper functions for stage1_stream_responses - extracted to reduce complexity from E(37) to B(8).

These functions support Stage 1 council orchestration by handling:
- Security validation (query length, suspicious patterns, multi-turn attacks)
- Message building
- Model streaming coordination
- Queue event processing
- Timeout handling
- Result validation
"""

import asyncio
import json
import time
from typing import Optional, List, Dict, Any, AsyncGenerator


def _validate_query_security(
    user_query: str,
    conversation_history: Optional[List[Dict[str, str]]],
    validate_query_length,
    detect_suspicious_query,
    detect_multi_turn_attack,
    log_app_event,
    QueryTooLongError
) -> None:
    """
    Perform all security validations on user query.

    Args:
        user_query: The user's question
        conversation_history: Optional conversation history
        validate_query_length: Function to validate query length
        detect_suspicious_query: Function to detect suspicious patterns
        detect_multi_turn_attack: Function to detect multi-turn attacks
        log_app_event: Logging function
        QueryTooLongError: Exception class for too-long queries

    Raises:
        QueryTooLongError: If query exceeds maximum length
    """
    # AI-SEC-006: Validate query length to prevent DoS
    length_check = validate_query_length(user_query)
    if not length_check['is_valid']:
        log_app_event(
            "QUERY_TOO_LONG",
            level="WARNING",
            char_count=length_check['char_count'],
            max_chars=length_check['max_chars']
        )
        raise QueryTooLongError(length_check['char_count'], length_check['max_chars'])

    # Detect and log suspicious queries
    suspicious_check = detect_suspicious_query(user_query)
    if suspicious_check['is_suspicious']:
        log_app_event(
            "SUSPICIOUS_QUERY_DETECTED",
            level="WARNING",
            risk_level=suspicious_check['risk_level'],
            patterns_found=suspicious_check['patterns_found'],
            query_preview=user_query[:100] if len(user_query) > 100 else user_query
        )

    # AI-SEC-010: Detect multi-turn attack patterns
    if conversation_history:
        multi_turn_check = detect_multi_turn_attack(conversation_history, user_query)
        if multi_turn_check['is_suspicious']:
            log_app_event(
                "MULTI_TURN_ATTACK_DETECTED",
                level="WARNING" if multi_turn_check['risk_level'] != 'high' else "ERROR",
                risk_level=multi_turn_check['risk_level'],
                patterns=multi_turn_check['patterns']
            )


def _build_stage1_messages(
    system_prompt: Optional[str],
    conversation_history: Optional[List[Dict[str, str]]],
    user_query: str,
    wrap_user_query
) -> List[Dict[str, str]]:
    """
    Build messages array for Stage 1 LLM calls.

    Args:
        system_prompt: Optional system prompt with context
        conversation_history: Optional conversation history
        user_query: The user's question
        wrap_user_query: Function to wrap query with secure delimiters

    Returns:
        List of message dicts ready for LLM API
    """
    messages = []

    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    if conversation_history:
        messages.extend(conversation_history)

    # Wrap user query with secure delimiters to prevent injection
    messages.append({"role": "user", "content": wrap_user_query(user_query)})

    return messages


async def _get_council_models_and_config(
    get_models,
    get_models_sync,
    get_llm_config,
    effective_dept_id: Optional[str],
    conversation_modifier: Optional[str],
    preset_override: Optional[str]
) -> tuple[List[str], Dict[str, Any]]:
    """
    Get council models and LLM config for Stage 1.

    Args:
        get_models: Async function to get models
        get_models_sync: Sync fallback function
        get_llm_config: Function to get LLM config
        effective_dept_id: Department ID for config
        conversation_modifier: Optional conversation modifier
        preset_override: Optional preset override

    Returns:
        Tuple of (council_models list, stage1_config dict)
    """
    # Get council models from database (dynamic, respects LLM Hub settings)
    council_models = await get_models('council_member')
    if not council_models:
        council_models = get_models_sync('council_member')  # Fallback

    # Get LLM config for this department/stage
    stage1_config = await get_llm_config(
        department_id=effective_dept_id,
        stage="stage1",
        conversation_modifier=conversation_modifier,
        preset_override=preset_override,
    )

    return council_models, stage1_config


def _create_stream_single_model_task(
    model: str,
    messages: List[Dict[str, str]],
    stage1_config: Dict[str, Any],
    query_model_stream,
    queue: asyncio.Queue,
    model_content: Dict[str, str],
    model_start_times: Dict[str, float],
    PER_MODEL_TIMEOUT: float,
    log_app_event
):
    """
    Create async task for streaming a single model's response.

    Args:
        model: Model identifier
        messages: Messages to send to model
        stage1_config: LLM config for Stage 1
        query_model_stream: Function to query model with streaming
        queue: Queue for events
        model_content: Dict to store model responses
        model_start_times: Dict to track model start times
        PER_MODEL_TIMEOUT: Timeout for individual models
        log_app_event: Logging function

    Returns:
        Async task
    """
    async def stream_single_model():
        """Stream tokens from a single model and put events on the queue."""
        model_start_times[model] = time.time()
        content_chunks: list[str] = []
        usage_data = None
        try:
            async for chunk in query_model_stream(
                model,
                messages,
                temperature=stage1_config.get("temperature"),
                max_tokens=stage1_config.get("max_tokens"),
            ):
                # Per-model timeout check
                if time.time() - model_start_times[model] > PER_MODEL_TIMEOUT:
                    log_app_event(
                        "MODEL_TIMEOUT",
                        level="WARNING",
                        model=model,
                        elapsed_seconds=time.time() - model_start_times[model],
                        timeout_seconds=PER_MODEL_TIMEOUT
                    )
                    await queue.put({"type": "stage1_model_error", "model": model, "error": "Model timeout"})
                    return

                # Check for usage data marker
                if chunk.startswith("[USAGE:"):
                    try:
                        usage_json = chunk[7:-1]
                        usage_data = json.loads(usage_json)
                    except Exception:
                        pass
                    continue

                content_chunks.append(chunk)
                await queue.put({"type": "stage1_token", "model": model, "content": chunk})

            content = "".join(content_chunks)
            model_content[model] = content
            await queue.put({
                "type": "stage1_model_complete",
                "model": model,
                "response": content,
                "usage": usage_data
            })
        except asyncio.CancelledError:
            log_app_event("MODEL_CANCELLED", level="INFO", model=model)
            raise
        except Exception as e:
            await queue.put({"type": "stage1_model_error", "model": model, "error": str(e)})

    return asyncio.create_task(stream_single_model())


async def _start_models_with_stagger(
    council_models: List[str],
    messages: List[Dict[str, str]],
    stage1_config: Dict[str, Any],
    queue: asyncio.Queue,
    model_content: Dict[str, str],
    model_start_times: Dict[str, float],
    STAGGER_DELAY: float,
    PER_MODEL_TIMEOUT: float,
    query_model_stream,
    log_app_event
):
    """
    Start all model streams with staggered delays and yield early events.

    Args:
        council_models: List of model identifiers
        messages: Messages to send
        stage1_config: LLM config
        queue: Event queue
        model_content: Dict to store responses
        model_start_times: Dict to track start times
        STAGGER_DELAY: Delay between model starts (seconds)
        PER_MODEL_TIMEOUT: Timeout for individual models
        query_model_stream: Function to query models
        log_app_event: Logging function

    Yields:
        Events from queue during stagger delays, then final tuple
        Final yield: (tasks list, completed_count, successful_count)
    """
    tasks = []
    completed_count = 0
    successful_count = 0
    total_models = len(council_models)

    for i, model in enumerate(council_models):
        task = _create_stream_single_model_task(
            model, messages, stage1_config, query_model_stream,
            queue, model_content, model_start_times, PER_MODEL_TIMEOUT, log_app_event
        )
        tasks.append(task)

        if i < total_models - 1:
            # Brief stagger to avoid rate limits, yield events during wait
            stagger_end = asyncio.get_event_loop().time() + STAGGER_DELAY
            while asyncio.get_event_loop().time() < stagger_end:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.05)
                    yield event
                    if event['type'] == 'stage1_model_complete':
                        completed_count += 1
                        successful_count += 1
                    elif event['type'] == 'stage1_model_error':
                        completed_count += 1
                except asyncio.TimeoutError:
                    pass

    # Yield final tuple as last item
    yield (tasks, completed_count, successful_count)


async def _process_queue_until_complete(
    queue: asyncio.Queue,
    tasks: List[asyncio.Task],
    completed_count: int,
    successful_count: int,
    total_models: int,
    stage_start_time: float,
    STAGE1_TIMEOUT: float,
    log_app_event
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Process queue events until all models complete or timeout.

    Args:
        queue: Event queue
        tasks: List of model tasks
        completed_count: Initial completed count
        successful_count: Initial successful count
        total_models: Total number of models
        stage_start_time: Stage start timestamp
        STAGE1_TIMEOUT: Hard timeout for stage
        log_app_event: Logging function

    Yields:
        Events from queue
    """
    while completed_count < total_models:
        elapsed = time.time() - stage_start_time

        # Check for absolute stage timeout (hard limit)
        if elapsed > STAGE1_TIMEOUT:
            log_app_event(
                "STAGE1_TIMEOUT",
                level="ERROR",
                elapsed_seconds=elapsed,
                timeout_seconds=STAGE1_TIMEOUT,
                completed_models=completed_count,
                successful_models=successful_count,
                total_models=total_models
            )
            # Cancel remaining tasks
            for task in tasks:
                if not task.done():
                    task.cancel()
            yield {
                "type": "stage1_timeout",
                "elapsed": elapsed,
                "timeout": STAGE1_TIMEOUT,
                "completed": completed_count,
                "successful": successful_count,
                "total": total_models
            }
            break

        try:
            event = await asyncio.wait_for(queue.get(), timeout=0.1)
            yield event

            if event['type'] == 'stage1_model_complete':
                completed_count += 1
                successful_count += 1
            elif event['type'] == 'stage1_model_error':
                completed_count += 1
        except asyncio.TimeoutError:
            # Check if all tasks are done
            if all(task.done() for task in tasks):
                # Drain remaining events
                while not queue.empty():
                    event = await queue.get()
                    yield event
                    if event['type'] == 'stage1_model_complete':
                        completed_count += 1
                        successful_count += 1
                    elif event['type'] == 'stage1_model_error':
                        completed_count += 1
                break


def _build_final_results(
    model_content: Dict[str, str]
) -> List[Dict[str, str]]:
    """
    Build final results from model content.

    Args:
        model_content: Dict of model -> response content

    Returns:
        List of result dicts with model and response
    """
    return [
        {"model": model, "response": content}
        for model, content in model_content.items()
        if content  # Only include models that returned content
    ]


def _check_minimum_viable_council(
    final_results: List[Dict[str, str]],
    council_models: List[str],
    model_content: Dict[str, str],
    MIN_STAGE1_RESPONSES: int,
    log_app_event
) -> Optional[Dict[str, Any]]:
    """
    Check if minimum viable council threshold is met.

    Args:
        final_results: List of successful results
        council_models: List of all council models
        model_content: Dict of model responses
        MIN_STAGE1_RESPONSES: Minimum required responses
        log_app_event: Logging function

    Returns:
        Error dict if insufficient, None if okay
    """
    final_successful_count = len(final_results)
    total_council_models = len(council_models)

    if MIN_STAGE1_RESPONSES > 0 and final_successful_count < MIN_STAGE1_RESPONSES:
        failed_models = [
            m for m in council_models
            if m not in model_content or not model_content.get(m)
        ]
        log_app_event(
            "STAGE1_INSUFFICIENT_RESPONSES",
            level="WARNING",
            received=final_successful_count,
            required=MIN_STAGE1_RESPONSES,
            total=total_council_models,
            failed_models=failed_models
        )
        return {
            "type": "stage1_insufficient",
            "received": final_successful_count,
            "required": MIN_STAGE1_RESPONSES,
            "total": total_council_models,
            "data": final_results
        }
    return None
