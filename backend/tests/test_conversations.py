"""
Tests for conversations router

Tests the main API endpoints including:
- CRUD operations (create, read, list, delete)
- Star/archive functionality
- Rename and department update
- Bulk delete
- Export to markdown
- Input validation
- Authorization checks
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from fastapi import FastAPI

# Create test app with router
from backend.routers.conversations import router, _verify_conversation_ownership, _build_council_conversation_history
from fastapi import HTTPException


# =============================================================================
# UNIT TESTS - Helper Functions
# =============================================================================

class TestVerifyConversationOwnership:
    """Tests for _verify_conversation_ownership helper."""

    def test_allows_owner_access(self):
        """Should allow access when user owns conversation."""
        conversation = {"user_id": "user-123"}
        user = {"id": "user-123"}
        # Should not raise
        _verify_conversation_ownership(conversation, user)

    def test_denies_non_owner_access(self):
        """Should deny access when user doesn't own conversation."""
        conversation = {"user_id": "user-123"}
        user = {"id": "user-456"}
        with pytest.raises(HTTPException) as exc:
            _verify_conversation_ownership(conversation, user)
        assert exc.value.status_code == 403
        assert "forbidden" in exc.value.detail.lower()

    def test_allows_access_when_no_user_id_in_conversation(self):
        """Should allow access if conversation has no user_id (legacy data)."""
        conversation = {}
        user = {"id": "user-123"}
        # Should not raise
        _verify_conversation_ownership(conversation, user)

    def test_allows_access_when_user_id_is_none(self):
        """Should allow access if conversation user_id is None."""
        conversation = {"user_id": None}
        user = {"id": "user-123"}
        # Should not raise
        _verify_conversation_ownership(conversation, user)


class TestBuildCouncilConversationHistory:
    """Tests for _build_council_conversation_history helper."""

    def test_empty_conversation(self):
        """Should return empty list for empty conversation."""
        conversation = {"messages": []}
        result = _build_council_conversation_history(conversation)
        assert result == []

    def test_no_messages_key(self):
        """Should handle missing messages key."""
        conversation = {}
        result = _build_council_conversation_history(conversation)
        assert result == []

    def test_user_message_extraction(self):
        """Should extract user messages correctly."""
        conversation = {
            "messages": [
                {"role": "user", "content": "What about market expansion?"}
            ]
        }
        result = _build_council_conversation_history(conversation)
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "What about market expansion?"

    def test_assistant_message_with_stage1_and_stage3(self):
        """Should build comprehensive assistant response from stage1 and stage3."""
        conversation = {
            "messages": [
                {
                    "role": "assistant",
                    "stage1": [
                        {"model": "anthropic/claude-3", "response": "Expert opinion here"},
                        {"model": "openai/gpt-4", "response": "Another opinion"}
                    ],
                    "stage3": {"response": "Final synthesis"}
                }
            ]
        }
        result = _build_council_conversation_history(conversation)
        assert len(result) == 1
        assert result[0]["role"] == "assistant"
        assert "claude-3" in result[0]["content"]
        assert "Expert opinion here" in result[0]["content"]
        assert "Final synthesis" in result[0]["content"]

    def test_truncates_long_expert_responses(self):
        """Should truncate expert responses over 3000 chars."""
        long_response = "A" * 5000
        conversation = {
            "messages": [
                {
                    "role": "assistant",
                    "stage1": [{"model": "test/model", "response": long_response}],
                    "stage3": {}
                }
            ]
        }
        result = _build_council_conversation_history(conversation)
        assert len(result) == 1
        assert "[truncated]" in result[0]["content"]
        assert len(result[0]["content"]) < 5000

    def test_handles_stage3_content_key(self):
        """Should handle stage3 with 'content' key instead of 'response'."""
        conversation = {
            "messages": [
                {
                    "role": "assistant",
                    "stage1": [],
                    "stage3": {"content": "Synthesis via content key"}
                }
            ]
        }
        result = _build_council_conversation_history(conversation)
        assert len(result) == 1
        assert "Synthesis via content key" in result[0]["content"]

    def test_multiple_messages(self):
        """Should handle multiple user/assistant exchanges."""
        conversation = {
            "messages": [
                {"role": "user", "content": "First question"},
                {"role": "assistant", "stage1": [], "stage3": {"response": "First answer"}},
                {"role": "user", "content": "Follow up"},
                {"role": "assistant", "stage1": [], "stage3": {"response": "Second answer"}}
            ]
        }
        result = _build_council_conversation_history(conversation)
        assert len(result) == 4
        assert result[0]["content"] == "First question"
        assert "First answer" in result[1]["content"]
        assert result[2]["content"] == "Follow up"
        assert "Second answer" in result[3]["content"]


