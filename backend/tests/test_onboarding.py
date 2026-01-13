"""
Tests for the onboarding router and trial service.

Covers:
- LinkedIn URL validation
- Department generation
- Mock profile data
- Trial service operations
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# =============================================================================
# LINKEDIN URL VALIDATION TESTS
# =============================================================================

class TestValidateLinkedInUrl:
    """Tests for validate_linkedin_url function."""

    def test_valid_url_basic(self):
        """Test basic valid LinkedIn URL."""
        from backend.routers.onboarding import validate_linkedin_url

        is_valid, username = validate_linkedin_url("https://linkedin.com/in/johndoe")
        assert is_valid is True
        assert username == "johndoe"

    def test_valid_url_with_www(self):
        """Test valid URL with www prefix."""
        from backend.routers.onboarding import validate_linkedin_url

        is_valid, username = validate_linkedin_url("https://www.linkedin.com/in/janedoe")
        assert is_valid is True
        assert username == "janedoe"

    def test_valid_url_with_trailing_slash(self):
        """Test valid URL with trailing slash."""
        from backend.routers.onboarding import validate_linkedin_url

        is_valid, username = validate_linkedin_url("https://linkedin.com/in/user123/")
        assert is_valid is True
        assert username == "user123"

    def test_valid_url_with_query_params(self):
        """Test valid URL with query parameters."""
        from backend.routers.onboarding import validate_linkedin_url

        is_valid, username = validate_linkedin_url("https://linkedin.com/in/testuser?utm_source=google")
        assert is_valid is True
        assert username == "testuser"

    def test_valid_url_http(self):
        """Test valid URL with http (not https)."""
        from backend.routers.onboarding import validate_linkedin_url

        is_valid, username = validate_linkedin_url("http://linkedin.com/in/httpuser")
        assert is_valid is True
        assert username == "httpuser"

    def test_valid_url_with_dashes_underscores(self):
        """Test valid URL with dashes and underscores in username."""
        from backend.routers.onboarding import validate_linkedin_url

        is_valid, username = validate_linkedin_url("https://linkedin.com/in/john-doe_123")
        assert is_valid is True
        assert username == "john-doe_123"

    def test_invalid_url_empty(self):
        """Test empty URL."""
        from backend.routers.onboarding import validate_linkedin_url

        is_valid, error = validate_linkedin_url("")
        assert is_valid is False
        assert "required" in error.lower()

    def test_invalid_url_wrong_domain(self):
        """Test URL with wrong domain."""
        from backend.routers.onboarding import validate_linkedin_url

        is_valid, error = validate_linkedin_url("https://facebook.com/in/johndoe")
        assert is_valid is False
        assert "invalid" in error.lower()

    def test_invalid_url_missing_in(self):
        """Test URL missing /in/ path."""
        from backend.routers.onboarding import validate_linkedin_url

        is_valid, error = validate_linkedin_url("https://linkedin.com/johndoe")
        assert is_valid is False
        assert "invalid" in error.lower()

    def test_invalid_url_short_username(self):
        """Test URL with too short username."""
        from backend.routers.onboarding import validate_linkedin_url

        is_valid, error = validate_linkedin_url("https://linkedin.com/in/x")
        assert is_valid is False
        assert "invalid" in error.lower()


class TestExtractUsernameFromLinkedInUrl:
    """Tests for extract_username_from_linkedin_url function."""

    def test_extract_basic(self):
        """Test basic extraction."""
        from backend.routers.onboarding import extract_username_from_linkedin_url

        username = extract_username_from_linkedin_url("https://linkedin.com/in/johndoe")
        assert username == "johndoe"

    def test_extract_with_trailing_slash(self):
        """Test extraction with trailing slash."""
        from backend.routers.onboarding import extract_username_from_linkedin_url

        username = extract_username_from_linkedin_url("https://linkedin.com/in/johndoe/")
        assert username == "johndoe"

    def test_extract_with_query_params(self):
        """Test extraction with query params."""
        from backend.routers.onboarding import extract_username_from_linkedin_url

        username = extract_username_from_linkedin_url("https://linkedin.com/in/johndoe?foo=bar")
        assert username == "johndoe"

    def test_extract_invalid_url(self):
        """Test extraction from invalid URL."""
        from backend.routers.onboarding import extract_username_from_linkedin_url

        username = extract_username_from_linkedin_url("https://google.com")
        assert username is None


# =============================================================================
# DEPARTMENT GENERATION TESTS
# =============================================================================

class TestGenerateDepartments:
    """Tests for generate_departments function."""

    def test_founder_role(self):
        """Test department generation for founder role."""
        from backend.routers.onboarding import generate_departments

        departments = generate_departments("Founder & CEO", "Technology", 25)
        assert len(departments) == 3
        assert departments[0]["id"] == "dept-1"
        assert "Executive Strategy" in departments[0]["name"]

    def test_cto_role(self):
        """Test department generation for CTO role."""
        from backend.routers.onboarding import generate_departments

        departments = generate_departments("CTO", "SaaS", 100)
        assert len(departments) == 3
        assert any("Engineering" in d["name"] for d in departments)

    def test_marketing_role(self):
        """Test department generation for marketing role."""
        from backend.routers.onboarding import generate_departments

        # Use "CMO" to avoid matching "director" which maps to founder roles
        departments = generate_departments("CMO", "E-commerce", 50)
        assert len(departments) == 3
        # Marketing role maps to Brand Strategy, Performance Marketing, Content Operations
        assert any("Brand" in d["name"] or "Performance" in d["name"] or "Content" in d["name"] for d in departments)

    def test_unknown_role_uses_default(self):
        """Test that unknown role uses default departments."""
        from backend.routers.onboarding import generate_departments

        departments = generate_departments("Chief Happiness Officer", "Wellness", 10)
        assert len(departments) == 3
        # Default departments include Strategic Advisory
        assert any("Strategic" in d["name"] or "Advisory" in d["name"] for d in departments)

    def test_enterprise_size_modifier(self):
        """Test that enterprise companies get size modifier."""
        from backend.routers.onboarding import generate_departments

        departments = generate_departments("CEO", "Technology", 5000)
        # Enterprise companies should have size modifier on Strategy departments
        strategy_dept = next((d for d in departments if "Strategy" in d["name"]), None)
        assert strategy_dept is not None
        assert "Enterprise" in strategy_dept["name"]

    def test_mid_market_size_modifier(self):
        """Test that mid-market companies get size modifier."""
        from backend.routers.onboarding import generate_departments

        departments = generate_departments("CEO", "Technology", 500)
        strategy_dept = next((d for d in departments if "Strategy" in d["name"]), None)
        assert strategy_dept is not None
        assert "Mid-Market" in strategy_dept["name"]

    def test_startup_no_size_modifier(self):
        """Test that startups don't get size modifier."""
        from backend.routers.onboarding import generate_departments

        departments = generate_departments("Founder", "Technology", 5)
        # Startup shouldn't have Mid-Market or Enterprise prefix
        for dept in departments:
            assert "Mid-Market" not in dept["name"]
            assert "Enterprise" not in dept["name"]

    def test_departments_have_required_fields(self):
        """Test that all departments have required fields."""
        from backend.routers.onboarding import generate_departments

        departments = generate_departments("Product Manager", "SaaS", 100)
        for dept in departments:
            assert "id" in dept
            assert "name" in dept
            assert "icon" in dept
            assert "purpose" in dept


