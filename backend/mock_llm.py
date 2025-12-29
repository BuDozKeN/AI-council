"""
Mock LLM responses for testing the 3-stage Council workflow.
Bypasses OpenRouter API calls when MOCK_LLM=true
"""

import asyncio
import random
from typing import List, Dict, Optional, AsyncGenerator
from .config import MOCK_LLM_SCENARIO

# Simulate realistic network latency (seconds)
MOCK_DELAY_MIN = 0.3
MOCK_DELAY_MAX = 0.8


def _detect_stage(messages: List[Dict]) -> str:
    """
    Detect which stage this call is for by examining the last message.
    Works with your existing prompt structure in council.py.
    """
    if not messages:
        print("[MOCK DETECT] No messages, defaulting to stage1")
        return "stage1"

    last_content = (messages[-1].get("content") or "").lower()
    print(f"[MOCK DETECT] Last message content (first 100 chars): {last_content[:100]}")

    # Title generation - check FIRST since it's a short prompt
    # Must check before stage1 (default) since title prompts don't have other markers
    if "short title" in last_content or "conversation title" in last_content or "generate a title" in last_content:
        print(f"[MOCK DETECT] -> TITLE")
        return "title"

    # Curator: Knowledge curation requests
    if "knowledge curator" in last_content or ("suggestions" in last_content and "json" in last_content):
        return "curator"

    # Stage 2: Peer review requests mention ranking
    if "final ranking" in last_content or ("evaluate" in last_content and "response" in last_content):
        return "stage2"

    # Stage 3: Chairman synthesis
    if "synthesize" in last_content or "chairman" in last_content:
        return "stage3"

    # Triage
    if "triage" in last_content or "4 constraints" in last_content:
        return "triage"

    return "stage1"


