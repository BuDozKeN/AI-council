"""
LLM Configuration helpers.

Resolves effective LLM config for a department by:
1. Checking department's llm_config (if custom)
2. Falling back to preset config from database
3. Using hardcoded fallbacks if database unavailable
4. Applying any conversation-level modifiers

Usage:
    from llm_config import get_llm_config

    # Get config for a specific stage
    config = await get_llm_config(
        department_id="uuid-here",
        stage="stage1",
        conversation_modifier="creative"
    )
    # Returns: {"temperature": 0.7, "max_tokens": 1536}
"""

from typing import Dict, Any, Optional
import sys

# Hardcoded fallbacks (used if database unavailable)
# These match the presets seeded in the migration
FALLBACK_CONFIGS = {
    "conservative": {
        "stage1": {"temperature": 0.2, "max_tokens": 8192},
        "stage2": {"temperature": 0.15, "max_tokens": 2048},
        "stage3": {"temperature": 0.25, "max_tokens": 8192},
    },
    "balanced": {
        "stage1": {"temperature": 0.5, "max_tokens": 8192},
        "stage2": {"temperature": 0.3, "max_tokens": 2048},
        "stage3": {"temperature": 0.4, "max_tokens": 8192},
    },
    "creative": {
        "stage1": {"temperature": 0.8, "max_tokens": 8192},
        "stage2": {"temperature": 0.5, "max_tokens": 2048},
        "stage3": {"temperature": 0.7, "max_tokens": 8192},
    },
}

# Default config if nothing else matches
DEFAULT_STAGE_CONFIG = {"temperature": 0.5, "max_tokens": 1536}

# Modifier bounds - how much conversation modifiers can adjust temperature
MODIFIER_DELTA = 0.15
MODIFIER_MIN_TEMP = 0.1
MODIFIER_MAX_TEMP = 1.0