class TestGetSizeModifier:
    """Tests for get_size_modifier function."""

    def test_startup(self):
        """Test startup size bracket."""
        from backend.routers.onboarding import get_size_modifier

        assert get_size_modifier(5) == "Startup"
        assert get_size_modifier(10) == "Startup"

    def test_growth(self):
        """Test growth size bracket."""
        from backend.routers.onboarding import get_size_modifier

        assert get_size_modifier(15) == "Growth"
        assert get_size_modifier(50) == "Growth"

    def test_scaleup(self):
        """Test scale-up size bracket."""
        from backend.routers.onboarding import get_size_modifier

        assert get_size_modifier(100) == "Scale-up"
        assert get_size_modifier(200) == "Scale-up"

    def test_mid_market(self):
        """Test mid-market size bracket."""
        from backend.routers.onboarding import get_size_modifier

        assert get_size_modifier(500) == "Mid-Market"
        assert get_size_modifier(1000) == "Mid-Market"

    def test_enterprise(self):
        """Test enterprise size bracket."""
        from backend.routers.onboarding import get_size_modifier

        assert get_size_modifier(2000) == "Enterprise"
        assert get_size_modifier(10000) == "Enterprise"


# =============================================================================
# MOCK PROFILE DATA TESTS
# =============================================================================