def _stage1_content(model: str) -> str:
    """Generate realistic Stage 1 response with markdown."""
    short_model = model.split("/")[-1] if "/" in model else model

    # Different response styles for different models
    if "gpt" in model.lower():
        return f"""## Systematic Analysis from {short_model}

Based on a thorough examination of your query, here are my key findings:

**Core Considerations:**
1. The primary factors suggest a methodical approach would be most effective
2. Risk assessment indicates moderate complexity with manageable downside
3. Historical precedents support a phased implementation strategy

**Technical Details:**
```python
def recommended_approach():
    phase_1 = "Initial validation"
    phase_2 = "Scaled rollout"
    return optimize(phase_1, phase_2)
```

**Recommendation:**
I suggest proceeding with structured milestones, allowing for iterative refinement based on early feedback. This balances speed with prudent risk management."""

    elif "claude" in model.lower():
        return f"""I've carefully considered this question from {short_model}.

**Key Observations:**

The situation presents several interconnected factors worth examining:

1. **Context Matters**: The specific circumstances will heavily influence the optimal path forward. What works in theory may need adaptation in practice.

2. **Trade-offs to Consider**: There's an inherent tension between speed and thoroughness. Moving quickly risks missing important nuances; moving slowly risks missing windows of opportunity.

3. **Stakeholder Perspectives**: Different parties will have different priorities and concerns that need to be balanced.

**My Assessment:**

Given these considerations, I'd recommend an approach that:
- Starts with clear problem definition
- Identifies key assumptions that need validation
- Builds in checkpoints for course correction

This isn't about finding the "perfect" answer—it's about making good decisions with available information while remaining adaptable."""

    elif "gemini" in model.lower():
        return f"""# Analysis Report from {short_model}

## Executive Summary
After analyzing the query parameters, I've identified several actionable insights.

## Key Findings

| Factor | Assessment | Confidence |
|--------|------------|------------|
| Feasibility | High | 85% |
| Resource Requirements | Moderate | 78% |
| Timeline Risk | Low-Medium | 72% |

## Detailed Analysis

The query touches on fundamental questions of optimization under constraints. My analysis suggests:

1. **Primary Path**: Direct implementation with standard safeguards
2. **Alternative Path**: Staged approach with intermediate validation
3. **Contingency**: Fallback to proven methods if metrics underperform

## Recommendation
Proceed with Primary Path while maintaining Alternative Path readiness. Monitor key performance indicators at 30-day intervals.

```
Confidence Score: 0.82
Methodology: Multi-factor weighted analysis
```"""

    elif "grok" in model.lower():
        return f"""Alright, let's cut through the noise here. {short_model} speaking.

**The Real Question:**
You're essentially asking whether to bet on the new approach or stick with what's proven. Both have merit, but let's be honest about the trade-offs.

**My Honest Take:**

→ Conventional wisdom says play it safe
→ But conventional wisdom also produces conventional results
→ The key variable is your actual risk tolerance (not what you say it is)

**The Contrarian View:**
Most people in your position would overthink this. Analysis paralysis is a real thing. Sometimes the best decision is the one you actually make and commit to.

**Bottom Line:**
Fortune favors the bold, but only the *prepared* bold. Know your downside, accept it, then move with conviction.

— Mock response from {short_model}"""

    elif "deepseek" in model.lower():
        return f"""## Comprehensive Analysis from {short_model}

### Problem Decomposition

Let me break this down systematically:

**Component 1: Strategic Assessment**
The fundamental question requires examining multiple interdependent variables. Key dependencies include:
- Resource availability and allocation efficiency
- Timeline constraints and flexibility margins
- Stakeholder alignment and decision authority

**Component 2: Technical Considerations**
From an implementation standpoint:
```
Input → Process → Validate → Iterate → Output
           ↑                      ↓
           └──── Feedback Loop ───┘
```

**Component 3: Risk Analysis**
Primary risks identified:
1. Execution complexity (Medium)
2. Coordination overhead (Low-Medium)
3. External dependencies (Variable)

### Synthesis

Balancing these factors, my recommendation emphasizes:
- Clear phase gates with defined success criteria
- Parallel workstreams where dependencies allow
- Regular sync points for cross-functional alignment

This structured approach maximizes probability of successful outcomes while maintaining flexibility for adaptation."""

    else:
        return f"""## Analysis from {short_model}

Based on my analysis, here are the key considerations:

**Strategic Factors:**
1. Market timing appears favorable given current conditions
2. Resource allocation should prioritize core competencies
3. Risk mitigation through phased implementation is advisable

**Recommendation:**
I recommend proceeding with a measured approach, starting with a pilot program to validate assumptions before full commitment.

```python
def example_code():
    return "This tests markdown rendering"
```

This balanced approach minimizes downside risk while preserving upside potential."""


def _stage2_content(model: str) -> str:
    """Generate Stage 2 peer review with rankings."""
    short_model = model.split("/")[-1] if "/" in model else model

    # Shuffle ranking order so each "model" ranks differently
    labels = ["Response A", "Response B", "Response C", "Response D", "Response E"]
    shuffled = labels.copy()
    random.shuffle(shuffled)

    if MOCK_LLM_SCENARIO == "malformed_ranking":
        # Missing FINAL RANKING header - tests parser resilience
        return """My evaluation of the responses:

Response A is technically sound but lacks practical detail. Response B provides strategic depth with actionable recommendations. Response C offers good code examples but limited context.

I'd rank them: B > A > C > D > E roughly speaking."""

    if MOCK_LLM_SCENARIO == "empty_ranking":
        # Header present but no items - tests empty handling
        return """## Evaluation

All responses provided valuable perspectives on the query. Each brought unique strengths to the analysis.

FINAL RANKING:
"""

    # Happy path - well-formed ranking
    return f"""## Peer Evaluation from {short_model}

### Individual Assessments

**{labels[0]}**: Provides well-structured analysis with clear strategic considerations. Strong on methodology, could use more concrete examples. **Score: 8/10**

**{labels[1]}**: Excellent systematic breakdown with comprehensive pros/cons analysis. Technical depth is impressive. **Score: 8.5/10**

**{labels[2]}**: Good multi-perspective approach with thoughtful trade-off analysis. Writing is clear and actionable. **Score: 7.5/10**

**{labels[3]}**: Refreshingly direct and action-oriented. Cuts through complexity effectively but may oversimplify nuances. **Score: 7/10**

**{labels[4]}**: Strong quantitative framework with good risk assessment. Well-organized structure. **Score: 8/10**

### Overall Assessment
All responses demonstrate competent analysis. The top responses distinguished themselves through practical applicability and depth of insight.

FINAL RANKING:
1. {shuffled[0]}
2. {shuffled[1]}
3. {shuffled[2]}
4. {shuffled[3]}
5. {shuffled[4]}"""