async def get_llm_config(
    department_id: Optional[str] = None,
    stage: str = "stage1",
    conversation_modifier: Optional[str] = None,
    preset_override: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get effective LLM configuration for a request.

    Priority:
    1. preset_override (if provided) - uses preset config directly
    2. Department's custom llm_config (if preset = 'custom')
    3. Department's preset config from llm_presets table
    4. Hardcoded fallback config
    5. + Conversation modifier adjustments (bounded)

    Args:
        department_id: Department UUID (if using department-specific config)
        stage: Which stage ("stage1", "stage2", "stage3")
        conversation_modifier: Optional per-conversation modifier:
            - "creative": Increase temperature slightly
            - "cautious": Decrease temperature slightly
            - "concise": Reduce max_tokens
        preset_override: Optional preset override (conservative/balanced/creative).
            If provided, bypasses department lookup and uses this preset directly.

    Returns:
        Dict with temperature, max_tokens, and optionally top_p
    """
    config = DEFAULT_STAGE_CONFIG.copy()

    # If preset_override is provided, use fallback configs directly
    # This bypasses the department lookup entirely
    if preset_override and preset_override in FALLBACK_CONFIGS:
        preset_config = FALLBACK_CONFIGS[preset_override]
        if stage in preset_config:
            config = preset_config[stage].copy()
    elif department_id:
        try:
            from .database import get_supabase_service
            supabase = get_supabase_service()
            if supabase:
                # Use the database function to get effective config
                result = supabase.rpc(
                    "get_department_stage_config",
                    {"p_department_id": department_id, "p_stage": stage}
                ).execute()

                if result.data and isinstance(result.data, dict):
                    config.update(result.data)
                    print(f"[llm_config] {stage} config from DB: max_tokens={config.get('max_tokens')}", file=sys.stderr)
                else:
                    print(f"[llm_config] {stage} no DB config returned, using fallback: max_tokens={config.get('max_tokens')}", file=sys.stderr)
        except Exception as e:
            # Log but don't fail - use defaults
            print(f"[llm_config] get_llm_config failed for {department_id}: {type(e).__name__} - using fallback: max_tokens={config.get('max_tokens')}", file=sys.stderr)

    # Apply conversation modifier (bounded adjustment)
    if conversation_modifier:
        config = _apply_modifier(config, conversation_modifier)

    return config


def _apply_modifier(config: Dict[str, Any], modifier: str) -> Dict[str, Any]:
    """
    Apply a conversation modifier to the config.

    Modifiers make bounded adjustments - they can't push temperature
    outside reasonable ranges.
    """
    result = config.copy()
    base_temp = result.get("temperature", 0.5)

    if modifier == "creative":
        # Increase temperature, but cap at max
        result["temperature"] = min(MODIFIER_MAX_TEMP, base_temp + MODIFIER_DELTA)

    elif modifier == "cautious":
        # Decrease temperature, but don't go below min
        result["temperature"] = max(MODIFIER_MIN_TEMP, base_temp - MODIFIER_DELTA)

    elif modifier == "concise":
        # Reduce max_tokens by half, but keep a reasonable minimum
        current_max = result.get("max_tokens", 1536)
        result["max_tokens"] = max(512, current_max // 2)

    elif modifier == "detailed":
        # Increase max_tokens, but cap at reasonable max
        current_max = result.get("max_tokens", 1536)
        result["max_tokens"] = min(4096, int(current_max * 1.5))

    return result


def get_llm_config_sync(
    preset: str = "balanced",
    stage: str = "stage1",
    conversation_modifier: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Synchronous version using hardcoded fallbacks only.

    Use this when you can't use async (e.g., at module load time).
    """
    preset_config = FALLBACK_CONFIGS.get(preset, FALLBACK_CONFIGS["balanced"])
    config = preset_config.get(stage, DEFAULT_STAGE_CONFIG).copy()

    if conversation_modifier:
        config = _apply_modifier(config, conversation_modifier)

    return config


async def get_department_preset(department_id: str) -> str:
    """
    Get the preset name for a department.

    Returns 'balanced' if not found or on error.
    """
    try:
        from .database import get_supabase_service
        supabase = get_supabase_service()
        if supabase:
            result = supabase.table("departments") \
                .select("llm_preset") \
                .eq("id", department_id) \
                .single() \
                .execute()

            if result.data:
                return result.data.get("llm_preset", "balanced")
    except Exception:
        pass

    return "balanced"


async def set_department_preset(department_id: str, preset: str) -> bool:
    """
    Set the preset for a department.

    Args:
        department_id: Department UUID
        preset: One of 'conservative', 'balanced', 'creative', 'custom'

    Returns:
        True if successful, False otherwise
    """
    valid_presets = {"conservative", "balanced", "creative", "custom"}
    if preset not in valid_presets:
        return False

    try:
        from .database import get_supabase_service
        supabase = get_supabase_service()
        if supabase:
            result = supabase.table("departments") \
                .update({"llm_preset": preset}) \
                .eq("id", department_id) \
                .execute()

            return len(result.data) > 0
    except Exception:
        pass

    return False


async def set_department_custom_config(
    department_id: str,
    config: Dict[str, Any]
) -> bool:
    """
    Set a custom LLM config for a department.

    This also sets llm_preset to 'custom' to indicate custom config is active.

    Args:
        department_id: Department UUID
        config: Custom config dict with stage1/stage2/stage3 sub-objects

    Returns:
        True if successful, False otherwise
    """
    try:
        from .database import get_supabase_service
        supabase = get_supabase_service()
        if supabase:
            result = supabase.table("departments") \
                .update({
                    "llm_preset": "custom",
                    "llm_config": config
                }) \
                .eq("id", department_id) \
                .execute()

            return len(result.data) > 0
    except Exception:
        pass

    return False


def validate_llm_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and sanitize an LLM config dict.

    Ensures values are within safe ranges.

    Args:
        config: Raw config dict

    Returns:
        Sanitized config dict with values clamped to safe ranges
    """
    result = {}

    # Temperature: 0.0 - 1.2
    if "temperature" in config:
        temp = config["temperature"]
        if isinstance(temp, (int, float)):
            result["temperature"] = max(0.0, min(1.2, float(temp)))

    # Max tokens: 256 - 16384
    if "max_tokens" in config:
        tokens = config["max_tokens"]
        if isinstance(tokens, int):
            result["max_tokens"] = max(256, min(16384, tokens))

    # Top P: 0.0 - 1.0
    if "top_p" in config:
        top_p = config["top_p"]
        if isinstance(top_p, (int, float)):
            result["top_p"] = max(0.0, min(1.0, float(top_p)))

    return result
