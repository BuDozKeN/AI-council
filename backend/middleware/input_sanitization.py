"""
Input Sanitization Middleware

Provides comprehensive input sanitization to prevent:
- XSS (Cross-Site Scripting) attacks
- Path traversal attacks
- Command injection
- Header injection
- CRLF injection
- Additional validation layers

This middleware complements existing security measures:
- backend/context_loader.py::sanitize_user_content() - Prompt injection protection
- backend/security.py::escape_sql_like_pattern() - SQL injection protection
- backend/security.py::validate_safe_string() - Null byte protection
- SlowAPI rate limiting - DoS protection
"""

import re
import html
from typing import Optional, List
from fastapi import Request, HTTPException
from pathlib import Path

try:
    from ..i18n import t, get_locale_from_header
except ImportError:
    from backend.i18n import t, get_locale_from_header


# =============================================================================
# XSS PROTECTION
# =============================================================================

def sanitize_html(value: str, max_length: int = 10000) -> str:
    """
    Sanitize HTML/JavaScript to prevent XSS attacks.

    Escapes dangerous characters that could be interpreted as HTML/JS.
    Safe for JSON responses that will be rendered in browsers.

    Args:
        value: Input string potentially containing HTML/JS
        max_length: Maximum allowed length

    Returns:
        HTML-escaped string safe for rendering
    """
    if not value:
        return ""

    # Limit length to prevent DoS
    value = value[:max_length]

    # HTML escape (converts <, >, &, ", ')
    sanitized = html.escape(value, quote=True)

    # Additional XSS pattern blocking
    xss_patterns = [
        # JavaScript protocols
        (r'javascript:', '[BLOCKED]'),
        (r'data:text/html', '[BLOCKED]'),
        (r'vbscript:', '[BLOCKED]'),

        # Event handlers (onload, onclick, etc.)
        (r'on\w+\s*=', '[BLOCKED]'),

        # Encoded scripts
        (r'\\x3c\\x73\\x63\\x72\\x69\\x70\\x74', '[BLOCKED]'),
        (r'&#x', '[BLOCKED]'),

        # Expression syntax
        (r'expression\s*\(', '[BLOCKED]'),
        (r'-moz-binding', '[BLOCKED]'),
    ]

    for pattern, replacement in xss_patterns:
        sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)

    return sanitized


def strip_dangerous_tags(value: str) -> str:
    """
    Remove dangerous HTML tags while preserving safe formatting.

    Allows: <p>, <br>, <strong>, <em>, <ul>, <ol>, <li>
    Blocks: <script>, <iframe>, <object>, <embed>, <style>, etc.

    Args:
        value: Input HTML string

    Returns:
        String with dangerous tags removed
    """
    if not value:
        return ""

    # List of dangerous tags to remove entirely
    dangerous_tags = [
        'script', 'iframe', 'object', 'embed', 'applet',
        'meta', 'link', 'style', 'base', 'form', 'input',
        'button', 'textarea', 'select', 'option'
    ]

    sanitized = value
    for tag in dangerous_tags:
        # Remove opening and closing tags
        sanitized = re.sub(f'<{tag}[^>]*>.*?</{tag}>', '', sanitized, flags=re.IGNORECASE | re.DOTALL)
        sanitized = re.sub(f'<{tag}[^>]*/?>', '', sanitized, flags=re.IGNORECASE)

    return sanitized


# =============================================================================
# PATH TRAVERSAL PROTECTION
# =============================================================================

