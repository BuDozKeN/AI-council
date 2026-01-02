"""FastAPI backend for LLM Council."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
import re
import os
import sys
import uuid
import signal
import asyncio
import contextvars
from datetime import datetime, timezone

# =============================================================================
# GRACEFUL SHUTDOWN MANAGEMENT
# =============================================================================
# Track in-flight requests and manage graceful shutdown

class ShutdownManager:
    """
    Manages graceful shutdown with in-flight request tracking.

    - Tracks active requests to allow them to complete
    - Blocks new requests during shutdown
    - Enforces maximum drain timeout
    """

    def __init__(self, drain_timeout: float = 30.0):
        self._shutting_down = False
        self._active_requests = 0
        self._lock = asyncio.Lock()
        self._drain_timeout = drain_timeout
        self._shutdown_event = asyncio.Event()

    @property
    def is_shutting_down(self) -> bool:
        return self._shutting_down

    @property
    def active_requests(self) -> int:
        return self._active_requests

    async def start_request(self) -> bool:
        """
        Register a new request. Returns False if shutting down.
        """
        async with self._lock:
            if self._shutting_down:
                return False
            self._active_requests += 1
            return True

    async def end_request(self) -> None:
        """Mark a request as completed."""
        async with self._lock:
            self._active_requests = max(0, self._active_requests - 1)
            if self._shutting_down and self._active_requests == 0:
                self._shutdown_event.set()

    async def initiate_shutdown(self) -> None:
        """Begin graceful shutdown process."""
        async with self._lock:
            self._shutting_down = True
            if self._active_requests == 0:
                self._shutdown_event.set()

    async def wait_for_drain(self) -> bool:
        """
        Wait for all requests to complete or timeout.
        Returns True if all requests completed, False if timed out.
        """
        try:
            await asyncio.wait_for(
                self._shutdown_event.wait(),
                timeout=self._drain_timeout
            )
            return True
        except asyncio.TimeoutError:
            return False

    def get_status(self) -> dict:
        """Get shutdown manager status."""
        return {
            "shutting_down": self._shutting_down,
            "active_requests": self._active_requests,
            "drain_timeout": self._drain_timeout
        }


# Global shutdown manager instance
_shutdown_manager = ShutdownManager(drain_timeout=30.0)


def get_shutdown_manager() -> ShutdownManager:
    """Get the global shutdown manager."""
    return _shutdown_manager

# =============================================================================
# REQUEST CORRELATION ID
# =============================================================================
# Context variable for request tracing across async operations
_correlation_id: contextvars.ContextVar[str] = contextvars.ContextVar('correlation_id', default='')


def get_correlation_id() -> str:
    """Get the current request's correlation ID for logging."""
    return _correlation_id.get() or 'no-correlation-id'


def set_correlation_id(correlation_id: str) -> contextvars.Token:
    """Set correlation ID for the current async context."""
    return _correlation_id.set(correlation_id)

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
    from .routers import v1_router
    from .schemas import error_response, ErrorCodes
except ImportError:
    from backend.context_loader import list_available_businesses
    from backend.auth import get_current_user
    from backend.routers import v1_router
    from backend.schemas import error_response, ErrorCodes


