"""
AI Prompt Internationalization Module

Provides translation support for AI system prompts, allowing the council
to respond in the user's language.

Usage:
    from backend.ai_i18n import get_localized_prompt, translate_system_prompt

    prompt = get_localized_prompt('council_chairman', locale='es')
"""

import json
import logging
from pathlib import Path
from typing import Dict, Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

# Path to AI prompt translations
AI_PROMPTS_DIR = Path(__file__).parent / 'ai_prompts'

# Supported locales for AI prompts
SUPPORTED_LOCALES = ['en', 'es']
DEFAULT_LOCALE = 'en'


@lru_cache(maxsize=None)
def load_ai_prompts(locale: str) -> Dict[str, any]:
    """
    Load AI prompt translations for a specific locale.

    Args:
        locale: Language code (e.g., 'en', 'es')

    Returns:
        Dictionary of prompt keys to prompt configurations
    """
    prompt_file = AI_PROMPTS_DIR / f"{locale}.json"

    if not prompt_file.exists():
        # Fallback to English if locale not found
        if locale != DEFAULT_LOCALE:
            return load_ai_prompts(DEFAULT_LOCALE)
        return {}

    try:
        with open(prompt_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Error loading AI prompts for {locale}: {e}")
        if locale != DEFAULT_LOCALE:
            return load_ai_prompts(DEFAULT_LOCALE)
        return {}


def get_localized_prompt(
    prompt_key: str,
    locale: str = DEFAULT_LOCALE,
    **context_vars
) -> str:
    """
    Get a localized AI system prompt.

    Args:
        prompt_key: Prompt identifier (e.g., 'council_chairman', 'write_assist')
        locale: Target language code
        **context_vars: Variables to interpolate into the prompt

    Returns:
        Localized system prompt with variables interpolated

    Examples:
        >>> get_localized_prompt('council_chairman', 'es')
        'Eres el Presidente del Consejo...'

        >>> get_localized_prompt('write_assist', 'en', context='company information')
        'You are a Business Strategist helping document company information...'
    """
    # Normalize locale
    locale = locale.split('-')[0].lower() if locale else DEFAULT_LOCALE

    if locale not in SUPPORTED_LOCALES:
        locale = DEFAULT_LOCALE

    # Load prompts for this locale
    prompts = load_ai_prompts(locale)

    # Get prompt
    prompt_config = prompts.get(prompt_key)

    if not prompt_config:
        logger.warning(f"Prompt key '{prompt_key}' not found for locale '{locale}'")
        # Try English fallback
        if locale != DEFAULT_LOCALE:
            prompts = load_ai_prompts(DEFAULT_LOCALE)
            prompt_config = prompts.get(prompt_key)

    if not prompt_config:
        return f"System prompt not found: {prompt_key}"

    # Extract prompt text
    if isinstance(prompt_config, str):
        prompt_text = prompt_config
    elif isinstance(prompt_config, dict):
        prompt_text = prompt_config.get('prompt', prompt_config.get('system_prompt', ''))
    else:
        prompt_text = str(prompt_config)

    # Interpolate variables
    if context_vars:
        try:
            prompt_text = prompt_text.format(**context_vars)
        except (KeyError, ValueError) as e:
            logger.warning(f"Failed to interpolate variables in prompt '{prompt_key}': {e}")

    return prompt_text


def get_persona_config(
    persona_key: str,
    locale: str = DEFAULT_LOCALE
) -> Dict[str, str]:
    """
    Get a complete persona configuration (name, description, prompt).

    Args:
        persona_key: Persona identifier
        locale: Target language code

    Returns:
        Persona configuration dictionary

    Example:
        >>> get_persona_config('business_strategist', 'es')
        {
            'name': 'Estratega de Negocios',
            'description': 'Documenta información empresarial claramente',
            'prompt': 'Eres un Estratega de Negocios...'
        }
    """
    locale = locale.split('-')[0].lower() if locale else DEFAULT_LOCALE

    if locale not in SUPPORTED_LOCALES:
        locale = DEFAULT_LOCALE

    prompts = load_ai_prompts(locale)
    persona = prompts.get(persona_key, {})

    if isinstance(persona, dict):
        return persona
    elif isinstance(persona, str):
        return {'prompt': persona}
    else:
        return {}


def translate_context_prompt(
    context_type: str,
    context_data: dict,
    locale: str = DEFAULT_LOCALE
) -> str:
    """
    Generate a localized context injection prompt.

    Args:
        context_type: Type of context ('company', 'department', 'role', 'playbook')
        context_data: Context data dictionary
        locale: Target language code

    Returns:
        Localized context prompt

    Example:
        >>> translate_context_prompt('company', {'name': 'Acme Inc'}, 'es')
        'La empresa se llama Acme Inc...'
    """
    prompts = load_ai_prompts(locale)
    context_prompts = prompts.get('context_templates', {})

    template = context_prompts.get(context_type, '')

    if not template:
        # Fallback to English
        if locale != DEFAULT_LOCALE:
            return translate_context_prompt(context_type, context_data, DEFAULT_LOCALE)
        return ''

    try:
        return template.format(**context_data)
    except (KeyError, ValueError) as e:
        logger.warning(f"Failed to format context prompt for '{context_type}': {e}")
        return template


def get_stage_labels(locale: str = DEFAULT_LOCALE) -> Dict[str, str]:
    """
    Get localized labels for council stages.

    Args:
        locale: Target language code

    Returns:
        Dictionary of stage labels

    Example:
        >>> get_stage_labels('es')
        {
            'stage1': 'Respuestas Individuales',
            'stage2': 'Revisión por Pares',
            'stage3': 'Síntesis Final'
        }
    """
    prompts = load_ai_prompts(locale)
    return prompts.get('stage_labels', {})


def get_model_labels(locale: str = DEFAULT_LOCALE) -> Dict[str, str]:
    """
    Get localized labels for AI models.

    Args:
        locale: Target language code

    Returns:
        Dictionary of model labels
    """
    prompts = load_ai_prompts(locale)
    return prompts.get('model_labels', {})


# Convenience function to check if a prompt exists
def has_localized_prompt(prompt_key: str, locale: str) -> bool:
    """
    Check if a localized prompt exists.

    Args:
        prompt_key: Prompt identifier
        locale: Target language code

    Returns:
        True if prompt exists for this locale
    """
    prompts = load_ai_prompts(locale)
    return prompt_key in prompts