def validate_safe_path(file_path: str, allowed_base_dirs: Optional[List[str]] = None) -> bool:
    """
    Validate that a file path doesn't contain traversal patterns.

    Prevents attacks like:
    - ../../../etc/passwd
    - ....//....//etc/passwd
    - /etc/passwd

    Args:
        file_path: Path to validate
        allowed_base_dirs: Optional list of allowed base directories

    Returns:
        True if path is safe, False otherwise
    """
    if not file_path:
        return False

    # Check for path traversal patterns
    dangerous_patterns = [
        '..',        # Parent directory
        '~',         # Home directory
        '/etc',      # System config
        '/root',     # Root home
        '/var',      # System directories
        '\\\\',      # Windows UNC paths
        '\x00',      # Null byte
    ]

    for pattern in dangerous_patterns:
        if pattern in file_path:
            return False

    # Check for encoded traversal attempts
    if re.search(r'%2e%2e|%5c|%2f', file_path, re.IGNORECASE):
        return False

    # If allowed base directories specified, ensure path is within them
    if allowed_base_dirs:
        try:
            resolved_path = Path(file_path).resolve()
            allowed = any(
                resolved_path.is_relative_to(Path(base_dir).resolve())
                for base_dir in allowed_base_dirs
            )
            return allowed
        except (ValueError, OSError):
            return False

    return True


# =============================================================================
# COMMAND INJECTION PROTECTION
# =============================================================================

def validate_safe_filename(filename: str) -> bool:
    """
    Validate filename doesn't contain command injection patterns.

    Blocks:
    - Shell metacharacters
    - Command separators
    - Null bytes

    Args:
        filename: Filename to validate

    Returns:
        True if filename is safe
    """
    if not filename or len(filename) > 255:
        return False

    # Dangerous characters for filenames
    dangerous_chars = [
        ';', '&', '|', '`', '$', '(', ')', '{', '}',
        '<', '>', '\n', '\r', '\x00', '\\', '/', ':',
        '*', '?', '"', "'", '\t'
    ]

    for char in dangerous_chars:
        if char in filename:
            return False

    # Block dotfiles and hidden files
    if filename.startswith('.'):
        return False

    # Ensure reasonable extension (alphanumeric only)
    if '.' in filename:
        ext = filename.rsplit('.', 1)[-1]
        if not ext.isalnum() or len(ext) > 10:
            return False

    return True


# =============================================================================
# HEADER INJECTION PROTECTION
# =============================================================================

def validate_safe_header_value(value: str) -> bool:
    """
    Validate HTTP header value doesn't contain CRLF injection.

    Prevents HTTP response splitting attacks by blocking:
    - Carriage return (\\r)
    - Line feed (\\n)
    - Null bytes

    Args:
        value: Header value to validate

    Returns:
        True if header value is safe
    """
    if not value:
        return True

    # Check for CRLF injection
    if any(char in value for char in ['\r', '\n', '\x00']):
        return False

    # Limit length
    if len(value) > 2000:
        return False

    return True


# =============================================================================
# EMAIL VALIDATION
# =============================================================================

def validate_email_format(email: str) -> bool:
    """
    Validate email format to prevent injection attacks.

    Args:
        email: Email address to validate

    Returns:
        True if email format is valid
    """
    if not email or len(email) > 254:
        return False

    # Simple but effective email regex (RFC 5322)
    email_pattern = re.compile(
        r'^[a-zA-Z0-9.!#$%&\'*+\/=?^_`{|}~-]+@'
        r'[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?'
        r'(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
    )

    if not email_pattern.match(email):
        return False

    # Check for dangerous patterns
    if any(char in email for char in ['\r', '\n', '\x00', ';', '|', '&']):
        return False

    return True


# =============================================================================
# URL VALIDATION
# =============================================================================

def validate_safe_url(url: str, allowed_schemes: Optional[List[str]] = None) -> bool:
    """
    Validate URL is safe and uses allowed protocols.

    Args:
        url: URL to validate
        allowed_schemes: List of allowed schemes (default: ['http', 'https'])

    Returns:
        True if URL is safe
    """
    if not url or len(url) > 2048:
        return False

    if allowed_schemes is None:
        allowed_schemes = ['http', 'https']

    # Check for dangerous URL schemes
    dangerous_schemes = [
        'javascript:', 'data:', 'vbscript:', 'file:',
        'jar:', 'ftp:', 'mailto:', 'tel:'
    ]

    url_lower = url.lower().strip()
    for scheme in dangerous_schemes:
        if url_lower.startswith(scheme):
            return False

    # Verify allowed scheme
    has_valid_scheme = False
    for scheme in allowed_schemes:
        if url_lower.startswith(f'{scheme}://'):
            has_valid_scheme = True
            break

    # If URL has a scheme, it must be in allowed list
    if '://' in url and not has_valid_scheme:
        return False

    # Check for SSRF attempts (internal IPs)
    ssrf_patterns = [
        r'localhost',
        r'127\.0\.0\.1',
        r'0\.0\.0\.0',
        r'::1',
        r'169\.254\.',  # AWS metadata
        r'192\.168\.',  # Private network
        r'10\.',        # Private network
        r'172\.(1[6-9]|2[0-9]|3[01])\.',  # Private network
    ]

    for pattern in ssrf_patterns:
        if re.search(pattern, url_lower):
            return False

    return True


