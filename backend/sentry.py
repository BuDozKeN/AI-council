"""
Sentry Error Tracking for Backend

Initializes Sentry for production error monitoring.
Set SENTRY_DSN environment variable to enable.

Release tracking:
- Set SENTRY_RELEASE to track deployments (e.g., git SHA or version)
- Render.com: Uses RENDER_GIT_COMMIT automatically
- CI/CD: Set SENTRY_RELEASE in your build pipeline
"""

import os
import subprocess

# Import logging utilities
try:
    from .security import log_app_event, log_error
except ImportError:
    from backend.security import log_app_event, log_error

# Try to import sentry_sdk, but gracefully handle if not installed
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False
    sentry_sdk = None

SENTRY_DSN = os.getenv("SENTRY_DSN")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production" or os.getenv("RENDER", False)


def _get_release_version() -> str | None:
    """
    Determine the release version for Sentry.

    Priority:
    1. SENTRY_RELEASE env var (explicit override)
    2. RENDER_GIT_COMMIT (Render.com deployments)
    3. Git SHA (local development)
    4. None (fallback)
    """
    # Explicit release override
    if release := os.getenv("SENTRY_RELEASE"):
        return release

    # Render.com provides the git commit SHA
    if render_commit := os.getenv("RENDER_GIT_COMMIT"):
        return f"axcouncil-backend@{render_commit[:8]}"

    # Try to get git SHA locally
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            return f"axcouncil-backend@{result.stdout.strip()}"
    except (subprocess.SubprocessError, FileNotFoundError, OSError):
        pass

    return None


def init_sentry():
    """Initialize Sentry SDK for FastAPI with release tracking."""
    if not SENTRY_AVAILABLE:
        if IS_PRODUCTION:
            log_app_event("sentry_init", level="WARNING", details={"status": "disabled", "reason": "sentry-sdk not installed"})
        return False

    if not SENTRY_DSN:
        if IS_PRODUCTION:
            log_app_event("sentry_init", level="WARNING", details={"status": "disabled", "reason": "DSN not configured"})
        return False

    release = _get_release_version()

    sentry_sdk.init(
        dsn=SENTRY_DSN,

        # Release version for deployment tracking
        release=release,

        # Environment tag
        environment=ENVIRONMENT if not IS_PRODUCTION else "production",

        # Capture 10% of transactions for performance monitoring in prod
        traces_sample_rate=0.1 if IS_PRODUCTION else 1.0,

        # Capture 100% of errors
        sample_rate=1.0,

        # Send PII (user IDs, emails) - adjust based on privacy requirements
        send_default_pii=False,

        # FastAPI integration
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],

        # Filter sensitive data from being sent
        before_send=before_send_filter,

        # Don't capture these common/noisy errors
        ignore_errors=[
            KeyboardInterrupt,
            SystemExit,
        ],
    )

    log_app_event("sentry_init", level="INFO", details={"status": "initialized", "environment": ENVIRONMENT, "release": release})
    return True


def before_send_filter(event, hint):
    """
    Filter and sanitize events before sending to Sentry.
    Remove sensitive data like tokens, passwords, API keys.
    """
    # List of sensitive keys to redact
    sensitive_keys = {
        'password', 'token', 'secret', 'key', 'api_key', 'apikey',
        'access_token', 'refresh_token', 'authorization', 'credential',
        'credentials', 'private_key', 'openrouter', 'stripe', 'supabase'
    }

    def redact_dict(d):
        """Recursively redact sensitive keys from a dictionary."""
        if not isinstance(d, dict):
            return d
        return {
            k: '[REDACTED]' if any(s in k.lower() for s in sensitive_keys) else redact_dict(v)
            for k, v in d.items()
        }

    # Redact request data
    if 'request' in event and 'data' in event['request']:
        event['request']['data'] = redact_dict(event['request'].get('data', {}))

    # Redact headers
    if 'request' in event and 'headers' in event['request']:
        headers = event['request']['headers']
        if isinstance(headers, dict):
            for key in list(headers.keys()):
                if any(s in key.lower() for s in sensitive_keys):
                    headers[key] = '[REDACTED]'

    return event


def set_user_context(user_id: str, email: str = None):
    """Set user context for Sentry events."""
    if not SENTRY_AVAILABLE or not SENTRY_DSN:
        return

    sentry_sdk.set_user({
        "id": user_id,
        "email": email,
    })


def clear_user_context():
    """Clear user context."""
    if not SENTRY_AVAILABLE or not SENTRY_DSN:
        return
    sentry_sdk.set_user(None)


def capture_exception(error, **context):
    """Capture an exception with additional context."""
    if not SENTRY_AVAILABLE or not SENTRY_DSN:
        return

    with sentry_sdk.push_scope() as scope:
        for key, value in context.items():
            scope.set_extra(key, value)
        sentry_sdk.capture_exception(error)


def capture_message(message: str, level: str = "info", **context):
    """Capture a message with additional context."""
    if not SENTRY_AVAILABLE or not SENTRY_DSN:
        return

    with sentry_sdk.push_scope() as scope:
        for key, value in context.items():
            scope.set_extra(key, value)
        sentry_sdk.capture_message(message, level=level)
