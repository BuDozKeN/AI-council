"""
Backend Internationalization (i18n) Module

Provides translation support for API error messages, email templates,
and other backend strings.

Usage:
    from backend.i18n import t, get_locale_from_request

    locale = get_locale_from_request(request)
    error_msg = t("errors.not_found", locale)
"""

import json
import os
from pathlib import Path
from typing import Dict, Optional
from functools import lru_cache


# Supported locales
SUPPORTED_LOCALES = ['en', 'es', 'de', 'fr', 'pt', 'ja', 'zh', 'ar']
DEFAULT_LOCALE = 'en'

# Path to translation files
LOCALES_DIR = Path(__file__).parent / 'locales'


@lru_cache(maxsize=None)
def load_translations(locale: str) -> Dict[str, str]:
    """
    Load translation file for a specific locale.
    Results are cached for performance.

    Args:
        locale: Language code (e.g., 'en', 'es')

    Returns:
        Dictionary of translation keys to values
    """
    locale_file = LOCALES_DIR / f"{locale}.json"

    if not locale_file.exists():
        # Fallback to English if locale not found
        if locale != DEFAULT_LOCALE:
            return load_translations(DEFAULT_LOCALE)
        return {}

    try:
        with open(locale_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[i18n] Error loading translations for {locale}: {e}")
        if locale != DEFAULT_LOCALE:
            return load_translations(DEFAULT_LOCALE)
        return {}


def get_nested_value(data: dict, key: str, default: str = None) -> Optional[str]:
    """
    Get a nested value from a dictionary using dot notation.

    Args:
        data: Dictionary to search
        key: Dot-notation key (e.g., 'errors.not_found')
        default: Default value if key not found

    Returns:
        Value if found, default otherwise
    """
    keys = key.split('.')
    value = data

    for k in keys:
        if isinstance(value, dict) and k in value:
            value = value[k]
        else:
            return default

    return value if value != data else default


def t(key: str, locale: str = DEFAULT_LOCALE, **kwargs) -> str:
    """
    Translate a key to the target locale.

    Args:
        key: Translation key in dot notation (e.g., 'errors.not_found')
        locale: Target language code (default: 'en')
        **kwargs: Variables to interpolate into translation

    Returns:
        Translated string with variables interpolated

    Examples:
        >>> t('errors.not_found', 'en')
        'Resource not found'

        >>> t('errors.invalid_param', 'es', param='email')
        'Parámetro inválido: email'
    """
    # Normalize locale to 2-letter code
    locale = locale.split('-')[0].lower() if locale else DEFAULT_LOCALE

    if locale not in SUPPORTED_LOCALES:
        locale = DEFAULT_LOCALE

    # Load translations for this locale
    translations = load_translations(locale)

    # Get translation
    translation = get_nested_value(translations, key, key)

    # Interpolate variables
    if kwargs:
        try:
            translation = translation.format(**kwargs)
        except (KeyError, ValueError):
            # If interpolation fails, return uninterpolated string
            pass

    return translation


def get_locale_from_header(accept_language: Optional[str]) -> str:
    """
    Parse the Accept-Language header and return the best matching locale.

    Args:
        accept_language: Accept-Language header value (e.g., 'es-ES,es;q=0.9,en;q=0.8')

    Returns:
        Best matching locale code (e.g., 'es')

    Examples:
        >>> get_locale_from_header('es-ES,es;q=0.9,en;q=0.8')
        'es'

        >>> get_locale_from_header('fr-FR,fr;q=0.9')
        'fr'

        >>> get_locale_from_header(None)
        'en'
    """
    if not accept_language:
        return DEFAULT_LOCALE

    # Parse Accept-Language header
    # Format: "es-ES,es;q=0.9,en;q=0.8"
    languages = []
    for lang_part in accept_language.split(','):
        lang_part = lang_part.strip()
        if ';q=' in lang_part:
            lang, quality = lang_part.split(';q=')
            quality = float(quality)
        else:
            lang = lang_part
            quality = 1.0

        # Extract 2-letter language code
        lang_code = lang.split('-')[0].lower()
        languages.append((lang_code, quality))

    # Sort by quality (highest first)
    languages.sort(key=lambda x: x[1], reverse=True)

    # Find first supported language
    for lang_code, _ in languages:
        if lang_code in SUPPORTED_LOCALES:
            return lang_code

    return DEFAULT_LOCALE


def get_locale_from_request(request) -> str:
    """
    Extract locale from FastAPI request.

    Args:
        request: FastAPI Request object

    Returns:
        Locale code (e.g., 'es')
    """
    accept_language = request.headers.get('Accept-Language')
    return get_locale_from_header(accept_language)


class LocalizedHTTPException(Exception):
    """
    HTTP Exception with i18n support.

    Usage:
        raise LocalizedHTTPException(
            status_code=404,
            message_key='errors.conversation_not_found',
            locale='es'
        )
    """

    def __init__(
        self,
        status_code: int,
        message_key: str,
        locale: str = DEFAULT_LOCALE,
        **kwargs
    ):
        self.status_code = status_code
        self.message_key = message_key
        self.locale = locale
        self.message = t(message_key, locale, **kwargs)
        super().__init__(self.message)


def create_localized_error(
    status_code: int,
    message_key: str,
    locale: str = DEFAULT_LOCALE,
    **kwargs
) -> dict:
    """
    Create a localized error response.

    Args:
        status_code: HTTP status code
        message_key: Translation key for error message
        locale: Target locale
        **kwargs: Variables to interpolate

    Returns:
        Error response dictionary

    Example:
        >>> create_localized_error(404, 'errors.not_found', 'es')
        {'detail': 'Recurso no encontrado', 'message_key': 'errors.not_found'}
    """
    return {
        'detail': t(message_key, locale, **kwargs),
        'message_key': message_key,  # For client-side translation if needed
    }


# Convenience function for common errors
def not_found_error(locale: str = DEFAULT_LOCALE, resource: str = None):
    """404 Not Found error"""
    if resource:
        return create_localized_error(404, 'errors.resource_not_found', locale, resource=resource)
    return create_localized_error(404, 'errors.not_found', locale)


def unauthorized_error(locale: str = DEFAULT_LOCALE):
    """401 Unauthorized error"""
    return create_localized_error(401, 'errors.unauthorized', locale)


def forbidden_error(locale: str = DEFAULT_LOCALE):
    """403 Forbidden error"""
    return create_localized_error(403, 'errors.forbidden', locale)


def validation_error(locale: str = DEFAULT_LOCALE, field: str = None):
    """400 Validation error"""
    if field:
        return create_localized_error(400, 'errors.invalid_field', locale, field=field)
    return create_localized_error(400, 'errors.validation_failed', locale)


def server_error(locale: str = DEFAULT_LOCALE):
    """500 Internal Server Error"""
    return create_localized_error(500, 'errors.server_error', locale)