# =============================================================================
# APPLICATION LIFESPAN
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Startup:
    - Log application start
    - Set up signal handlers for graceful shutdown (Unix only)

    Shutdown:
    - Perform graceful shutdown with request draining
    - Clean up resources (HTTP clients, caches)
    """
    # === STARTUP ===
    log_app_event("APP_STARTUP", level="INFO", service="LLM Council API")

    # Set up signal handlers for graceful shutdown (Unix only)
    if sys.platform != "win32":
        loop = asyncio.get_event_loop()

        def signal_handler(sig):
            log_app_event(
                "SHUTDOWN_SIGNAL_RECEIVED",
                level="WARNING",
                signal=sig.name
            )
            asyncio.create_task(_graceful_shutdown())

        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda s=sig: signal_handler(s))

    yield  # Application runs here

    # === SHUTDOWN ===
    # If graceful shutdown wasn't triggered by signal, do cleanup now
    if not _shutdown_manager.is_shutting_down:
        await _graceful_shutdown()


# =============================================================================
# APP INITIALIZATION
# =============================================================================
app = FastAPI(
    title="LLM Council API",
    description="AI-powered decision council platform API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    openapi_tags=[
        {"name": "conversations", "description": "Council conversations and queries"},
        {"name": "knowledge", "description": "Knowledge entries and decisions"},
        {"name": "company", "description": "Company management"},
        {"name": "billing", "description": "Subscription and billing"},
        {"name": "settings", "description": "User settings"},
        {"name": "health", "description": "Health checks"},
    ]
)

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


class GracefulShutdownMiddleware(BaseHTTPMiddleware):
    """
    Track in-flight requests and reject new ones during shutdown.

    - Allows health checks during shutdown (for load balancer)
    - Returns 503 for new requests during shutdown
    - Tracks request lifecycle for graceful draining
    """

    HEALTH_PATHS = {"/health", "/health/live", "/health/ready"}

    async def dispatch(self, request, call_next):
        # Always allow health checks (load balancer needs them)
        if request.url.path in self.HEALTH_PATHS:
            return await call_next(request)

        # Check if we're shutting down
        if _shutdown_manager.is_shutting_down:
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Service is shutting down",
                    "retry_after": 5
                },
                headers={"Retry-After": "5"}
            )

        # Register request
        if not await _shutdown_manager.start_request():
            return JSONResponse(
                status_code=503,
                content={"detail": "Service is shutting down"}
            )

        try:
            return await call_next(request)
        finally:
            await _shutdown_manager.end_request()


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Add correlation ID to all requests for distributed tracing.

    - Accepts X-Correlation-ID from client (for cross-service tracing)
    - Generates new UUID if not provided
    - Returns correlation ID in response header
    - Sets context variable for use in logging throughout request
    """

    async def dispatch(self, request, call_next):
        # Get or generate correlation ID
        correlation_id = request.headers.get("X-Correlation-ID")
        if not correlation_id:
            correlation_id = str(uuid.uuid4())[:8]  # Short ID for readability

        # Set in context variable for logging
        token = set_correlation_id(correlation_id)

        try:
            response = await call_next(request)
            # Add correlation ID to response headers
            response.headers["X-Correlation-ID"] = correlation_id
            return response
        finally:
            # Reset context variable
            _correlation_id.reset(token)


class RequestDurationMiddleware(BaseHTTPMiddleware):
    """
    Track request duration for performance monitoring.

    - Logs slow requests (>1s warning, >5s error)
    - Adds X-Response-Time header to all responses
    - Excludes health check endpoints from slow request logging
    """

    SLOW_REQUEST_THRESHOLD = 1.0  # seconds - log warning
    VERY_SLOW_THRESHOLD = 5.0  # seconds - log error
    EXCLUDED_PATHS = {"/health", "/health/live", "/health/ready", "/"}

    async def dispatch(self, request, call_next):
        import time
        start_time = time.perf_counter()

        response = await call_next(request)

        duration = time.perf_counter() - start_time
        duration_ms = round(duration * 1000, 2)

        # Add timing header
        response.headers["X-Response-Time"] = f"{duration_ms}ms"

        # Log slow requests (except health checks)
        path = request.url.path
        if path not in self.EXCLUDED_PATHS:
            if duration >= self.VERY_SLOW_THRESHOLD:
                log_app_event(
                    "VERY_SLOW_REQUEST",
                    level="ERROR",
                    path=path,
                    method=request.method,
                    duration_ms=duration_ms,
                    status_code=response.status_code
                )
            elif duration >= self.SLOW_REQUEST_THRESHOLD:
                log_app_event(
                    "SLOW_REQUEST",
                    level="WARNING",
                    path=path,
                    method=request.method,
                    duration_ms=duration_ms,
                    status_code=response.status_code
                )

        return response


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