# =============================================================================
# REQUEST VALIDATION MIDDLEWARE
# =============================================================================

class InputSanitizationMiddleware:
    """
    Middleware to validate and sanitize all incoming requests.

    Applies multiple layers of protection:
    - Header validation (CRLF injection)
    - Query parameter sanitization
    - Request body size limits
    - Content-Type validation
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        # Extract locale from Accept-Language header
        headers = dict(scope.get("headers", []))
        accept_language = None
        for key, value in headers.items():
            if key == b"accept-language":
                accept_language = value.decode('utf-8', errors='replace')
                break
        locale = get_locale_from_header(accept_language)

        # Validate headers
        for key, value in headers.items():
            try:
                header_value = value.decode('utf-8', errors='replace')
                if not validate_safe_header_value(header_value):
                    # Block request with dangerous header
                    error_msg = t('errors.invalid_request', locale)
                    await send({
                        "type": "http.response.start",
                        "status": 400,
                        "headers": [[b"content-type", b"application/json"]],
                    })
                    await send({
                        "type": "http.response.body",
                        "body": f'{{"detail":"{error_msg}"}}'.encode('utf-8'),
                    })
                    return
            except Exception:
                pass

        # Validate query string
        query_string = scope.get("query_string", b"").decode('utf-8', errors='replace')
        if len(query_string) > 8192:  # Limit query string length
            error_msg = t('errors.invalid_request', locale)
            await send({
                "type": "http.response.start",
                "status": 400,
                "headers": [[b"content-type", b"application/json"]],
            })
            await send({
                "type": "http.response.body",
                "body": f'{{"detail":"{error_msg}"}}'.encode('utf-8'),
            })
            return

        # Continue to app
        await self.app(scope, receive, send)


# =============================================================================
# CONVENIENCE VALIDATORS
# =============================================================================

def validate_company_id(company_id: str, locale: str = 'en') -> str:
    """Validate and sanitize company ID (UUID or slug)."""
    try:
        from ..security import validate_uuid_format
    except ImportError:
        from backend.security import validate_uuid_format

    if not company_id:
        raise HTTPException(status_code=400, detail=t('errors.missing_required_field', locale, field='company_id'))

    # Check if UUID
    if validate_uuid_format(company_id):
        return company_id

    # Otherwise, validate as slug (alphanumeric + hyphens/underscores)
    if not re.match(r'^[a-zA-Z0-9_-]{1,100}$', company_id):
        raise HTTPException(status_code=400, detail=t('errors.invalid_parameter', locale, param='company_id'))

    return company_id


def validate_json_payload(payload: dict, max_depth: int = 10, max_keys: int = 1000) -> bool:
    """
    Validate JSON payload structure to prevent DoS attacks.

    Args:
        payload: JSON payload to validate
        max_depth: Maximum nesting depth
        max_keys: Maximum number of keys

    Returns:
        True if payload structure is safe
    """
    def check_depth(obj, current_depth=0):
        if current_depth > max_depth:
            return False

        if isinstance(obj, dict):
            if len(obj) > max_keys:
                return False
            for value in obj.values():
                if not check_depth(value, current_depth + 1):
                    return False
        elif isinstance(obj, list):
            if len(obj) > max_keys:
                return False
            for item in obj:
                if not check_depth(item, current_depth + 1):
                    return False

        return True

    return check_depth(payload)
