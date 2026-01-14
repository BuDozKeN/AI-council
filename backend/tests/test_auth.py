"""
Tests for auth.py - JWT authentication utilities.

These tests verify:
1. Token validation and user extraction
2. Error handling for missing/invalid tokens
3. Optional authentication flow
4. Brute force protection (lockout after failures)
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

# Import the module under test
from backend.auth import get_current_user, get_optional_user


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def mock_request():
    """Create mock FastAPI Request with client IP."""
    request = MagicMock()
    request.client = MagicMock()
    request.client.host = "192.168.1.100"
    request.headers = {}
    return request


@pytest.fixture
def mock_credentials():
    """Create mock HTTP authorization credentials."""
    creds = MagicMock(spec=HTTPAuthorizationCredentials)
    creds.credentials = "valid-jwt-token-123"
    return creds


@pytest.fixture
def mock_user_response():
    """Create a mock Supabase user response."""
    user = MagicMock()
    user.id = "user-uuid-12345678"
    user.email = "test@example.com"

    response = MagicMock()
    response.user = user
    return response


# =============================================================================
# get_current_user Tests
# =============================================================================

class TestGetCurrentUser:
    """Test JWT token verification."""

    @pytest.mark.asyncio
    async def test_missing_credentials_raises_401(self, mock_request):
        """Should raise 401 when no credentials provided."""
        with patch('backend.auth.clear_auth_failures'):  # Don't track failures in test
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(request=mock_request, credentials=None)

            assert exc_info.value.status_code == 401
            assert exc_info.value.detail == "Authentication required"
            assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}

    @pytest.mark.asyncio
    async def test_valid_token_returns_user_data(self, mock_request, mock_credentials, mock_user_response):
        """Should return user dict for valid token."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            with patch('backend.auth.clear_auth_failures'):
                mock_supabase = MagicMock()
                mock_supabase.auth.get_user.return_value = mock_user_response
                mock_get_supabase.return_value = mock_supabase

                result = await get_current_user(request=mock_request, credentials=mock_credentials)

                assert result["id"] == "user-uuid-12345678"
                assert result["email"] == "test@example.com"
                assert result["access_token"] == "valid-jwt-token-123"

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self, mock_request, mock_credentials):
        """Should raise 401 when token is invalid."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            with patch('backend.auth.record_auth_failure'):
                mock_supabase = MagicMock()
                # Simulate invalid token - no user returned
                mock_response = MagicMock()
                mock_response.user = None
                mock_supabase.auth.get_user.return_value = mock_response
                mock_get_supabase.return_value = mock_supabase

                with pytest.raises(HTTPException) as exc_info:
                    await get_current_user(request=mock_request, credentials=mock_credentials)

                assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_none_response_raises_401(self, mock_request, mock_credentials):
        """Should raise 401 when Supabase returns None."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            with patch('backend.auth.record_auth_failure'):
                mock_supabase = MagicMock()
                mock_supabase.auth.get_user.return_value = None
                mock_get_supabase.return_value = mock_supabase

                with pytest.raises(HTTPException) as exc_info:
                    await get_current_user(request=mock_request, credentials=mock_credentials)

                assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_supabase_exception_raises_401(self, mock_request, mock_credentials):
        """Should raise 401 when Supabase throws exception."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            with patch('backend.auth.record_auth_failure'):
                mock_supabase = MagicMock()
                mock_supabase.auth.get_user.side_effect = Exception("Connection failed")
                mock_get_supabase.return_value = mock_supabase

                with pytest.raises(HTTPException) as exc_info:
                    await get_current_user(request=mock_request, credentials=mock_credentials)

                assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_user_id_converted_to_string(self, mock_request, mock_credentials):
        """Should convert user ID to string."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            with patch('backend.auth.clear_auth_failures'):
                mock_supabase = MagicMock()

                # Create user with UUID object (not string)
                from uuid import UUID
                user = MagicMock()
                user.id = UUID("12345678-1234-5678-1234-567812345678")
                user.email = "test@example.com"

                response = MagicMock()
                response.user = user
                mock_supabase.auth.get_user.return_value = response
                mock_get_supabase.return_value = mock_supabase

                result = await get_current_user(request=mock_request, credentials=mock_credentials)

                # Should be a string, not UUID
                assert isinstance(result["id"], str)
                assert result["id"] == "12345678-1234-5678-1234-567812345678"


# =============================================================================
# get_optional_user Tests
# =============================================================================

