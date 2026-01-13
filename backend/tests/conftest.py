"""
Shared pytest fixtures for backend tests.

Provides mocked dependencies and test utilities.
"""

import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    return {
        "id": "test-user-123",
        "email": "test@example.com",
        "access_token": "mock-jwt-token",
        "aud": "authenticated",
    }


@pytest.fixture
def mock_company():
    """Create a mock company."""
    return {
        "id": "company-123",
        "name": "Test Company",
        "user_id": "test-user-123",
    }


@pytest.fixture
def mock_supabase_client():
    """Create a mock Supabase client."""
    client = MagicMock()

    # Mock table operations
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.insert.return_value = table_mock
    table_mock.update.return_value = table_mock
    table_mock.delete.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.single.return_value = table_mock
    table_mock.execute.return_value = MagicMock(data=[], error=None)

    client.table.return_value = table_mock
    return client


@pytest.fixture
def mock_supabase_service_client(mock_supabase_client):
    """Mock the service client (admin operations)."""
    return mock_supabase_client


@pytest.fixture
def mock_supabase_auth_client(mock_supabase_client):
    """Mock the auth client (user-scoped operations)."""
    return mock_supabase_client
