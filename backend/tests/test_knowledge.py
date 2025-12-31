"""
Tests for knowledge router.

These tests verify:
1. UUID validation
2. Pydantic model validation
3. Knowledge entry field constraints
"""

import pytest
import re
from pydantic import ValidationError

# Import the module under test
from backend.routers.knowledge import (
    UUID_PATTERN,
    validate_uuid,
    CreateKnowledgeRequest,
    UpdateKnowledgeRequest,
    ExtractDecisionRequest,
)


# =============================================================================
# UUID Validation Tests
# =============================================================================

class TestUUIDPattern:
    """Test UUID pattern matching."""

    def test_valid_uuid_lowercase(self):
        """Should match lowercase UUID."""
        uuid = "123e4567-e89b-12d3-a456-426614174000"
        assert UUID_PATTERN.match(uuid) is not None

    def test_valid_uuid_uppercase(self):
        """Should match uppercase UUID."""
        uuid = "123E4567-E89B-12D3-A456-426614174000"
        assert UUID_PATTERN.match(uuid) is not None

    def test_invalid_uuid_format(self):
        """Should reject invalid UUID formats."""
        invalid_uuids = [
            "",
            "not-a-uuid",
            "123e4567e89b12d3a456426614174000",  # No dashes  # pragma: allowlist secret
            "123e4567-e89b-12d3-a456",  # Too short
        ]
        for uuid in invalid_uuids:
            assert UUID_PATTERN.match(uuid) is None