class TestGetMockProfileData:
    """Tests for get_mock_profile_data function."""

    def test_david_profile(self):
        """Test mock profile for david username."""
        from backend.routers.onboarding import get_mock_profile_data

        profile = get_mock_profile_data("david-chen")
        assert profile["full_name"] == "David Chen"
        assert profile["role"] == "CTO"
        assert profile["company"] == "CloudFlow"

    def test_tech_profile(self):
        """Test mock profile for tech username."""
        from backend.routers.onboarding import get_mock_profile_data

        profile = get_mock_profile_data("tech-lead-123")
        assert profile["full_name"] == "David Chen"
        assert profile["role"] == "CTO"

    def test_sarah_profile(self):
        """Test mock profile for sarah username."""
        from backend.routers.onboarding import get_mock_profile_data

        profile = get_mock_profile_data("sarah-jenkins")
        assert profile["full_name"] == "Sarah Jenkins"
        assert profile["role"] == "Founder & CEO"
        assert profile["company"] == "Elevate Digital"

    def test_market_profile(self):
        """Test mock profile for market username."""
        from backend.routers.onboarding import get_mock_profile_data

        profile = get_mock_profile_data("market-expert")
        assert profile["full_name"] == "Sarah Jenkins"

    def test_generic_profile(self):
        """Test generic mock profile."""
        from backend.routers.onboarding import get_mock_profile_data

        profile = get_mock_profile_data("random-user")
        assert profile["role"] == "Founder"
        assert "Ventures" in profile["company"]
        assert profile["employees"] == 25

    def test_profile_has_required_fields(self):
        """Test that mock profile has all required fields."""
        from backend.routers.onboarding import get_mock_profile_data

        profile = get_mock_profile_data("test-user")
        assert "full_name" in profile
        assert "role" in profile
        assert "company" in profile
        assert "industry" in profile
        assert "employees" in profile
        assert "bio" in profile


# =============================================================================
# TRIAL SERVICE TESTS
# =============================================================================

class TestTrialServiceCheckTrialAvailable:
    """Tests for TrialService.check_trial_available method."""

    @pytest.mark.asyncio
    async def test_trial_available_when_no_record(self):
        """Test that trial is available when no record exists."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            service = TrialService()
            result = await service.check_trial_available("user-123")
            assert result is True

    @pytest.mark.asyncio
    async def test_trial_not_available_when_record_exists(self):
        """Test that trial is not available when record exists."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "trial-1"}])

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            service = TrialService()
            result = await service.check_trial_available("user-123")
            assert result is False

    @pytest.mark.asyncio
    async def test_trial_available_on_error(self):
        """Test that trial fails open on error."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.side_effect = Exception("DB error")

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            with patch("backend.services.trial.log_app_event"):
                service = TrialService()
                result = await service.check_trial_available("user-123")
                assert result is True  # Fail open


class TestTrialServiceCheckHasApiKey:
    """Tests for TrialService.check_has_api_key method."""

    @pytest.mark.asyncio
    async def test_has_api_key_true(self):
        """Test returns true when user has API key."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "key-1"}])

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            service = TrialService()
            result = await service.check_has_api_key("user-123")
            assert result is True

    @pytest.mark.asyncio
    async def test_has_api_key_false(self):
        """Test returns false when user has no API key."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            service = TrialService()
            result = await service.check_has_api_key("user-123")
            assert result is False

    @pytest.mark.asyncio
    async def test_has_api_key_false_on_error(self):
        """Test returns false on error (fail closed)."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.side_effect = Exception("DB error")

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            with patch("backend.services.trial.log_app_event"):
                service = TrialService()
                result = await service.check_has_api_key("user-123")
                assert result is False


class TestTrialServiceGetTrialInfo:
    """Tests for TrialService.get_trial_info method."""

    @pytest.mark.asyncio
    async def test_get_trial_info_exists(self):
        """Test getting trial info when record exists."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"id": "trial-1", "used_at": "2024-01-01T00:00:00Z", "ip_address": "1.2.3.4"}]
        )

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            service = TrialService()
            result = await service.get_trial_info("user-123")
            assert result is not None
            assert result["id"] == "trial-1"
            assert result["used_at"] == "2024-01-01T00:00:00Z"

    @pytest.mark.asyncio
    async def test_get_trial_info_not_exists(self):
        """Test getting trial info when no record exists."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            service = TrialService()
            result = await service.get_trial_info("user-123")
            assert result is None


class TestTrialServiceUseTrial:
    """Tests for TrialService.use_trial method."""

    @pytest.mark.asyncio
    async def test_use_trial_success(self):
        """Test successfully marking trial as used."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        # First call - check existing (none)
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        # Second call - insert
        mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": "new-trial"}])

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            with patch("backend.services.trial.log_app_event"):
                service = TrialService()
                result = await service.use_trial("user-123", "1.2.3.4")
                assert result is True

    @pytest.mark.asyncio
    async def test_use_trial_idempotent(self):
        """Test that using trial is idempotent."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        # Existing record found
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "existing"}])

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            service = TrialService()
            result = await service.use_trial("user-123")
            assert result is True
            # Insert should NOT be called
            mock_client.table.return_value.insert.assert_not_called()


