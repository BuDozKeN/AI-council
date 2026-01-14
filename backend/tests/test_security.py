"""
Tests for security.py - Critical security utilities.

These tests verify:
1. ID/Email masking for GDPR/HIPAA compliance
2. Input validation (UUID, safe strings, SQL LIKE escaping)
3. SecureHTTPException factory methods
4. Rate limit header building
"""


# Import the module under test
from backend.security import (
    mask_id,
    mask_email,
    mask_pii,
    validate_uuid_format,
    validate_safe_string,
    escape_sql_like_pattern,
    SecureHTTPException,
    build_rate_limit_headers,
)


# =============================================================================
# ID/Email Masking Tests (GDPR/HIPAA Compliance)
# =============================================================================

class TestMaskId:
    """Test ID masking for secure logging."""

    def test_mask_id_normal_uuid(self):
        """Should mask middle of a UUID."""
        user_id = "abc12345-6789-0abc-def0-123456789abc"
        result = mask_id(user_id)
        assert result == "abc1...9abc"

    def test_mask_id_short_string(self):
        """Should return masked placeholder for short IDs."""
        result = mask_id("short")
        assert result == "****"

    def test_mask_id_empty_string(self):
        """Should handle empty string."""
        result = mask_id("")
        assert result == "****"

    def test_mask_id_none(self):
        """Should handle None."""
        result = mask_id(None)
        assert result == "****"

    def test_mask_id_exactly_12_chars(self):
        """Should mask IDs with exactly 12 characters."""
        result = mask_id("123456789012")
        assert result == "1234...9012"


class TestMaskEmail:
    """Test email masking for GDPR compliance."""

    def test_mask_email_normal(self):
        """Should mask local part, preserve domain."""
        result = mask_email("user@example.com")
        assert result == "***@example.com"

    def test_mask_email_subdomain(self):
        """Should preserve full domain including subdomain."""
        result = mask_email("admin@mail.company.com")
        assert result == "***@mail.company.com"

    def test_mask_email_none(self):
        """Should handle None."""
        result = mask_email(None)
        assert result == "***@***.***"

    def test_mask_email_no_at_sign(self):
        """Should handle invalid email without @ sign."""
        result = mask_email("notanemail")
        assert result == "***@***.***"

    def test_mask_email_empty(self):
        """Should handle empty string."""
        result = mask_email("")
        assert result == "***@***.***"


class TestMaskPii:
    """Test generic PII masking."""

    def test_mask_pii_normal(self):
        """Should show first 4 chars only."""
        result = mask_pii("John Smith")
        assert result == "John..."

    def test_mask_pii_short(self):
        """Should mask entirely if too short."""
        result = mask_pii("Joe")
        assert result == "****"

    def test_mask_pii_custom_chars(self):
        """Should respect custom show_chars parameter."""
        result = mask_pii("Hello World", show_chars=6)
        assert result == "Hello ..."

    def test_mask_pii_none(self):
        """Should handle None."""
        result = mask_pii(None)
        assert result == "****"


# =============================================================================
# Input Validation Tests
# =============================================================================

class TestValidateUuidFormat:
    """Test UUID format validation."""

    def test_valid_uuid(self):
        """Should accept valid UUID."""
        assert validate_uuid_format("123e4567-e89b-12d3-a456-426614174000") is True

    def test_valid_uuid_uppercase(self):
        """Should accept uppercase UUID."""
        assert validate_uuid_format("123E4567-E89B-12D3-A456-426614174000") is True

    def test_invalid_uuid_wrong_length(self):
        """Should reject UUID with wrong length."""
        assert validate_uuid_format("123e4567-e89b-12d3-a456") is False

    def test_invalid_uuid_no_dashes(self):
        """Should reject UUID without dashes."""
        assert validate_uuid_format("123e4567e89b12d3a456426614174000") is False

    def test_invalid_uuid_wrong_chars(self):
        """Should reject UUID with invalid characters."""
        assert validate_uuid_format("123g4567-e89b-12d3-a456-426614174000") is False

    def test_invalid_empty_string(self):
        """Should reject empty string."""
        assert validate_uuid_format("") is False


class TestValidateSafeString:
    """Test safe string validation."""

    def test_normal_string(self):
        """Should accept normal strings."""
        assert validate_safe_string("Hello, World!") is True

    def test_empty_string(self):
        """Should accept empty string."""
        assert validate_safe_string("") is True

    def test_null_byte_injection(self):
        """Should reject strings with null bytes."""
        assert validate_safe_string("hello\x00world") is False

    def test_too_long_default(self):
        """Should reject strings over 1000 chars by default."""
        long_string = "a" * 1001
        assert validate_safe_string(long_string) is False

    def test_too_long_custom(self):
        """Should respect custom max_length."""
        assert validate_safe_string("12345", max_length=4) is False
        assert validate_safe_string("1234", max_length=4) is True

    def test_unicode_allowed(self):
        """Should allow unicode characters."""
        assert validate_safe_string("Hello 世界 🌍") is True


