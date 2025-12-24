"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
import re
import os
from datetime import datetime

# =============================================================================
# SENTRY: Initialize error tracking FIRST (before anything else)
# =============================================================================
try:
    from .sentry import init_sentry, set_user_context, capture_exception
except ImportError:
    from backend.sentry import init_sentry, set_user_context, capture_exception

# Initialize Sentry before app creation to catch all errors
init_sentry()

# =============================================================================
# SECURITY: Rate limiting
# =============================================================================
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

try:
    from .security import SecureHTTPException, log_security_event, get_client_ip, log_app_event
except ImportError:
    from backend.security import SecureHTTPException, log_security_event, get_client_ip, log_app_event


def get_user_identifier(request: Request) -> str:
    """
    Get rate limit key from authenticated user ID or fall back to IP address.
    This ensures rate limits are per-user for authenticated requests.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        import hashlib
        token_hash = hashlib.sha256(auth_header[7:].encode()).hexdigest()[:16]
        return f"user:{token_hash}"
    return get_remote_address(request)


limiter = Limiter(key_func=get_user_identifier)


# =============================================================================
# SECURITY: Input validation for path parameters
# =============================================================================
SAFE_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)


def validate_safe_id(value: str, field_name: str = "id") -> str:
    """Validate that an ID only contains safe characters."""
    if not value or not SAFE_ID_PATTERN.match(value):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}: must contain only letters, numbers, underscores, and hyphens"
        )
    return value


def validate_uuid(value: str, field_name: str = "id") -> str:
    """Validate that a value is a properly formatted UUID."""
    if not value or not UUID_PATTERN.match(value):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}: must be a valid UUID"
        )
    return value


def ValidUUID(field_name: str = "id"):
    """Create a FastAPI dependency for validating UUID path parameters."""
    def validator(value: str) -> str:
        return validate_uuid(value, field_name)
    return validator


# =============================================================================
# MODULE IMPORTS
# =============================================================================
try:
    from .context_loader import list_available_businesses
    from .auth import get_current_user
    from .routers import (
        company_router,
        settings_router,
        conversations_router,
        projects_router,
        billing_router,
        knowledge_router,
        attachments_router,
        leaderboard_router,
        dev_settings_router,
        ai_utils_router,
        profile_router,
    )
except ImportError:
    from backend.context_loader import list_available_businesses
    from backend.auth import get_current_user
    from backend.routers import (
        company_router,
        settings_router,
        conversations_router,
        projects_router,
        billing_router,
        knowledge_router,
        attachments_router,
        leaderboard_router,
        dev_settings_router,
        ai_utils_router,
        profile_router,
    )


# =============================================================================
# APP INITIALIZATION
# =============================================================================
app = FastAPI(title="LLM Council API")

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS origins - load from environment or use defaults
_cors_env = os.environ.get("CORS_ORIGINS", "")
if _cors_env:
    CORS_ORIGINS = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
else:
    CORS_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:5178",
        "http://localhost:5179",
        "http://localhost:5180",
        "http://localhost:5181",
        "http://localhost:5182",
        "http://localhost:3000",
        "https://ai-council-three.vercel.app",
    ]


# =============================================================================
# SECURITY: Middleware
# =============================================================================
MAX_REQUEST_SIZE = 15 * 1024 * 1024  # 15MB max

from starlette.middleware.base import BaseHTTPMiddleware


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests that exceed the size limit to prevent DoS attacks."""

    async def dispatch(self, request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            if int(content_length) > MAX_REQUEST_SIZE:
                log_security_event(
                    "OVERSIZED_REQUEST",
                    ip_address=get_client_ip(request),
                    details={"size": content_length, "limit": MAX_REQUEST_SIZE},
                    severity="WARNING"
                )
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request too large"}
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)

        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openrouter.ai; "
            "font-src 'self' data:; "
            "frame-ancestors 'none';"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


# Add middleware in order (innermost to outermost on request)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "Cache-Control",
    ],
    expose_headers=["Content-Disposition"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)


# =============================================================================
# EXCEPTION HANDLERS
# =============================================================================
@app.exception_handler(HTTPException)
async def cors_exception_handler(request: Request, exc: HTTPException):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in CORS_ORIGINS:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers
    )


from fastapi.exceptions import RequestValidationError


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    log_app_event(f"VALIDATION: Validation error on {request.url.path}", level="WARNING", errors=str(exc.errors())[:200])
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in CORS_ORIGINS:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
        headers=headers
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    import traceback
    import hashlib

    error_ref = hashlib.sha256(
        f"{datetime.utcnow().isoformat()}{type(exc).__name__}{str(exc)}".encode()
    ).hexdigest()[:8].upper()

    log_app_event(f"ERROR: Unhandled exception: {type(exc).__name__}", level="ERROR", ref=error_ref, path=request.url.path)

    environment = os.getenv("ENVIRONMENT", "development")
    if environment != "production":
        traceback.print_exc()

    origin = request.headers.get("origin", "")
    headers = {}
    if origin in CORS_ORIGINS:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }

    return JSONResponse(
        status_code=500,
        content={"detail": f"An error occurred. Reference: {error_ref}"},
        headers=headers
    )


# =============================================================================
# INCLUDE ROUTERS
# =============================================================================
app.include_router(company_router)
app.include_router(settings_router)
app.include_router(conversations_router)
app.include_router(projects_router)
app.include_router(billing_router)
app.include_router(knowledge_router)
app.include_router(attachments_router)
app.include_router(leaderboard_router)
app.include_router(dev_settings_router)
app.include_router(ai_utils_router)
app.include_router(profile_router)


# =============================================================================
# APPLICATION LIFECYCLE
# =============================================================================
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on application shutdown."""
    try:
        from .openrouter import _http_client
    except ImportError:
        from openrouter import _http_client

    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()


# =============================================================================
# CORE ENDPOINTS (not in routers)
# =============================================================================
@app.get("/")
async def root():
    """Root endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


@app.get("/health")
async def health_check():
    """Health check endpoint to verify deployment."""
    return {"status": "healthy"}


@app.get("/api/businesses")
async def get_businesses(
    user: dict = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=100, description="Max companies to return"),
    offset: int = Query(default=0, ge=0, description="Number of companies to skip")
):
    """
    List available business contexts for the authenticated user.
    Supports pagination with limit/offset parameters.
    """
    user_id = user.get("id")
    result = list_available_businesses(user_id=user_id, limit=limit, offset=offset)
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