class TestTrialServiceCanRunCouncil:
    """Tests for TrialService.can_run_council method."""

    @pytest.mark.asyncio
    async def test_can_run_with_trial(self):
        """Test can run council with trial available."""
        from backend.services.trial import TrialService

        service = TrialService()
        service.check_trial_available = AsyncMock(return_value=True)

        can_run, reason = await service.can_run_council("user-123")
        assert can_run is True
        assert reason == "trial"

    @pytest.mark.asyncio
    async def test_can_run_with_api_key(self):
        """Test can run council with API key."""
        from backend.services.trial import TrialService

        service = TrialService()
        service.check_trial_available = AsyncMock(return_value=False)
        service.check_has_api_key = AsyncMock(return_value=True)

        can_run, reason = await service.can_run_council("user-123")
        assert can_run is True
        assert reason == "api_key"

    @pytest.mark.asyncio
    async def test_cannot_run_no_credits(self):
        """Test cannot run council without trial or API key."""
        from backend.services.trial import TrialService

        service = TrialService()
        service.check_trial_available = AsyncMock(return_value=False)
        service.check_has_api_key = AsyncMock(return_value=False)

        can_run, reason = await service.can_run_council("user-123")
        assert can_run is False
        assert reason == "no_credits"


class TestTrialServiceResetTrial:
    """Tests for TrialService.reset_trial method."""

    @pytest.mark.asyncio
    async def test_reset_trial_success(self):
        """Test successfully resetting trial."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        mock_client.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "deleted"}])

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            with patch("backend.services.trial.log_app_event"):
                service = TrialService()
                result = await service.reset_trial("user-123")
                assert result is True

    @pytest.mark.asyncio
    async def test_reset_trial_no_record(self):
        """Test resetting trial when no record exists."""
        from backend.services.trial import TrialService

        mock_client = MagicMock()
        mock_client.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        with patch("backend.services.trial.get_supabase_service", return_value=mock_client):
            service = TrialService()
            result = await service.reset_trial("user-123")
            # Returns False when no record was deleted (empty data array)
            assert result is False


# =============================================================================
# PYDANTIC MODEL TESTS
# =============================================================================

class TestPydanticModels:
    """Tests for Pydantic models."""

    def test_onboarding_department_model(self):
        """Test OnboardingDepartment model."""
        from backend.routers.onboarding import OnboardingDepartment

        dept = OnboardingDepartment(
            id="dept-1",
            name="Engineering",
            icon="code",
            purpose="Build stuff"
        )
        assert dept.id == "dept-1"
        assert dept.name == "Engineering"

    def test_onboarding_profile_model(self):
        """Test OnboardingProfile model."""
        from backend.routers.onboarding import OnboardingProfile, OnboardingDepartment

        profile = OnboardingProfile(
            full_name="John Doe",
            role="CTO",
            company="Acme Corp",
            industry="Technology",
            employees=100,
            bio="A bio",
            magic_question="What is the meaning?",
            departments=[
                OnboardingDepartment(id="d1", name="Eng", icon="code", purpose="Build")
            ]
        )
        assert profile.full_name == "John Doe"
        assert len(profile.departments) == 1

    def test_analyze_profile_response_success(self):
        """Test AnalyzeProfileResponse for success case."""
        from backend.routers.onboarding import AnalyzeProfileResponse, OnboardingProfile

        profile = OnboardingProfile(
            full_name="Jane",
            role="CEO",
            company="Startup",
            industry="Tech",
            employees=10,
            bio="Bio",
            magic_question="Question?",
            departments=[]
        )
        response = AnalyzeProfileResponse(
            success=True,
            profile=profile,
            fallback_required=False
        )
        assert response.success is True
        assert response.profile is not None

    def test_analyze_profile_response_error(self):
        """Test AnalyzeProfileResponse for error case."""
        from backend.routers.onboarding import AnalyzeProfileResponse

        response = AnalyzeProfileResponse(
            success=False,
            error="Invalid URL",
            fallback_required=False
        )
        assert response.success is False
        assert response.error == "Invalid URL"

    def test_trial_status_response(self):
        """Test TrialStatusResponse model."""
        from backend.routers.onboarding import TrialStatusResponse

        response = TrialStatusResponse(
            has_trial_available=True,
            has_api_key=False,
            can_run_council=True,
            trial_used_at=None
        )
        assert response.has_trial_available is True
        assert response.can_run_council is True