def _curator_content() -> str:
    """Generate mock curator JSON response."""
    return '''{
  "suggestions": [
    {
      "section": "Strategic Priorities",
      "type": "add",
      "department": "marketing",
      "current_text": null,
      "proposed_text": "Mock Mode Testing\\n\\nThis is a mock suggestion generated during testing.\\n\\n\\u2022 Point 1: Testing the curator flow\\n\\u2022 Point 2: Verifying JSON parsing\\n\\u2022 Point 3: Checking UI rendering",
      "reason": "This is a mock suggestion to test the curator workflow",
      "after_section": "Department Overview"
    }
  ],
  "summary": "Mock mode: 1 test suggestion generated for curator testing."
}'''


def _title_content() -> str:
    """Generate mock conversation title."""
    titles = [
        "Strategic Planning Discussion",
        "Technical Architecture Review",
        "Marketing Campaign Analysis",
        "Product Roadmap Planning",
        "Business Model Evaluation"
    ]
    return random.choice(titles)


def _triage_content() -> str:
    """Generate mock triage response."""
    return '''{
  "depth": "standard",
  "department": "standard",
  "rationale": "Mock triage: Standard depth appropriate for this query type.",
  "key_considerations": ["Testing mock mode", "Verifying triage flow"]
}'''


def _stage3_content() -> str:
    """Generate Chairman synthesis."""
    return """# Chairman's Synthesis

The council recommends a phased approach with clear success metrics, starting small and iterating based on data. All members agree on the importance of defined guardrails and measurable checkpoints.

## Table of Contents

- [Key Insights](#key-insights)
- [Points of Debate](#points-of-debate)
- [Recommendations](#recommendations)
- [Considerations](#considerations)
- [Conclusion](#conclusion)

## Key Insights

The council reached strong agreement on several points:

1. **Proceed with appropriate guardrails** - All council members support moving forward with defined limits and checkpoints
2. **Start small, iterate fast** - Multiple responses emphasized phased approaches over big-bang implementations
3. **Define success metrics upfront** - Clear agreement that measurable criteria are essential before proceeding
4. **Maintain adaptability** - The council values approaches that preserve optionality

## Points of Debate

There were some differences in emphasis:
- **Risk tolerance**: Views ranged from conservative (phased rollout) to aggressive (move fast, learn fast)
- **Technical depth**: Some responses prioritized high-level strategy while others focused on implementation details

## Recommendations

Based on the collective wisdom of the council:

1. **Define clear success criteria** before beginning (quantitative where possible)
2. **Start with a limited pilot** to validate core assumptions
3. **Build measurement infrastructure early** to enable data-driven decisions
4. **Establish 30/60/90 day checkpoints** with explicit go/no-go criteria
5. **Maintain optionality** for course correction based on early signals

## Considerations

| Risk Factor | Likelihood | Impact | Mitigation |
|-------------|------------|--------|------------|
| Execution complexity | Medium | High | Phased approach, regular reviews |
| Resource constraints | Low | Medium | Clear prioritization, staged commitment |
| External dependencies | Variable | Medium | Contingency planning, parallel paths |

**Confidence Level: Moderate-High (75%)** reflecting strong council consensus, well-understood domain, with some uncertainty in external factors.

## Conclusion

Align stakeholders on success criteria, resource the pilot phase, establish governance cadence, and begin execution with a checkpoint at Day 30. This synthesis represents the integrated wisdom of the AI Council."""