class TestValidateUuid:
    """Test validate_uuid function."""

    def test_valid_uuid_returns_value(self):
        """Should return the UUID for valid input."""
        uuid = "123e4567-e89b-12d3-a456-426614174000"
        result = validate_uuid(uuid, "test_id")
        assert result == uuid

    def test_invalid_uuid_raises_400(self):
        """Should raise 400 for invalid UUID."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            validate_uuid("invalid-uuid", "test_id")

        assert exc_info.value.status_code == 400
        assert "Invalid test_id" in exc_info.value.detail

    def test_empty_uuid_raises_400(self):
        """Should raise 400 for empty UUID."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            validate_uuid("", "entry_id")

        assert exc_info.value.status_code == 400

    def test_none_uuid_raises_400(self):
        """Should raise 400 for None UUID."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            validate_uuid(None, "entry_id")

        assert exc_info.value.status_code == 400


# =============================================================================
# CreateKnowledgeRequest Tests
# =============================================================================

class TestCreateKnowledgeRequest:
    """Test CreateKnowledgeRequest model validation."""

    def test_minimal_valid_request(self):
        """Should create with minimal required fields."""
        req = CreateKnowledgeRequest(
            company_id="company-123",
            title="Test Decision"
        )
        assert req.company_id == "company-123"
        assert req.title == "Test Decision"
        assert req.category == "technical_decision"  # Default
        assert req.auto_inject is False  # Default
        assert req.scope == "company"  # Default

    def test_full_valid_request(self):
        """Should create with all fields populated."""
        req = CreateKnowledgeRequest(
            company_id="company-123",
            title="API Design Decision",
            summary="We chose REST over GraphQL",
            category="architecture",
            department_id="dept-456",
            role_id="role-789",
            project_id="proj-abc",
            source_conversation_id="conv-def",
            source_message_id="msg-ghi",
            problem_statement="Need to choose API style",
            decision_text="Use REST",
            reasoning="Better tooling and simpler",
            status="approved",
            body_md="# Full Document\n...",
            version="1.0.0",
            auto_inject=True,
            scope="department",
            tags=["api", "architecture"]
        )
        assert req.title == "API Design Decision"
        assert req.auto_inject is True
        assert req.scope == "department"
        assert req.tags == ["api", "architecture"]

    def test_title_max_length(self):
        """Should enforce title max length of 500."""
        long_title = "x" * 501
        with pytest.raises(ValidationError) as exc_info:
            CreateKnowledgeRequest(
                company_id="company-123",
                title=long_title
            )
        assert "title" in str(exc_info.value)

    def test_title_at_max_length(self):
        """Should accept title at exactly max length."""
        max_title = "x" * 500
        req = CreateKnowledgeRequest(
            company_id="company-123",
            title=max_title
        )
        assert len(req.title) == 500

    def test_summary_max_length(self):
        """Should enforce summary max length of 10000."""
        long_summary = "x" * 10001
        with pytest.raises(ValidationError):
            CreateKnowledgeRequest(
                company_id="company-123",
                title="Test",
                summary=long_summary
            )

    def test_body_md_max_length(self):
        """Should enforce body_md max length of 100000."""
        long_body = "x" * 100001
        with pytest.raises(ValidationError):
            CreateKnowledgeRequest(
                company_id="company-123",
                title="Test",
                body_md=long_body
            )

    def test_missing_required_company_id(self):
        """Should require company_id."""
        with pytest.raises(ValidationError) as exc_info:
            CreateKnowledgeRequest(title="Test")
        assert "company_id" in str(exc_info.value)

    def test_missing_required_title(self):
        """Should require title."""
        with pytest.raises(ValidationError) as exc_info:
            CreateKnowledgeRequest(company_id="company-123")
        assert "title" in str(exc_info.value)


# =============================================================================
# UpdateKnowledgeRequest Tests
# =============================================================================

class TestUpdateKnowledgeRequest:
    """Test UpdateKnowledgeRequest model validation."""

    def test_empty_update_valid(self):
        """Should allow empty update (no fields changed)."""
        req = UpdateKnowledgeRequest()
        assert req.title is None
        assert req.summary is None

    def test_partial_update(self):
        """Should allow partial updates."""
        req = UpdateKnowledgeRequest(
            title="Updated Title",
            status="approved"
        )
        assert req.title == "Updated Title"
        assert req.status == "approved"
        assert req.summary is None

    def test_title_max_length(self):
        """Should enforce title max length on update."""
        long_title = "x" * 501
        with pytest.raises(ValidationError):
            UpdateKnowledgeRequest(title=long_title)

    def test_tags_update(self):
        """Should allow updating tags."""
        req = UpdateKnowledgeRequest(tags=["new-tag", "updated"])
        assert req.tags == ["new-tag", "updated"]

    def test_auto_inject_update(self):
        """Should allow updating auto_inject flag."""
        req = UpdateKnowledgeRequest(auto_inject=True)
        assert req.auto_inject is True


# =============================================================================
# ExtractDecisionRequest Tests
# =============================================================================

class TestExtractDecisionRequest:
    """Test ExtractDecisionRequest model validation."""

    def test_valid_request(self):
        """Should create valid extraction request."""
        req = ExtractDecisionRequest(
            user_question="How should we handle authentication?",
            council_response="The council recommends using JWT tokens..."
        )
        assert "authentication" in req.user_question
        assert "JWT" in req.council_response

    def test_missing_user_question(self):
        """Should require user_question."""
        with pytest.raises(ValidationError) as exc_info:
            ExtractDecisionRequest(
                council_response="Some response"
            )
        assert "user_question" in str(exc_info.value)

    def test_missing_council_response(self):
        """Should require council_response."""
        with pytest.raises(ValidationError) as exc_info:
            ExtractDecisionRequest(
                user_question="Some question"
            )
        assert "council_response" in str(exc_info.value)

    def test_user_question_max_length(self):
        """Should enforce user_question max length of 10000."""
        long_question = "x" * 10001
        with pytest.raises(ValidationError):
            ExtractDecisionRequest(
                user_question=long_question,
                council_response="Response"
            )

    def test_council_response_max_length(self):
        """Should enforce council_response max length of 50000."""
        long_response = "x" * 50001
        with pytest.raises(ValidationError):
            ExtractDecisionRequest(
                user_question="Question",
                council_response=long_response
            )

    def test_at_max_lengths(self):
        """Should accept at exactly max lengths."""
        req = ExtractDecisionRequest(
            user_question="x" * 10000,
            council_response="y" * 50000
        )
        assert len(req.user_question) == 10000
        assert len(req.council_response) == 50000


# =============================================================================
# Integration-like Tests (Mocked)
# =============================================================================

class TestKnowledgeValidation:
    """Test validation patterns used across knowledge operations."""

    def test_category_values(self):
        """Test common category values are accepted."""
        categories = [
            "technical_decision",
            "business_decision",
            "architecture",
            "process",
            "policy",
            "framework",
            "sop"
        ]
        for cat in categories:
            req = CreateKnowledgeRequest(
                company_id="company-123",
                title="Test",
                category=cat
            )
            assert req.category == cat

    def test_scope_values(self):
        """Test common scope values are accepted."""
        scopes = ["company", "department", "project", "role"]
        for scope in scopes:
            req = CreateKnowledgeRequest(
                company_id="company-123",
                title="Test",
                scope=scope
            )
            assert req.scope == scope

    def test_status_values(self):
        """Test common status values are accepted."""
        statuses = ["draft", "pending", "approved", "superseded", "archived"]
        for status in statuses:
            req = CreateKnowledgeRequest(
                company_id="company-123",
                title="Test",
                status=status
            )
            assert req.status == status