class APIVersionMiddleware(BaseHTTPMiddleware):
    """Add API version header and caching headers to API responses."""

    # Cacheable GET endpoints with their max-age in seconds
    CACHEABLE_PATHS = {
        "/api/v1/billing/plans": 3600,  # 1 hour - plans rarely change
        "/api/v1/leaderboard": 300,  # 5 minutes
    }

    # Paths that should never be cached
    NO_CACHE_PATTERNS = [
        "/api/v1/conversations",
        "/api/v1/knowledge",
        "/api/v1/settings",
        "/api/v1/billing/subscription",
        "/api/v1/billing/can-query",
    ]

    async def dispatch(self, request, call_next):
        response = await call_next(request)

        path = request.url.path
        method = request.method

        # Add version header to all /api/ responses
        if path.startswith("/api/"):
            response.headers["X-API-Version"] = "v1"

            # Add caching headers for GET requests
            if method == "GET" and response.status_code == 200:
                # Check if path should be cached
                cache_time = self.CACHEABLE_PATHS.get(path)

                if cache_time:
                    # Cacheable endpoint
                    response.headers["Cache-Control"] = f"public, max-age={cache_time}"
                elif any(path.startswith(p) for p in self.NO_CACHE_PATTERNS):
                    # Explicitly no cache for sensitive endpoints
                    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
                else:
                    # Default: short cache for other GET endpoints
                    response.headers["Cache-Control"] = "private, max-age=60"

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
        "X-Correlation-ID",
    ],
    expose_headers=["Content-Disposition", "X-Correlation-ID", "X-Response-Time", "X-API-Version", "Cache-Control"],
)
# Performance: Lower threshold to compress smaller API responses (e.g., JSON lists)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(APIVersionMiddleware)  # Add API version header
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestDurationMiddleware)  # Track request timing
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(GracefulShutdownMiddleware)  # Track in-flight requests
app.add_middleware(RequestSizeLimitMiddleware)


# =============================================================================
# EXCEPTION HANDLERS
# =============================================================================

def _get_cors_headers(request: Request) -> dict:
    """Get CORS headers if origin is allowed."""
    origin = request.headers.get("origin", "")
    if origin in CORS_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