# =============================================================================
# INTEGRATION TESTS - API Endpoints
# =============================================================================

@pytest.fixture
def mock_user():
    """Mock authenticated user."""
    return {
        "id": "user-123",
        "email": "test@example.com",
        "access_token": "mock-token"
    }


@pytest.fixture
def mock_conversation():
    """Mock conversation data."""
    return {
        "id": "conv-123",
        "user_id": "user-123",
        "title": "Test Conversation",
        "messages": [],
        "created_at": "2024-01-01T00:00:00Z",
        "is_starred": False,
        "is_archived": False
    }


@pytest.fixture
def app(mock_user):
    """Create test FastAPI app with mocked auth."""
    app = FastAPI()
    app.include_router(router)

    # Override auth dependency
    async def override_get_current_user():
        return mock_user

    from backend.auth import get_current_user
    app.dependency_overrides[get_current_user] = override_get_current_user

    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


class TestListConversations:
    """Tests for GET /conversations endpoint."""

    def test_list_conversations_success(self, client, mock_user):
        """Should list conversations for authenticated user."""
        with patch('backend.routers.conversations.storage.list_conversations') as mock_list:
            mock_list.return_value = {
                "conversations": [
                    {"id": "conv-1", "title": "First"},
                    {"id": "conv-2", "title": "Second"}
                ],
                "has_more": False
            }

            response = client.get("/conversations")

            assert response.status_code == 200
            data = response.json()
            assert len(data["conversations"]) == 2
            assert data["has_more"] is False
            mock_list.assert_called_once()

    def test_list_with_pagination(self, client, mock_user):
        """Should pass pagination params to storage."""
        with patch('backend.routers.conversations.storage.list_conversations') as mock_list:
            mock_list.return_value = {"conversations": [], "has_more": True}

            response = client.get("/conversations?limit=10&offset=20")

            assert response.status_code == 200
            call_kwargs = mock_list.call_args[1]
            assert call_kwargs["limit"] == 10
            assert call_kwargs["offset"] == 20

    def test_list_with_search(self, client, mock_user):
        """Should pass search query to storage."""
        with patch('backend.routers.conversations.storage.list_conversations') as mock_list:
            mock_list.return_value = {"conversations": [], "has_more": False}

            response = client.get("/conversations?search=expansion")

            assert response.status_code == 200
            call_kwargs = mock_list.call_args[1]
            assert call_kwargs["search"] == "expansion"

    def test_list_filters_by_starred(self, client, mock_user):
        """Should filter by starred status client-side."""
        with patch('backend.routers.conversations.storage.list_conversations') as mock_list:
            mock_list.return_value = {
                "conversations": [
                    {"id": "conv-1", "is_starred": True},
                    {"id": "conv-2", "is_starred": False}
                ],
                "has_more": False
            }

            response = client.get("/conversations?starred=true")

            assert response.status_code == 200
            data = response.json()
            assert len(data["conversations"]) == 1
            assert data["conversations"][0]["id"] == "conv-1"