class TestGetOptionalUser:
    """Test optional authentication."""

    @pytest.mark.asyncio
    async def test_no_credentials_returns_none(self, mock_request):
        """Should return None when no credentials provided."""
        result = await get_optional_user(request=mock_request, credentials=None)
        assert result is None

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(self, mock_request, mock_credentials, mock_user_response):
        """Should return user for valid token."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            with patch('backend.auth.clear_auth_failures'):
                mock_supabase = MagicMock()
                mock_supabase.auth.get_user.return_value = mock_user_response
                mock_get_supabase.return_value = mock_supabase

                result = await get_optional_user(request=mock_request, credentials=mock_credentials)

                assert result is not None
                assert result["email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(self, mock_request, mock_credentials):
        """Should return None for invalid token (not raise)."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            with patch('backend.auth.record_auth_failure'):
                mock_supabase = MagicMock()
                mock_response = MagicMock()
                mock_response.user = None
                mock_supabase.auth.get_user.return_value = mock_response
                mock_get_supabase.return_value = mock_supabase

                # Should not raise, just return None
                result = await get_optional_user(request=mock_request, credentials=mock_credentials)
                assert result is None

    @pytest.mark.asyncio
    async def test_exception_returns_none(self, mock_request, mock_credentials):
        """Should return None on exception (not raise)."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            with patch('backend.auth.record_auth_failure'):
                mock_supabase = MagicMock()
                mock_supabase.auth.get_user.side_effect = Exception("Network error")
                mock_get_supabase.return_value = mock_supabase

                # Should not raise, just return None
                result = await get_optional_user(request=mock_request, credentials=mock_credentials)
                assert result is None


# =============================================================================
# Auth Failure Tracking Tests
# =============================================================================

class TestAuthFailureTracking:
    """Test brute force protection."""

    @pytest.mark.asyncio
    async def test_lockout_after_threshold_failures(self, mock_request):
        """Should return 429 when IP exceeds failure threshold."""
        from backend.auth import (
            _failed_attempts, _lockout_until, _LOCKOUT_THRESHOLD,
            is_ip_locked_out, record_auth_failure, clear_auth_failures
        )

        test_ip = "10.0.0.99"  # Unique IP for this test
        clear_auth_failures(test_ip)
        _lockout_until.pop(test_ip, None)  # Clear any existing lockout

        # Record enough failures to trigger lockout
        for _ in range(_LOCKOUT_THRESHOLD):
            record_auth_failure(test_ip)

        # Should now be locked out
        assert is_ip_locked_out(test_ip) is True

        # Clean up
        clear_auth_failures(test_ip)
        _lockout_until.pop(test_ip, None)

    @pytest.mark.asyncio
    async def test_lockout_persists_after_failure_window(self, mock_request):
        """Lockout should persist for full duration even after failure records expire."""
        from backend.auth import (
            _failed_attempts, _lockout_until, _LOCKOUT_THRESHOLD,
            _LOCKOUT_DURATION, is_ip_locked_out, record_auth_failure,
            clear_auth_failures
        )
        import time

        test_ip = "10.0.0.97"
        clear_auth_failures(test_ip)
        _lockout_until.pop(test_ip, None)

        # Record enough failures to trigger lockout
        for _ in range(_LOCKOUT_THRESHOLD):
            record_auth_failure(test_ip)

        # Verify lockout is active
        assert is_ip_locked_out(test_ip) is True

        # Simulate time passing - lockout should still be active
        # (We can't actually wait 15 min, so we verify the lockout timestamp is set correctly)
        assert test_ip in _lockout_until
        assert _lockout_until[test_ip] > time.time()
        assert _lockout_until[test_ip] <= time.time() + _LOCKOUT_DURATION

        # Clean up
        clear_auth_failures(test_ip)
        _lockout_until.pop(test_ip, None)

    @pytest.mark.asyncio
    async def test_retry_after_header_shows_remaining_time(self, mock_request):
        """Retry-After header should show actual remaining lockout time, not full duration."""
        from backend.auth import (
            _lockout_until, _LOCKOUT_THRESHOLD, _LOCKOUT_DURATION,
            record_auth_failure, clear_auth_failures, get_current_user
        )
        import time

        test_ip = "10.0.0.96"
        mock_request.client.host = test_ip
        clear_auth_failures(test_ip)
        _lockout_until.pop(test_ip, None)

        # Trigger lockout
        for _ in range(_LOCKOUT_THRESHOLD):
            record_auth_failure(test_ip)

        # Simulate partial time elapsed (set lockout to expire in 100 seconds)
        _lockout_until[test_ip] = time.time() + 100

        # Attempt auth - should get 429 with Retry-After close to 100
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request=mock_request, credentials=None)

        assert exc_info.value.status_code == 429
        retry_after = int(exc_info.value.headers["Retry-After"])
        # Should be close to 100, not 900
        assert 95 <= retry_after <= 100, f"Expected ~100, got {retry_after}"

        # Clean up
        clear_auth_failures(test_ip)
        _lockout_until.pop(test_ip, None)

    @pytest.mark.asyncio
    async def test_successful_auth_clears_failures(self, mock_request, mock_credentials, mock_user_response):
        """Should clear failed attempts on successful login."""
        from backend.auth import _failed_attempts, record_auth_failure, clear_auth_failures

        test_ip = "10.0.0.98"
        # Set mock request to use our test IP
        mock_request.client.host = test_ip
        clear_auth_failures(test_ip)

        # Record some failures
        record_auth_failure(test_ip)
        record_auth_failure(test_ip)
        assert len(_failed_attempts.get(test_ip, [])) == 2

        # Successful auth should clear
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            mock_supabase = MagicMock()
            mock_supabase.auth.get_user.return_value = mock_user_response
            mock_get_supabase.return_value = mock_supabase

            await get_current_user(request=mock_request, credentials=mock_credentials)

        # Failures should be cleared
        assert len(_failed_attempts.get(test_ip, [])) == 0
