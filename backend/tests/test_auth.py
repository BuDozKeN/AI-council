"""
Tests for auth.py - JWT authentication utilities.

These tests verify:
1. Token validation and user extraction
2. Error handling for missing/invalid tokens
3. Optional authentication flow
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
    async def test_missing_credentials_raises_401(self):
        """Should raise 401 when no credentials provided."""
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials=None)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Authentication required"
        assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}

    @pytest.mark.asyncio
    async def test_valid_token_returns_user_data(self, mock_credentials, mock_user_response):
        """Should return user dict for valid token."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            mock_supabase = MagicMock()
            mock_supabase.auth.get_user.return_value = mock_user_response
            mock_get_supabase.return_value = mock_supabase

            result = await get_current_user(credentials=mock_credentials)

            assert result["id"] == "user-uuid-12345678"
            assert result["email"] == "test@example.com"
            assert result["access_token"] == "valid-jwt-token-123"

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self, mock_credentials):
        """Should raise 401 when token is invalid."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            mock_supabase = MagicMock()
            # Simulate invalid token - no user returned
            mock_response = MagicMock()
            mock_response.user = None
            mock_supabase.auth.get_user.return_value = mock_response
            mock_get_supabase.return_value = mock_supabase

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials=mock_credentials)

            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_none_response_raises_401(self, mock_credentials):
        """Should raise 401 when Supabase returns None."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            mock_supabase = MagicMock()
            mock_supabase.auth.get_user.return_value = None
            mock_get_supabase.return_value = mock_supabase

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials=mock_credentials)

            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_supabase_exception_raises_401(self, mock_credentials):
        """Should raise 401 when Supabase throws exception."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            mock_supabase = MagicMock()
            mock_supabase.auth.get_user.side_effect = Exception("Connection failed")
            mock_get_supabase.return_value = mock_supabase

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials=mock_credentials)

            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_user_id_converted_to_string(self, mock_credentials):
        """Should convert user ID to string."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
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

            result = await get_current_user(credentials=mock_credentials)

            # Should be a string, not UUID
            assert isinstance(result["id"], str)
            assert result["id"] == "12345678-1234-5678-1234-567812345678"


# =============================================================================
# get_optional_user Tests
# =============================================================================

class TestGetOptionalUser:
    """Test optional authentication."""

    @pytest.mark.asyncio
    async def test_no_credentials_returns_none(self):
        """Should return None when no credentials provided."""
        result = await get_optional_user(credentials=None)
        assert result is None

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(self, mock_credentials, mock_user_response):
        """Should return user for valid token."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            mock_supabase = MagicMock()
            mock_supabase.auth.get_user.return_value = mock_user_response
            mock_get_supabase.return_value = mock_supabase

            result = await get_optional_user(credentials=mock_credentials)

            assert result is not None
            assert result["email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(self, mock_credentials):
        """Should return None for invalid token (not raise)."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            mock_supabase = MagicMock()
            mock_response = MagicMock()
            mock_response.user = None
            mock_supabase.auth.get_user.return_value = mock_response
            mock_get_supabase.return_value = mock_supabase

            # Should not raise, just return None
            result = await get_optional_user(credentials=mock_credentials)
            assert result is None

    @pytest.mark.asyncio
    async def test_exception_returns_none(self, mock_credentials):
        """Should return None on exception (not raise)."""
        with patch('backend.auth.get_supabase') as mock_get_supabase:
            mock_supabase = MagicMock()
            mock_supabase.auth.get_user.side_effect = Exception("Network error")
            mock_get_supabase.return_value = mock_supabase

            # Should not raise, just return None
            result = await get_optional_user(credentials=mock_credentials)
            assert result is None