def _estimate_mock_usage(content: str, messages: List[Dict]) -> Dict:
    """
    Estimate realistic token usage for mock responses.
    Uses approximate token counts based on character length.
    """
    # Rough estimation: ~4 chars per token for English text
    prompt_text = " ".join(m.get("content", "") for m in messages)
    prompt_tokens = len(prompt_text) // 4
    completion_tokens = len(content) // 4

    return {
        'prompt_tokens': prompt_tokens,
        'completion_tokens': completion_tokens,
        'total_tokens': prompt_tokens + completion_tokens,
        'cache_creation_input_tokens': 0,
        'cache_read_input_tokens': 0,
    }


async def generate_mock_response(model: str, messages: List[Dict]) -> Optional[Dict]:
    """
    Main entry point for non-streaming mock responses.

    Returns:
        dict with 'content', 'reasoning_details', and 'usage' keys, or None for simulated failure
    """
    # Simulate network latency
    await asyncio.sleep(random.uniform(MOCK_DELAY_MIN, MOCK_DELAY_MAX))

    # Simulate model failure in failure scenario
    if MOCK_LLM_SCENARIO == "one_model_fails":
        # Fail models with "gpt" in name, or 20% random failure
        if "gpt" in model.lower() or random.random() < 0.2:
            print(f"[MOCK FAIL] Simulating failure for {model}")
            return None

    stage = _detect_stage(messages)
    print(f"[MOCK] {model} -> {stage}")

    if stage == "stage1":
        content = _stage1_content(model)
    elif stage == "stage2":
        content = _stage2_content(model)
    elif stage == "stage3":
        content = _stage3_content()
    elif stage == "curator":
        content = _curator_content()
    elif stage == "title":
        content = _title_content()
    elif stage == "triage":
        content = _triage_content()
    else:
        content = _stage1_content(model)

    return {
        "content": content,
        "reasoning_details": None,
        "usage": _estimate_mock_usage(content, messages),
        "model": model,
    }


async def generate_mock_response_stream(model: str, messages: List[Dict]) -> AsyncGenerator[str, None]:
    """
    Main entry point for streaming mock responses.
    Yields content token-by-token to simulate streaming.
    """
    # Simulate initial connection latency
    await asyncio.sleep(random.uniform(0.1, 0.3))

    # Simulate model failure in failure scenario
    if MOCK_LLM_SCENARIO == "one_model_fails":
        if "gpt" in model.lower() or random.random() < 0.2:
            print(f"[MOCK STREAM FAIL] Simulating failure for {model}")
            yield "[Error: Model overloaded (mock failure)]"
            return

    stage = _detect_stage(messages)
    print(f"[MOCK STREAM] {model} -> {stage}")

    if stage == "stage1":
        content = _stage1_content(model)
    elif stage == "stage2":
        content = _stage2_content(model)
    elif stage == "stage3":
        content = _stage3_content()
    elif stage == "curator":
        content = _curator_content()
    elif stage == "title":
        content = _title_content()
    elif stage == "triage":
        content = _triage_content()
    else:
        content = _stage1_content(model)

    # Stream content in chunks (simulating token-by-token delivery)
    # Use larger chunks for faster testing, smaller for more realistic streaming
    chunk_size = 15  # characters per chunk
    delay_per_chunk = 0.02  # seconds between chunks

    for i in range(0, len(content), chunk_size):
        chunk = content[i:i + chunk_size]
        yield chunk
        await asyncio.sleep(delay_per_chunk)
