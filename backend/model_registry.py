"""
Model Registry - Centralized model configuration.

This module provides helpers to fetch model configurations from the database,
with hardcoded fallbacks if the database is unavailable.

Usage:
    from model_registry import get_models, get_primary_model

    # Get all models for a role (with fallbacks)
    chairman_models = await get_models('chairman')
    # Returns: ['anthropic/claude-opus-4.5', 'google/gemini-3-pro-preview', 'openai/gpt-5.1']

    # Get just the primary model
    title_model = await get_primary_model('title_generator')
    # Returns: 'google/gemini-2.5-flash'
"""

from typing import List, Optional, Dict, Tuple
import os
import time
import logging
from supabase import create_client, Client

# Use module-level logger
_logger = logging.getLogger(__name__)

# =============================================================================
# IN-MEMORY CACHE (Performance optimization for council-stats endpoint)
# =============================================================================
_MODEL_CACHE_TTL = 300  # 5 minutes in seconds
_model_cache: Dict[str, Tuple[List[str], float]] = {}


def _get_cache_key(role: str, company_id: Optional[str]) -> str:
    """Generate cache key for role/company combination."""
    return f"{role}:{company_id or 'global'}"


def _get_from_cache(role: str, company_id: Optional[str]) -> Optional[List[str]]:
    """Get models from cache if not expired."""
    key = _get_cache_key(role, company_id)
    if key in _model_cache:
        models, expiry = _model_cache[key]
        if time.time() < expiry:
            return models
        del _model_cache[key]
    return None


def _set_cache(role: str, company_id: Optional[str], models: List[str]) -> None:
    """Store models in cache with TTL."""
    key = _get_cache_key(role, company_id)
    _model_cache[key] = (models, time.time() + _MODEL_CACHE_TTL)

# =============================================================================
# ROLE CONSOLIDATION
# =============================================================================
# Old roles are aliased to consolidated roles for backward compatibility.
# The LLM model is just the engine; the PERSONA/PROMPT defines the expertise.

# Role aliases: old role -> consolidated role
# This allows existing code to use old role names while using consolidated model configs
ROLE_ALIASES = {
    # Document writing roles -> document_writer
    'sop_writer': 'document_writer',
    'framework_author': 'document_writer',
    'policy_writer': 'document_writer',
    'decision_summarizer': 'document_writer',
    # Utility roles -> utility
    'title_generator': 'utility',
    'triage': 'utility',
    'sarah': 'utility',
    'ai_write_assist': 'utility',
    'ai_polish': 'utility',
}


def _resolve_role(role: str) -> str:
    """Resolve a role name to its canonical form (handles aliases)."""
    return ROLE_ALIASES.get(role, role)


# Hardcoded fallbacks - used if database is unavailable
# CONSOLIDATED model configs - fewer roles, simpler management
FALLBACK_MODELS = {
    # Core Council - Keep separate (different requirements)
    'council_member': [
        'google/gemini-3-pro-preview',
        'openai/gpt-5.1',
        'anthropic/claude-opus-4.5',
        'x-ai/grok-4',
        'deepseek/deepseek-chat-v3-0324',
    ],
    'stage2_reviewer': [
        'anthropic/claude-sonnet-4',       # $3.00/$15.00 - quality anchor
        'openai/gpt-4o-mini',              # $0.15/$0.60 - smart & cheap
        'x-ai/grok-4-fast',                # $0.20/$0.50 - fast variant
        'google/gemini-2.5-flash',         # $0.15/$0.60 - fast & economical Google
        'moonshotai/kimi-k2',              # $0.46/$1.84 - Chinese AI (Moonshot)
        'deepseek/deepseek-chat-v3-0324',  # $0.28/$0.42 - Chinese AI (DeepSeek) + top reasoning
    ],
    'chairman': [
        'openai/gpt-5.1',
        'google/gemini-3-pro-preview',
        'anthropic/claude-opus-4.5',
    ],

    # CONSOLIDATED: Document Writing - ONE config for all document types
    # SOPs, Frameworks, Policies, Summaries all use this
    'document_writer': [
        'openai/gpt-4o',
        'anthropic/claude-3-5-sonnet-20241022',
        'google/gemini-2.0-flash-001',
    ],

    # CONSOLIDATED: Utility Tools - ONE config for helper tasks
    # Titles, routing, writing assistance, polish all use this
    'utility': [
        'google/gemini-2.5-flash',
        'openai/gpt-4o-mini',
        'anthropic/claude-3-5-haiku-20241022',
    ],
}