class TestCreateConversation:
    """Tests for POST /conversations endpoint."""

    def test_create_conversation_success(self, client, mock_user):
        """Should create a new conversation."""
        with patch('backend.routers.conversations.storage.create_conversation') as mock_create:
            mock_create.return_value = {
                "id": "new-conv-123",
                "user_id": "user-123",
                "title": "New Conversation",
                "messages": []
            }

            response = client.post("/conversations", json={})

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "new-conv-123"
            mock_create.assert_called_once()

    def test_create_with_company_id(self, client, mock_user):
        """Should pass company_id when provided."""
        with patch('backend.routers.conversations.storage.create_conversation') as mock_create:
            mock_create.return_value = {"id": "conv-123"}

            response = client.post("/conversations", json={"company_id": "company-456"})

            assert response.status_code == 200
            call_args = mock_create.call_args
            assert call_args[1]["company_id"] == "company-456"


class TestGetConversation:
    """Tests for GET /conversations/{id} endpoint."""

    def test_get_conversation_success(self, client, mock_user, mock_conversation):
        """Should return conversation for owner."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get:
            mock_get.return_value = mock_conversation

            response = client.get("/conversations/conv-123")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "conv-123"

    def test_get_conversation_not_found(self, client, mock_user):
        """Should return 404 for non-existent conversation."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get:
            mock_get.return_value = None

            response = client.get("/conversations/non-existent")

            assert response.status_code == 404

    def test_get_conversation_access_denied(self, client, mock_user):
        """Should return 403 for non-owner."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get:
            mock_get.return_value = {
                "id": "conv-123",
                "user_id": "other-user-456"  # Different user
            }

            response = client.get("/conversations/conv-123")

            assert response.status_code == 403


class TestRenameConversation:
    """Tests for PATCH /conversations/{id}/rename endpoint."""

    def test_rename_success(self, client, mock_user, mock_conversation):
        """Should rename conversation."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get, \
             patch('backend.routers.conversations.storage.update_conversation_title') as mock_rename:
            mock_get.return_value = mock_conversation
            mock_rename.return_value = None  # Doesn't return anything

            response = client.patch(
                "/conversations/conv-123/rename",
                json={"title": "New Title"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["title"] == "New Title"

    def test_rename_not_found(self, client, mock_user):
        """Should return 404 for non-existent conversation."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get:
            mock_get.return_value = None

            response = client.patch(
                "/conversations/non-existent/rename",
                json={"title": "New Title"}
            )

            assert response.status_code == 404


class TestStarConversation:
    """Tests for POST /conversations/{id}/star endpoint."""

    def test_star_success(self, client, mock_user, mock_conversation):
        """Should star a conversation."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get, \
             patch('backend.routers.conversations.storage.star_conversation') as mock_star:
            mock_get.return_value = mock_conversation
            mock_star.return_value = None

            response = client.post(
                "/conversations/conv-123/star",
                json={"starred": True}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["starred"] is True

    def test_unstar_success(self, client, mock_user, mock_conversation):
        """Should unstar a conversation."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get, \
             patch('backend.routers.conversations.storage.star_conversation') as mock_star:
            mock_get.return_value = {**mock_conversation, "is_starred": True}
            mock_star.return_value = None

            response = client.post(
                "/conversations/conv-123/star",
                json={"starred": False}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["starred"] is False


class TestArchiveConversation:
    """Tests for POST /conversations/{id}/archive endpoint."""

    def test_archive_success(self, client, mock_user, mock_conversation):
        """Should archive a conversation."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get, \
             patch('backend.routers.conversations.storage.archive_conversation') as mock_archive:
            mock_get.return_value = mock_conversation
            mock_archive.return_value = None

            response = client.post(
                "/conversations/conv-123/archive",
                json={"archived": True}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["archived"] is True


class TestDeleteConversation:
    """Tests for DELETE /conversations/{id} endpoint."""

    def test_delete_success(self, client, mock_user, mock_conversation):
        """Should delete a conversation."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get, \
             patch('backend.routers.conversations.storage.delete_conversation') as mock_delete:
            mock_get.return_value = mock_conversation
            mock_delete.return_value = True

            response = client.delete("/conversations/conv-123")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    def test_delete_not_found(self, client, mock_user):
        """Should return 404 for non-existent conversation."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get:
            mock_get.return_value = None

            response = client.delete("/conversations/non-existent")

            assert response.status_code == 404


class TestBulkDelete:
    """Tests for POST /conversations/bulk-delete endpoint."""

    def test_bulk_delete_success(self, client, mock_user, mock_conversation):
        """Should delete multiple conversations."""
        with patch('backend.routers.conversations.storage.get_conversations_by_ids') as mock_get_batch, \
             patch('backend.routers.conversations.storage.bulk_delete_conversations') as mock_bulk_delete:
            # Return all conversations as owned by user
            mock_get_batch.return_value = [
                {**mock_conversation, "id": "conv-1"},
                {**mock_conversation, "id": "conv-2"},
                {**mock_conversation, "id": "conv-3"}
            ]
            mock_bulk_delete.return_value = None

            response = client.post(
                "/conversations/bulk-delete",
                json={"conversation_ids": ["conv-1", "conv-2", "conv-3"]}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["deleted_count"] == 3
            assert len(data["deleted"]) == 3

    def test_bulk_delete_partial_failure(self, client, mock_user, mock_conversation):
        """Should report failed deletions when some conversations not found."""
        with patch('backend.routers.conversations.storage.get_conversations_by_ids') as mock_get_batch, \
             patch('backend.routers.conversations.storage.bulk_delete_conversations') as mock_bulk_delete:
            # Only return 2 conversations (third doesn't exist)
            mock_get_batch.return_value = [
                {**mock_conversation, "id": "conv-1"},
                {**mock_conversation, "id": "conv-2"}
            ]
            mock_bulk_delete.return_value = None

            response = client.post(
                "/conversations/bulk-delete",
                json={"conversation_ids": ["conv-1", "conv-2", "conv-3"]}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["deleted_count"] == 2
            assert len(data["failed"]) == 1
            assert data["failed"][0]["id"] == "conv-3"


class TestExportConversation:
    """Tests for GET /conversations/{id}/export endpoint."""

    def test_export_markdown_success(self, client, mock_user):
        """Should export conversation as markdown."""
        conversation_with_messages = {
            "id": "conv-123",
            "user_id": "user-123",
            "title": "Test Export",
            "messages": [
                {"role": "user", "content": "What's the strategy?"},
                {
                    "role": "assistant",
                    "stage1": [{"model": "test/model", "response": "Expert says..."}],
                    "stage3": {"response": "Final synthesis"}
                }
            ],
            "created_at": "2024-01-01T00:00:00Z"
        }

        with patch('backend.routers.conversations.storage.get_conversation') as mock_get:
            mock_get.return_value = conversation_with_messages

            response = client.get("/conversations/conv-123/export")

            assert response.status_code == 200
            assert "text/markdown" in response.headers["content-type"]
            assert "Test Export" in response.text
            assert "What's the strategy?" in response.text

    def test_export_not_found(self, client, mock_user):
        """Should return 404 for non-existent conversation."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get:
            mock_get.return_value = None

            response = client.get("/conversations/non-existent/export")

            assert response.status_code == 404


# =============================================================================
# INPUT VALIDATION TESTS
# =============================================================================

class TestInputValidation:
    """Tests for request validation."""

    def test_rename_requires_title(self, client, mock_user, mock_conversation):
        """Should reject rename without title."""
        with patch('backend.routers.conversations.storage.get_conversation') as mock_get:
            mock_get.return_value = mock_conversation

            response = client.patch(
                "/conversations/conv-123/rename",
                json={}
            )

            assert response.status_code == 422  # Validation error

    def test_bulk_delete_requires_ids(self, client, mock_user):
        """Should reject bulk delete without conversation_ids."""
        response = client.post(
            "/conversations/bulk-delete",
            json={}
        )

        assert response.status_code == 422

    def test_list_pagination_limits(self, client, mock_user):
        """Should enforce pagination limits."""
        with patch('backend.routers.conversations.storage.list_conversations') as mock_list:
            mock_list.return_value = {"conversations": [], "has_more": False}

            # Over limit (max 100)
            response = client.get("/conversations?limit=500")
            assert response.status_code == 422

            # Under limit (min 1)
            response = client.get("/conversations?limit=0")
            assert response.status_code == 422
