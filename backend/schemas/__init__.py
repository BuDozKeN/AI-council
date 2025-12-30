"""
API Response Schemas

Standardized response envelopes for enterprise-grade API consistency.
All API responses follow the same structure for predictable client handling.
"""

from .responses import (
    # Response models
    APIResponse,
    PaginatedResponse,
    ErrorResponse,
    ErrorDetail,
    PaginationMeta,
    ResponseMeta,
    # Helper functions
    success_response,
    paginated_response,
    error_response,
    # Constants
    API_VERSION,
    ErrorCodes,
)

__all__ = [
    "APIResponse",
    "PaginatedResponse",
    "ErrorResponse",
    "ErrorDetail",
    "PaginationMeta",
    "ResponseMeta",
    "success_response",
    "paginated_response",
    "error_response",
    "API_VERSION",
    "ErrorCodes",
]