def _get_supabase_client() -> Optional[Client]:
    """Get Supabase client, or None if not configured."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    try:
        return create_client(url, key)
    except Exception as e:
        _logger.warning(f"Failed to create Supabase client: {type(e).__name__}")
        return None


async def get_models(role: str, company_id: Optional[str] = None) -> List[str]:
    """
    Get all models for a role, ordered by priority (primary first, then fallbacks).

    Args:
        role: The role to get models for (e.g., 'chairman', 'council_member')
              Old role names are automatically aliased to consolidated roles.
        company_id: Optional company ID for company-specific overrides

    Returns:
        List of model IDs, ordered by priority
    """
    # Resolve role aliases (e.g., 'sop_writer' -> 'document_writer')
    resolved_role = _resolve_role(role)

    # Check cache first (5-minute TTL for performance)
    cached = _get_from_cache(resolved_role, company_id)
    if cached is not None:
        return cached

    try:
        supabase = _get_supabase_client()
        if supabase:
            # If company_id provided, prefer company-specific models
            if company_id:
                # Try company-specific first
                company_query = supabase.table('model_registry') \
                    .select('model_id') \
                    .eq('role', resolved_role) \
                    .eq('is_active', True) \
                    .eq('company_id', company_id) \
                    .order('priority')
                company_result = company_query.execute()
                if company_result.data and len(company_result.data) > 0:
                    models = [row['model_id'] for row in company_result.data]
                    _set_cache(resolved_role, company_id, models)
                    return models

            # Fall back to global models (company_id IS NULL)
            global_query = supabase.table('model_registry') \
                .select('model_id') \
                .eq('role', resolved_role) \
                .eq('is_active', True) \
                .is_('company_id', 'null') \
                .order('priority')
            result = global_query.execute()
            if result.data and len(result.data) > 0:
                models = [row['model_id'] for row in result.data]
                _set_cache(resolved_role, company_id, models)
                return models
    except Exception as e:
        _logger.warning(f"get_models({role}->{resolved_role}) failed: {type(e).__name__}")

    # Fallback to hardcoded with resolved role
    fallback = FALLBACK_MODELS.get(resolved_role, [])
    _set_cache(resolved_role, company_id, fallback)
    return fallback


async def get_primary_model(role: str, company_id: Optional[str] = None) -> Optional[str]:
    """
    Get the primary (first priority) model for a role.

    Args:
        role: The role to get the primary model for
        company_id: Optional company ID for company-specific overrides

    Returns:
        The primary model ID, or None if no models configured
    """
    models = await get_models(role, company_id)
    return models[0] if models else None


def get_models_sync(role: str) -> List[str]:
    """
    Synchronous version - returns hardcoded fallbacks only.
    Use this when you can't use async (e.g., at module load time).
    Automatically resolves role aliases.
    """
    resolved_role = _resolve_role(role)
    return FALLBACK_MODELS.get(resolved_role, [])


def get_primary_model_sync(role: str) -> Optional[str]:
    """
    Synchronous version - returns hardcoded fallback only.
    """
    models = FALLBACK_MODELS.get(role, [])
    return models[0] if models else None


# For backwards compatibility with config.py imports
# These are synchronous and use fallbacks only
COUNCIL_MODELS = get_models_sync('council_member')
CHAIRMAN_MODELS = get_models_sync('chairman')
CHAIRMAN_MODEL = get_primary_model_sync('chairman')
