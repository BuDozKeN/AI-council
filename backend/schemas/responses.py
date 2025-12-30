"""
Standardized API Response Schemas

Enterprise-grade response envelopes for consistent API responses.

Usage:
    from backend.schemas import success_response, paginated_response, error_response

    # Simple response
    return success_response({"id": "123", "name": "Example"})

    # Paginated response
    return paginated_response(
        data=items,
        limit=20,
        offset=0,
        total_count=100
    )

    # Error response (typically via exception handler)
    return error_response(
        code="VALIDATION_ERROR",
        message="Invalid input",
        status_code=400
    )
"""

from typing import Any, Optional, List, Generic, TypeVar
from pydantic import BaseModel, Field
from datetime import datetime

# API Version constant
API_VERSION = "v1"

T = TypeVar("T")


# =============================================================================
# META MODELS
# =============================================================================

class PaginationMeta(BaseModel):
    """Pagination metadata for list endpoints."""
    limit: int = Field(..., description="Number of items requested")
    offset: int = Field(..., description="Starting offset")
    has_more: bool = Field(..., description="Whether more items exist")
    total_count: Optional[int] = Field(None, description="Total count if available")


class ResponseMeta(BaseModel):
    """Metadata included in all API responses."""
    api_version: str = Field(default=API_VERSION, description="API version")
    timestamp: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z",
        description="Response timestamp in ISO 8601 format"
    )
    pagination: Optional[PaginationMeta] = Field(None, description="Pagination info for list endpoints")


# =============================================================================
# SUCCESS RESPONSE MODELS
# =============================================================================

class APIResponse(BaseModel):
    """
    Standard API response envelope.

    All successful API responses are wrapped in this format:
    {
        "data": { ... },
        "meta": {
            "api_version": "v1",
            "timestamp": "2025-01-01T00:00:00Z"
        }
    }
    """
    data: Any = Field(..., description="Response payload")
    meta: ResponseMeta = Field(default_factory=ResponseMeta, description="Response metadata")


class PaginatedResponse(BaseModel):
    """
    Paginated API response envelope.

    For list endpoints with pagination:
    {
        "data": [ ... ],
        "meta": {
            "api_version": "v1",
            "timestamp": "2025-01-01T00:00:00Z",
            "pagination": {
                "limit": 20,
                "offset": 0,
                "has_more": true,
                "total_count": 100
            }
        }
    }
    """
    data: List[Any] = Field(..., description="List of items")
    meta: ResponseMeta = Field(..., description="Response metadata with pagination")


# =============================================================================
# ERROR RESPONSE MODELS
# =============================================================================

class ErrorDetail(BaseModel):
    """
    Detailed error information.

    Error codes follow the pattern: DOMAIN_ACTION_REASON
    Examples: AUTH_TOKEN_EXPIRED, VALIDATION_FIELD_REQUIRED, RESOURCE_NOT_FOUND
    """
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    reference: Optional[str] = Field(None, description="Error reference ID for support")
    field: Optional[str] = Field(None, description="Field name for validation errors")
    details: Optional[dict] = Field(None, description="Additional error context")


class ErrorResponse(BaseModel):
    """
    Standard API error response envelope.

    All error responses follow this format:
    {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Invalid input provided",
            "reference": "ERR-ABC123",
            "details": { ... }
        },
        "meta": {
            "api_version": "v1",
            "timestamp": "2025-01-01T00:00:00Z"
        }
    }
    """
    error: ErrorDetail = Field(..., description="Error details")
    meta: ResponseMeta = Field(default_factory=ResponseMeta, description="Response metadata")


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def success_response(data: Any, **extra_meta) -> dict:
    """
    Create a standardized success response.

    Args:
        data: The response payload (dict, list, or any serializable type)
        **extra_meta: Additional metadata fields to include

    Returns:
        dict: Formatted response envelope
    """
    meta = {
        "api_version": API_VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        **extra_meta
    }
    return {"data": data, "meta": meta}


def paginated_response(
    data: List[Any],
    limit: int,
    offset: int,
    total_count: Optional[int] = None,
    **extra_meta
) -> dict:
    """
    Create a standardized paginated response.

    Args:
        data: List of items
        limit: Number of items requested
        offset: Starting offset
        total_count: Total count of items (optional)
        **extra_meta: Additional metadata fields

    Returns:
        dict: Formatted paginated response envelope
    """
    has_more = len(data) == limit  # If we got exactly limit items, there might be more

    # If we have total_count, use it for more accurate has_more
    if total_count is not None:
        has_more = offset + len(data) < total_count

    meta = {
        "api_version": API_VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "pagination": {
            "limit": limit,
            "offset": offset,
            "has_more": has_more,
            "total_count": total_count
        },
        **extra_meta
    }
    return {"data": data, "meta": meta}


def error_response(
    code: str,
    message: str,
    reference: Optional[str] = None,
    field: Optional[str] = None,
    details: Optional[dict] = None,
    status_code: int = 400
) -> dict:
    """
    Create a standardized error response.

    Args:
        code: Machine-readable error code (e.g., "VALIDATION_ERROR")
        message: Human-readable error message
        reference: Error reference ID for support
        field: Field name for validation errors
        details: Additional error context
        status_code: HTTP status code (not included in response, for handler use)

    Returns:
        dict: Formatted error response envelope
    """
    error = {"code": code, "message": message}

    if reference:
        error["reference"] = reference
    if field:
        error["field"] = field
    if details:
        error["details"] = details

    meta = {
        "api_version": API_VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

    return {"error": error, "meta": meta}


# =============================================================================
# ERROR CODE CONSTANTS
# =============================================================================

class ErrorCodes:
    """Standard error codes for consistent API errors."""

    # Authentication errors (401)
    AUTH_TOKEN_MISSING = "AUTH_TOKEN_MISSING"
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"
    AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID"

    # Authorization errors (403)
    ACCESS_DENIED = "ACCESS_DENIED"
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"

    # Resource errors (404)
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"

    # Validation errors (400, 422)
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_INPUT = "INVALID_INPUT"
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD"

    # Rate limiting (429)
    RATE_LIMITED = "RATE_LIMITED"

    # Server errors (500)
    INTERNAL_ERROR = "INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"

    # Business logic errors (400)
    SUBSCRIPTION_REQUIRED = "SUBSCRIPTION_REQUIRED"
    PLAN_LIMIT_REACHED = "PLAN_LIMIT_REACHED"