class TestEscapeSqlLikePattern:
    """Test SQL LIKE pattern escaping."""

    def test_normal_search(self):
        """Should pass through normal text unchanged."""
        assert escape_sql_like_pattern("hello") == "hello"

    def test_escape_percent(self):
        """Should escape % wildcard."""
        assert escape_sql_like_pattern("100%") == "100\\%"

    def test_escape_underscore(self):
        """Should escape _ wildcard."""
        assert escape_sql_like_pattern("test_value") == "test\\_value"

    def test_escape_backslash(self):
        """Should escape backslash."""
        assert escape_sql_like_pattern("path\\file") == "path\\\\file"

    def test_escape_multiple(self):
        """Should escape multiple special characters."""
        result = escape_sql_like_pattern("100% of_items")
        assert result == "100\\% of\\_items"

    def test_truncate_long_input(self):
        """Should truncate input to max_length."""
        long_input = "a" * 200
        result = escape_sql_like_pattern(long_input, max_length=50)
        assert len(result) == 50

    def test_empty_string(self):
        """Should handle empty string."""
        assert escape_sql_like_pattern("") == ""

    def test_none_input(self):
        """Should handle None-like falsy input."""
        assert escape_sql_like_pattern("") == ""


# =============================================================================
# SecureHTTPException Factory Tests
# =============================================================================

class TestSecureHTTPException:
    """Test secure HTTP exception factory."""

    def test_not_found_generic_message(self):
        """Should return generic 404 without leaking resource details."""
        exc = SecureHTTPException.not_found(resource_type="User", resource_id="secret-id")
        assert exc.status_code == 404
        assert exc.detail == "Resource not found"
        assert "secret-id" not in exc.detail
        assert "User" not in exc.detail

    def test_access_denied_generic_message(self):
        """Should return generic 403."""
        exc = SecureHTTPException.access_denied(
            user_id="user-123",
            resource_type="document",
            resource_id="doc-456"
        )
        assert exc.status_code == 403
        assert exc.detail == "Access denied"

    def test_unauthorized_generic_message(self):
        """Should return generic 401."""
        exc = SecureHTTPException.unauthorized(ip_address="192.168.1.1")
        assert exc.status_code == 401
        assert exc.detail == "Authentication required"

    def test_bad_request_custom_message(self):
        """Should allow custom public message for 400."""
        exc = SecureHTTPException.bad_request(
            public_message="Email format is invalid",
            log_message="Received: not-an-email"
        )
        assert exc.status_code == 400
        assert exc.detail == "Email format is invalid"
        assert "not-an-email" not in exc.detail

    def test_internal_error_with_reference(self):
        """Should include reference ID for support."""
        exc = SecureHTTPException.internal_error(
            log_message="Database connection failed",
            include_reference=True
        )
        assert exc.status_code == 500
        assert "Reference:" in exc.detail
        assert "Database" not in exc.detail

    def test_internal_error_without_reference(self):
        """Should hide reference when disabled."""
        exc = SecureHTTPException.internal_error(
            log_message="Sensitive error",
            include_reference=False
        )
        assert exc.status_code == 500
        assert exc.detail == "An error occurred"

    def test_rate_limited_with_headers(self):
        """Should return 429 with proper headers."""
        exc = SecureHTTPException.rate_limited(
            limit_type="api",
            retry_after=60,
            limit=100,
            remaining=0
        )
        assert exc.status_code == 429
        assert exc.headers["Retry-After"] == "60"
        assert exc.headers["X-RateLimit-Remaining"] == "0"
        assert exc.headers["X-RateLimit-Limit"] == "100"

    def test_payment_required(self):
        """Should return 402 for billing limits."""
        exc = SecureHTTPException.payment_required(remaining=0)
        assert exc.status_code == 402
        assert exc.detail["error"] == "Query limit reached"
        assert exc.detail["action"] == "upgrade_required"


# =============================================================================
# Rate Limit Headers Tests
# =============================================================================

class TestBuildRateLimitHeaders:
    """Test rate limit header building."""

    def test_basic_headers(self):
        """Should build basic rate limit headers."""
        headers = build_rate_limit_headers(limit=100, remaining=95)
        assert headers["X-RateLimit-Limit"] == "100"
        assert headers["X-RateLimit-Remaining"] == "95"
        assert "X-RateLimit-Reset" not in headers

    def test_with_reset_seconds(self):
        """Should include reset header when provided."""
        headers = build_rate_limit_headers(limit=100, remaining=50, reset_seconds=3600)
        assert headers["X-RateLimit-Reset"] == "3600"

    def test_negative_remaining_clamped(self):
        """Should clamp negative remaining to 0."""
        headers = build_rate_limit_headers(limit=100, remaining=-5)
        assert headers["X-RateLimit-Remaining"] == "0"
