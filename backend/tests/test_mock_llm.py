"""
Tests for mock_llm.py - Mock LLM response generation

Tests cover:
- Length category detection based on max_tokens
- Stage 1 content generation with length variants
- Stage 3 content generation with length variants
- Stage detection from messages
- Streaming response generation
"""

import pytest
from unittest.mock import patch


# =============================================================================
# LENGTH CATEGORY TESTS
# =============================================================================

class TestGetLengthCategory:
    """Tests for _get_length_category function."""

    def test_returns_short_for_512_or_less(self):
        """512 tokens or less should return 'short'."""
        from backend.mock_llm import _get_length_category

        assert _get_length_category(512) == "short"
        assert _get_length_category(256) == "short"
        assert _get_length_category(100) == "short"

    def test_returns_medium_for_1024_to_2048(self):
        """1024-2048 tokens should return 'medium'."""
        from backend.mock_llm import _get_length_category

        assert _get_length_category(1024) == "medium"
        assert _get_length_category(1536) == "medium"
        assert _get_length_category(2048) == "medium"

    def test_returns_long_for_4096_or_more(self):
        """4096 tokens or more should return 'long'."""
        from backend.mock_llm import _get_length_category

        assert _get_length_category(4096) == "long"
        assert _get_length_category(8192) == "long"
        assert _get_length_category(16384) == "long"

    def test_returns_medium_for_none(self):
        """None should default to 'medium'."""
        from backend.mock_llm import _get_length_category

        assert _get_length_category(None) == "medium"

    def test_boundary_cases(self):
        """Test boundary values between categories."""
        from backend.mock_llm import _get_length_category

        # 512 is short, 513 starts medium range (but still <=2048)
        assert _get_length_category(512) == "short"
        assert _get_length_category(513) == "medium"

        # 2048 is medium, 2049 starts long range
        assert _get_length_category(2048) == "medium"
        assert _get_length_category(2049) == "long"


# =============================================================================
# STAGE 1 CONTENT TESTS
# =============================================================================

class TestStage1Content:
    """Tests for _stage1_content function with length variants."""

    def test_short_content_is_concise(self):
        """Short responses should be significantly shorter than medium."""
        from backend.mock_llm import _stage1_content

        short = _stage1_content("openai/gpt-4o", "short")
        medium = _stage1_content("openai/gpt-4o", "medium")

        # Short should be at least 50% shorter than medium
        assert len(short) < len(medium) * 0.6

    def test_long_content_is_comprehensive(self):
        """Long responses should be significantly longer than medium."""
        from backend.mock_llm import _stage1_content

        medium = _stage1_content("openai/gpt-4o", "medium")
        long_content = _stage1_content("openai/gpt-4o", "long")

        # Long should be at least 2x longer than medium
        assert len(long_content) > len(medium) * 2

    def test_defaults_to_medium(self):
        """Default length should be medium."""
        from backend.mock_llm import _stage1_content

        default = _stage1_content("openai/gpt-4o")
        medium = _stage1_content("openai/gpt-4o", "medium")

        assert default == medium

    def test_gpt_model_style(self):
        """GPT model should have systematic analysis style."""
        from backend.mock_llm import _stage1_content

        content = _stage1_content("openai/gpt-4o", "medium")

        assert "gpt-4o" in content.lower() or "gpt" in content.lower() or "Analysis" in content

    def test_claude_model_style(self):
        """Claude model should have thoughtful consideration style."""
        from backend.mock_llm import _stage1_content

        content = _stage1_content("anthropic/claude-3", "medium")

        assert "claude" in content.lower() or "considered" in content.lower()

    def test_gemini_model_style(self):
        """Gemini model should have report/table style."""
        from backend.mock_llm import _stage1_content

        content = _stage1_content("google/gemini-pro", "medium")

        # Gemini uses tables
        assert "|" in content

    def test_grok_model_style(self):
        """Grok model should have direct/contrarian style."""
        from backend.mock_llm import _stage1_content

        content = _stage1_content("x-ai/grok-2", "medium")

        assert "grok" in content.lower() or "→" in content or "bold" in content.lower()

    def test_deepseek_model_style(self):
        """DeepSeek model should have systematic decomposition style."""
        from backend.mock_llm import _stage1_content

        content = _stage1_content("deepseek/deepseek-chat", "medium")

        assert "deepseek" in content.lower() or "Component" in content

    def test_unknown_model_gets_generic_style(self):
        """Unknown models should get generic analysis style."""
        from backend.mock_llm import _stage1_content

        content = _stage1_content("unknown/new-model", "medium")

        assert "Analysis" in content