def _map_status_to_error_code(status_code: int) -> str:
    """Map HTTP status codes to error codes."""
    mapping = {
        400: ErrorCodes.INVALID_INPUT,
        401: ErrorCodes.AUTH_TOKEN_INVALID,
        403: ErrorCodes.ACCESS_DENIED,
        404: ErrorCodes.RESOURCE_NOT_FOUND,
        422: ErrorCodes.VALIDATION_ERROR,
        429: ErrorCodes.RATE_LIMITED,
        500: ErrorCodes.INTERNAL_ERROR,
        503: ErrorCodes.SERVICE_UNAVAILABLE,
    }
    return mapping.get(status_code, ErrorCodes.INTERNAL_ERROR)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with standardized error response."""
    error_code = _map_status_to_error_code(exc.status_code)

    # Handle detail that might be a string or dict
    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(
            code=error_code,
            message=message
        ),
        headers=_get_cors_headers(request)
    )


from fastapi.exceptions import RequestValidationError


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with standardized error response."""
    log_app_event(f"VALIDATION: Validation error on {request.url.path}", level="WARNING", errors=str(exc.errors())[:200])

    # Extract first error for user-friendly message
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    field = ".".join(str(loc) for loc in first_error.get("loc", [])) or None
    message = first_error.get("msg", "Validation error")

    return JSONResponse(
        status_code=422,
        content=error_response(
            code=ErrorCodes.VALIDATION_ERROR,
            message=message,
            field=field,
            details={"errors": errors} if len(errors) > 1 else None
        ),
        headers=_get_cors_headers(request)
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unhandled exceptions with standardized error response."""
    import traceback
    import hashlib

    error_ref = hashlib.sha256(
        f"{datetime.now(timezone.utc).isoformat()}{type(exc).__name__}{str(exc)}".encode()
    ).hexdigest()[:8].upper()

    log_app_event(f"ERROR: Unhandled exception: {type(exc).__name__}", level="ERROR", ref=error_ref, path=request.url.path)

    environment = os.getenv("ENVIRONMENT", "development")
    if environment != "production":
        traceback.print_exc()

    return JSONResponse(
        status_code=500,
        content=error_response(
            code=ErrorCodes.INTERNAL_ERROR,
            message="An unexpected error occurred",
            reference=error_ref
        ),
        headers=_get_cors_headers(request)
    )


# =============================================================================
# INCLUDE ROUTERS
# =============================================================================
# Mount all API routers under /api/v1 prefix for versioned API
app.include_router(v1_router, prefix="/api/v1")


# =============================================================================
# GRACEFUL SHUTDOWN HELPERS
# =============================================================================
async def _graceful_shutdown():
    """
    Graceful shutdown procedure:
    1. Stop accepting new requests
    2. Wait for in-flight requests to complete (with timeout)
    3. Clean up resources
    """
    log_app_event(
        "GRACEFUL_SHUTDOWN_INITIATED",
        level="WARNING",
        active_requests=_shutdown_manager.active_requests
    )

    # Initiate shutdown (stops accepting new requests)
    await _shutdown_manager.initiate_shutdown()

    # Wait for in-flight requests to drain
    drained = await _shutdown_manager.wait_for_drain()

    if drained:
        log_app_event("GRACEFUL_SHUTDOWN_DRAINED", level="INFO")
    else:
        log_app_event(
            "GRACEFUL_SHUTDOWN_TIMEOUT",
            level="WARNING",
            remaining_requests=_shutdown_manager.active_requests
        )

    # Clean up resources
    await _cleanup_resources()


async def _cleanup_resources():
    """Clean up all resources on shutdown."""
    # Close HTTP client
    try:
        from .openrouter import _http_client
    except ImportError:
        try:
            from openrouter import _http_client
        except ImportError:
            _http_client = None

    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
        log_app_event("SHUTDOWN_HTTP_CLIENT_CLOSED", level="INFO")

    # Clear caches
    try:
        from .utils.cache import user_cache, company_cache, settings_cache
    except ImportError:
        from backend.utils.cache import user_cache, company_cache, settings_cache

    await user_cache.clear()
    await company_cache.clear()
    await settings_cache.clear()
    log_app_event("SHUTDOWN_CACHES_CLEARED", level="INFO")

    log_app_event("SHUTDOWN_COMPLETE", level="INFO")


# =============================================================================
# CORE ENDPOINTS (not in routers)
# =============================================================================
@app.get("/")
async def root():
    """Root endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


@app.get("/health")
async def health_check():
    """
    Comprehensive health check endpoint.

    Returns:
        - status: "healthy" | "degraded" | "unhealthy" | "draining"
        - checks: Individual dependency statuses
        - HTTP 200 if healthy/degraded, 503 if unhealthy/draining
    """
    checks = {}
    overall_healthy = True
    degraded = False

    # Check if shutting down
    if _shutdown_manager.is_shutting_down:
        return JSONResponse(
            status_code=503,
            content={
                "status": "draining",
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "active_requests": _shutdown_manager.active_requests,
                "checks": {}
            }
        )

    # Check database connectivity
    try:
        from .database import get_supabase, with_timeout
    except ImportError:
        from backend.database import get_supabase, with_timeout

    try:
        supabase = get_supabase()
        # Simple query to verify connection (with 5s timeout)
        await with_timeout(
            lambda: supabase.table("companies").select("id").limit(1).execute(),
            timeout=5.0,
            operation="health_check"
        )
        checks["database"] = {"status": "healthy", "latency_ms": None}
    except Exception as e:
        checks["database"] = {"status": "unhealthy", "error": str(e)[:100]}
        overall_healthy = False

    # Check circuit breaker status
    try:
        from .openrouter import get_circuit_breaker_status
    except ImportError:
        from backend.openrouter import get_circuit_breaker_status

    cb_status = get_circuit_breaker_status()
    if cb_status["state"] == "open":
        checks["llm_circuit_breaker"] = {
            "status": "unhealthy",
            "state": cb_status["state"],
            "recovery_in_seconds": cb_status.get("seconds_until_recovery")
        }
        degraded = True
    elif cb_status["state"] == "half_open":
        checks["llm_circuit_breaker"] = {
            "status": "degraded",
            "state": cb_status["state"],
            "failure_count": cb_status["failure_count"]
        }
        degraded = True
    else:
        checks["llm_circuit_breaker"] = {
            "status": "healthy",
            "state": cb_status["state"],
            "failure_count": cb_status["failure_count"]
        }

    # Check cache health
    try:
        from .utils.cache import user_cache, company_cache
    except ImportError:
        from backend.utils.cache import user_cache, company_cache

    checks["cache"] = {
        "status": "healthy",
        "user_cache_size": user_cache.stats()["size"],
        "company_cache_size": company_cache.stats()["size"]
    }

    # Determine overall status
    if not overall_healthy:
        status = "unhealthy"
        http_status = 503
    elif degraded:
        status = "degraded"
        http_status = 200
    else:
        status = "healthy"
        http_status = 200

    response = {
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "checks": checks
    }

    if http_status != 200:
        return JSONResponse(status_code=http_status, content=response)
    return response


@app.get("/health/live")
async def liveness_check():
    """
    Liveness probe - is the process running?
    Used by load balancers for basic health.
    """
    return {"status": "alive"}


@app.get("/health/ready")
async def readiness_check():
    """
    Readiness probe - is the service ready to accept traffic?
    Checks critical dependencies.
    """
    try:
        from .database import get_supabase, with_timeout
    except ImportError:
        from backend.database import get_supabase, with_timeout

    try:
        supabase = get_supabase()
        await with_timeout(
            lambda: supabase.table("companies").select("id").limit(1).execute(),
            timeout=3.0,
            operation="readiness_check"
        )
        return {"status": "ready"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": "database_unavailable"}
        )


@app.get("/health/metrics")
async def metrics_endpoint():
    """
    Real-time observability metrics endpoint.

    Returns Prometheus-compatible metrics for:
    - Circuit breaker states (per-model)
    - Cache hit rates and sizes
    - Request counts

    Use this for monitoring dashboards and alerting.
    """
    try:
        from .openrouter import get_all_circuit_breaker_statuses
    except ImportError:
        from backend.openrouter import get_all_circuit_breaker_statuses

    try:
        from .utils.cache import user_cache, company_cache
    except ImportError:
        from backend.utils.cache import user_cache, company_cache

    # Get circuit breaker states
    cb_statuses = get_all_circuit_breaker_statuses()

    # Count circuit breaker states
    cb_summary = {
        "total": len(cb_statuses),
        "closed": sum(1 for s in cb_statuses.values() if s.get("state") == "closed"),
        "open": sum(1 for s in cb_statuses.values() if s.get("state") == "open"),
        "half_open": sum(1 for s in cb_statuses.values() if s.get("state") == "half_open"),
    }

    # Get cache metrics
    user_stats = user_cache.stats()
    company_stats = company_cache.stats()

    return {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "circuit_breakers": {
            "summary": cb_summary,
            "models": cb_statuses,
        },
        "caches": {
            "user_cache": {
                "size": user_stats["size"],
                "max_size": user_stats["max_size"],
                "metrics": user_stats["metrics"],
            },
            "company_cache": {
                "size": company_stats["size"],
                "max_size": company_stats["max_size"],
                "metrics": company_stats["metrics"],
            },
        },
        "server": {
            "is_shutting_down": _shutdown_manager.is_shutting_down,
            "active_requests": _shutdown_manager.active_requests,
        },
    }


@app.get("/api/v1/businesses")
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
    uvicorn.run(app, host="0.0.0.0", port=8080)
