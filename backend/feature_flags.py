"""
Feature Flags Module - Runtime toggles for gradual rollouts and kill switches.

Phase 1: Environment variable based flags (simple, no database required)

Usage:
    from backend.feature_flags import get_flags, is_enabled

    # Check a single flag
    if is_enabled("new_council_ui"):
        # use new UI logic

    # Get all flags (for API response)
    flags = get_flags()

Environment Variables:
    FLAG_<NAME>=true|false

    Examples:
        FLAG_NEW_COUNCIL_UI=true
        FLAG_ADVANCED_SEARCH=false
        FLAG_GPT5_MODEL=true

Adding New Flags:
    1. Add to FEATURE_FLAGS dict below with default value
    2. Document purpose in comment
    3. Frontend reads via /api/feature-flags endpoint
"""

import os
from typing import Dict

# =============================================================================
# FEATURE FLAG DEFINITIONS
# =============================================================================
# Format: "flag_name": (env_var_name, default_value, description)
#
# Naming conventions:
# - Use snake_case for flag names
# - Prefix env vars with FLAG_
# - Default to False for new/experimental features
# - Default to True for existing features you might need to disable
# =============================================================================

FEATURE_FLAG_DEFINITIONS: Dict[str, tuple[str, bool, str]] = {
    # Council Features
    "prompt_caching": (
        "ENABLE_PROMPT_CACHING",  # Uses existing env var
        True,
        "Enable LLM prompt caching for cost savings"
    ),
    "stage2_ranking": (
        "FLAG_STAGE2_RANKING",
        True,
        "Enable Stage 2 peer ranking (disable to skip to synthesis)"
    ),
    "streaming_responses": (
        "FLAG_STREAMING_RESPONSES",
        True,
        "Enable streaming token responses (disable for batch mode)"
    ),

    # UI Features
    "command_palette": (
        "FLAG_COMMAND_PALETTE",
        True,
        "Enable Cmd+K command palette"
    ),
    "dark_mode": (
        "FLAG_DARK_MODE",
        True,
        "Enable dark mode toggle"
    ),

    # Experimental Features (default off)
    "advanced_search": (
        "FLAG_ADVANCED_SEARCH",
        False,
        "Enable semantic search in knowledge base"
    ),
    "multi_company": (
        "FLAG_MULTI_COMPANY",
        False,
        "Enable multi-company switching for users"
    ),
    "export_pdf": (
        "FLAG_EXPORT_PDF",
        False,
        "Enable PDF export of council conversations"
    ),

    # Model Features
    "gpt5_model": (
        "FLAG_GPT5_MODEL",
        True,
        "Enable GPT-5 model in council (disable if API issues)"
    ),
    "claude_opus": (
        "FLAG_CLAUDE_OPUS",
        True,
        "Enable Claude Opus model in council"
    ),
}


def _load_flags() -> Dict[str, bool]:
    """Load all feature flags from environment variables."""
    flags = {}
    for flag_name, (env_var, default, _description) in FEATURE_FLAG_DEFINITIONS.items():
        env_value = os.getenv(env_var, "").lower()
        if env_value in ("true", "1", "yes", "on"):
            flags[flag_name] = True
        elif env_value in ("false", "0", "no", "off"):
            flags[flag_name] = False
        else:
            flags[flag_name] = default
    return flags


# Load flags at module import (cached)
_FLAGS: Dict[str, bool] = _load_flags()


def get_flags() -> Dict[str, bool]:
    """
    Get all feature flags.

    Returns:
        Dict mapping flag names to their boolean values.

    Example:
        >>> get_flags()
        {'prompt_caching': True, 'advanced_search': False, ...}
    """
    return _FLAGS.copy()


def is_enabled(flag_name: str) -> bool:
    """
    Check if a specific feature flag is enabled.

    Args:
        flag_name: The name of the flag to check (e.g., "advanced_search")

    Returns:
        True if the flag is enabled, False otherwise.
        Returns False for unknown flags (fail-safe).

    Example:
        >>> is_enabled("prompt_caching")
        True
        >>> is_enabled("nonexistent_flag")
        False
    """
    return _FLAGS.get(flag_name, False)


def reload_flags() -> Dict[str, bool]:
    """
    Reload flags from environment variables.

    Use this if environment variables have changed at runtime
    (e.g., in tests or after config reload).

    Returns:
        Updated flags dictionary.
    """
    global _FLAGS
    _FLAGS = _load_flags()
    return _FLAGS


def get_flag_definitions() -> Dict[str, dict]:
    """
    Get flag definitions with metadata (for admin UI).

    Returns:
        Dict with flag names as keys and metadata dicts as values.

    Example:
        >>> get_flag_definitions()["advanced_search"]
        {'env_var': 'FLAG_ADVANCED_SEARCH', 'default': False, 'description': '...'}
    """
    return {
        name: {
            "env_var": env_var,
            "default": default,
            "description": description,
            "current": _FLAGS.get(name, default),
        }
        for name, (env_var, default, description) in FEATURE_FLAG_DEFINITIONS.items()
    }