# =============================================================================
# STAGE 3 CONTENT TESTS
# =============================================================================

class TestStage3Content:
    """Tests for _stage3_content function with length variants."""

    def test_short_synthesis_is_concise(self):
        """Short synthesis should be significantly shorter than medium."""
        from backend.mock_llm import _stage3_content

        short = _stage3_content("short")
        medium = _stage3_content("medium")

        assert len(short) < len(medium) * 0.5

    def test_long_synthesis_is_comprehensive(self):
        """Long synthesis should be significantly longer than medium."""
        from backend.mock_llm import _stage3_content

        medium = _stage3_content("medium")
        long_content = _stage3_content("long")

        assert len(long_content) > len(medium) * 2

    def test_defaults_to_medium(self):
        """Default length should be medium."""
        from backend.mock_llm import _stage3_content

        default = _stage3_content()
        medium = _stage3_content("medium")

        assert default == medium

    def test_all_versions_have_key_sections(self):
        """All versions should have essential synthesis elements."""
        from backend.mock_llm import _stage3_content

        for length in ["short", "medium", "long"]:
            content = _stage3_content(length)

            # All should have chairman/synthesis indicator
            assert "Chairman" in content or "Synthesis" in content

            # All should have recommendations or key points
            assert "Recommendation" in content or "Key" in content

            # All should have confidence indicator
            assert "Confidence" in content or "75%" in content

    def test_long_has_table_of_contents(self):
        """Long synthesis should have table of contents."""
        from backend.mock_llm import _stage3_content

        long_content = _stage3_content("long")

        assert "Table of Contents" in long_content

    def test_long_has_implementation_roadmap(self):
        """Long synthesis should have implementation roadmap."""
        from backend.mock_llm import _stage3_content

        long_content = _stage3_content("long")

        assert "Implementation" in long_content or "Roadmap" in long_content


# =============================================================================
# STAGE DETECTION TESTS
# =============================================================================

class TestDetectStage:
    """Tests for _detect_stage function."""

    def test_empty_messages_returns_stage1(self):
        """Empty messages should default to stage1."""
        from backend.mock_llm import _detect_stage

        assert _detect_stage([]) == "stage1"

    def test_title_generation_detected(self):
        """Title generation prompts should be detected."""
        from backend.mock_llm import _detect_stage

        messages = [{"role": "user", "content": "Generate a short title for this conversation"}]
        assert _detect_stage(messages) == "title"

        messages = [{"role": "user", "content": "Create a conversation title"}]
        assert _detect_stage(messages) == "title"

    def test_stage2_detected(self):
        """Stage 2 peer review prompts should be detected."""
        from backend.mock_llm import _detect_stage

        messages = [{"role": "user", "content": "Evaluate each response and provide a final ranking"}]
        assert _detect_stage(messages) == "stage2"

    def test_stage3_detected(self):
        """Stage 3 chairman prompts should be detected."""
        from backend.mock_llm import _detect_stage

        messages = [{"role": "user", "content": "As chairman, synthesize these responses"}]
        assert _detect_stage(messages) == "stage3"

    def test_triage_detected(self):
        """Triage prompts should be detected."""
        from backend.mock_llm import _detect_stage

        messages = [{"role": "user", "content": "Apply 4 constraints and triage this request"}]
        assert _detect_stage(messages) == "triage"

    def test_curator_detected(self):
        """Curator prompts should be detected."""
        from backend.mock_llm import _detect_stage

        messages = [{"role": "user", "content": "As knowledge curator, provide suggestions in JSON"}]
        assert _detect_stage(messages) == "curator"


# =============================================================================
# MOCK RESPONSE GENERATION TESTS
# =============================================================================

class TestGenerateMockResponse:
    """Tests for generate_mock_response function."""

    @pytest.mark.asyncio
    async def test_returns_response_dict(self):
        """Should return properly structured response dict."""
        from backend.mock_llm import generate_mock_response

        result = await generate_mock_response("openai/gpt-4o", [{"role": "user", "content": "Hello"}])

        assert "content" in result
        assert "usage" in result
        assert "model" in result
        assert result["model"] == "openai/gpt-4o"

    @pytest.mark.asyncio
    async def test_respects_max_tokens_for_short(self):
        """max_tokens=512 should produce short responses."""
        from backend.mock_llm import generate_mock_response

        result_short = await generate_mock_response(
            "openai/gpt-4o",
            [{"role": "user", "content": "Hello"}],
            max_tokens=512
        )
        result_long = await generate_mock_response(
            "openai/gpt-4o",
            [{"role": "user", "content": "Hello"}],
            max_tokens=8192
        )

        assert len(result_short["content"]) < len(result_long["content"])

    @pytest.mark.asyncio
    async def test_respects_max_tokens_for_long(self):
        """max_tokens=4096+ should produce long responses."""
        from backend.mock_llm import generate_mock_response

        result_medium = await generate_mock_response(
            "openai/gpt-4o",
            [{"role": "user", "content": "Hello"}],
            max_tokens=2048
        )
        result_long = await generate_mock_response(
            "openai/gpt-4o",
            [{"role": "user", "content": "Hello"}],
            max_tokens=4096
        )

        assert len(result_long["content"]) > len(result_medium["content"])

    @pytest.mark.asyncio
    async def test_usage_reflects_content_size(self):
        """Usage tokens should reflect content length."""
        from backend.mock_llm import generate_mock_response

        result = await generate_mock_response("openai/gpt-4o", [{"role": "user", "content": "Hello"}])

        assert result["usage"]["completion_tokens"] > 0
        assert result["usage"]["total_tokens"] > 0


# =============================================================================
# STREAMING RESPONSE TESTS
# =============================================================================

class TestGenerateMockResponseStream:
    """Tests for generate_mock_response_stream function."""

    @pytest.mark.asyncio
    async def test_yields_chunks(self):
        """Should yield content in chunks."""
        from backend.mock_llm import generate_mock_response_stream

        chunks = []
        async for chunk in generate_mock_response_stream(
            "openai/gpt-4o",
            [{"role": "user", "content": "Hello"}]
        ):
            chunks.append(chunk)

        assert len(chunks) > 0
        full_content = "".join(chunks)
        assert len(full_content) > 0

    @pytest.mark.asyncio
    async def test_respects_max_tokens_for_short(self):
        """Streaming should respect max_tokens for short responses."""
        from backend.mock_llm import generate_mock_response_stream

        short_chunks = []
        async for chunk in generate_mock_response_stream(
            "openai/gpt-4o",
            [{"role": "user", "content": "Hello"}],
            max_tokens=512
        ):
            short_chunks.append(chunk)

        long_chunks = []
        async for chunk in generate_mock_response_stream(
            "openai/gpt-4o",
            [{"role": "user", "content": "Hello"}],
            max_tokens=8192
        ):
            long_chunks.append(chunk)

        short_content = "".join(short_chunks)
        long_content = "".join(long_chunks)

        assert len(short_content) < len(long_content)


# =============================================================================
# STAGE 2 CONTENT TESTS
# =============================================================================

class TestStage2Content:
    """Tests for _stage2_content function."""

    def test_includes_final_ranking(self):
        """Stage 2 should include FINAL RANKING section."""
        from backend.mock_llm import _stage2_content

        # Normal scenario
        with patch('backend.mock_llm.MOCK_LLM_SCENARIO', 'happy_path'):
            content = _stage2_content("openai/gpt-4o")
            assert "FINAL RANKING:" in content

    def test_includes_all_responses(self):
        """Stage 2 should evaluate all responses A-E."""
        from backend.mock_llm import _stage2_content

        with patch('backend.mock_llm.MOCK_LLM_SCENARIO', 'happy_path'):
            content = _stage2_content("openai/gpt-4o")

            assert "Response A" in content
            assert "Response B" in content
            assert "Response C" in content
            assert "Response D" in content
            assert "Response E" in content

    def test_malformed_ranking_scenario(self):
        """Malformed ranking scenario should not have proper FINAL RANKING."""
        from backend.mock_llm import _stage2_content

        with patch('backend.mock_llm.MOCK_LLM_SCENARIO', 'malformed_ranking'):
            content = _stage2_content("openai/gpt-4o")

            # Should not have properly formatted FINAL RANKING
            # The malformed version mentions ranking differently
            assert "FINAL RANKING:" not in content or "1. Response" not in content

    def test_empty_ranking_scenario(self):
        """Empty ranking scenario should have header but no items."""
        from backend.mock_llm import _stage2_content

        with patch('backend.mock_llm.MOCK_LLM_SCENARIO', 'empty_ranking'):
            content = _stage2_content("openai/gpt-4o")

            assert "FINAL RANKING:" in content
            # But no numbered items after
            assert "1. Response" not in content


# =============================================================================
# FAILURE SCENARIO TESTS
# =============================================================================

class TestFailureScenarios:
    """Tests for mock failure scenarios."""

    @pytest.mark.asyncio
    async def test_one_model_fails_scenario(self):
        """one_model_fails scenario should fail GPT models."""
        from backend.mock_llm import generate_mock_response

        with patch('backend.mock_llm.MOCK_LLM_SCENARIO', 'one_model_fails'):
            # GPT models should fail
            result = await generate_mock_response(
                "openai/gpt-4o",
                [{"role": "user", "content": "Hello"}]
            )
            assert result is None

            # Non-GPT models have a chance of success
            # (20% random failure, so most should succeed)
            successes = 0
            for _ in range(20):  # More iterations for statistical stability
                result = await generate_mock_response(
                    "anthropic/claude-3",
                    [{"role": "user", "content": "Hello"}]
                )
                if result is not None:
                    successes += 1

            # Should have at least some successes (expect ~16 out of 20)
            # Using >= 10 to account for bad luck (50% threshold)
            assert successes >= 10


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestIntegration:
    """Integration tests for mock system with openrouter."""

    @pytest.mark.asyncio
    async def test_mock_mode_uses_max_tokens(self):
        """When MOCK_LLM is enabled, max_tokens should affect response length."""
        from backend.mock_llm import generate_mock_response

        # Test that different max_tokens produce different lengths
        short_result = await generate_mock_response(
            "openai/gpt-4o",
            [{"role": "user", "content": "Test question"}],
            max_tokens=512
        )

        long_result = await generate_mock_response(
            "openai/gpt-4o",
            [{"role": "user", "content": "Test question"}],
            max_tokens=8192
        )

        # Verify length difference
        assert len(short_result["content"]) < len(long_result["content"])

        # Verify short is actually short (less than ~500 words = ~2500 chars)
        assert len(short_result["content"]) < 2500

        # Verify long is actually long (more than ~1000 words = ~5000 chars)
        assert len(long_result["content"]) > 5000
