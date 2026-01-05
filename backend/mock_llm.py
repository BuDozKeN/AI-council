"""
Mock LLM responses for testing the 3-stage Council workflow.
Bypasses OpenRouter API calls when MOCK_LLM=true

Length-Aware Responses:
The mock system respects the max_tokens parameter from LLM Hub configuration.
This allows developers to test how different length settings affect the UI
without burning real API tokens.

Length Override:
Developers can set MOCK_LLM_LENGTH_OVERRIDE in config (or via API) to test
specific response lengths WITHOUT changing their LLM Hub production settings.
When override is None, the mock uses actual request params. When set, it
overrides the max_tokens for all mock responses.

Length categories (matching LLM Hub presets):
- SHORT: ≤512 tokens (~100 words) - "1 paragraph"
- MEDIUM: 1024-2048 tokens (~375 words) - "half page" to "1-2 pages"
- LONG: ≥4096 tokens (~1250 words) - "2-3 pages" or "4+ pages"
"""

import asyncio
import os
import random
from typing import List, Dict, Optional, AsyncGenerator
from .config import MOCK_LLM_SCENARIO, MOCK_LLM_LENGTH_OVERRIDE

# Enable verbose debug output only when DEBUG=true
_DEBUG = os.getenv("DEBUG", "").lower() == "true"


def _debug(msg: str) -> None:
    """Print debug message if DEBUG mode is enabled."""
    if _DEBUG:
        print(msg)

# Simulate realistic network latency (seconds)
MOCK_DELAY_MIN = 0.3
MOCK_DELAY_MAX = 0.8


# =============================================================================
# LENGTH-AWARE TEMPLATE SELECTION
# =============================================================================

def _get_effective_max_tokens(max_tokens: Optional[int]) -> Optional[int]:
    """
    Get the effective max_tokens, considering the override.

    If MOCK_LLM_LENGTH_OVERRIDE is set in config, it takes precedence.
    Otherwise, use the max_tokens from the actual request.
    """
    # Import here to get the current runtime value (can be changed via API)
    from . import config
    if config.MOCK_LLM_LENGTH_OVERRIDE is not None:
        return config.MOCK_LLM_LENGTH_OVERRIDE
    return max_tokens


def _get_length_category(max_tokens: Optional[int]) -> str:
    """
    Map max_tokens to a length category for template selection.

    LLM Hub presets:
    - 512: "1 paragraph" → SHORT
    - 1024: "half page" → MEDIUM
    - 1536: "1 page" → MEDIUM
    - 2048: "1-2 pages" → MEDIUM
    - 4096: "2-3 pages" → LONG
    - 8192: "4+ pages" → LONG

    Returns: "short", "medium", or "long"
    """
    # Apply override if set
    effective_tokens = _get_effective_max_tokens(max_tokens)

    if effective_tokens is None:
        return "medium"  # Default to balanced length

    if effective_tokens <= 512:
        return "short"
    elif effective_tokens <= 2048:
        return "medium"
    else:
        return "long"


def _detect_stage(messages: List[Dict]) -> str:
    """
    Detect which stage this call is for by examining the last message.
    Works with your existing prompt structure in council.py.
    """
    if not messages:
        _debug("[MOCK DETECT] No messages, defaulting to stage1")
        return "stage1"

    last_content = (messages[-1].get("content") or "").lower()
    _debug(f"[MOCK DETECT] Last message content (first 100 chars): {last_content[:100]}")

    # Title generation - check FIRST since it's a short prompt
    # Must check before stage1 (default) since title prompts don't have other markers
    if "short title" in last_content or "conversation title" in last_content or "generate a title" in last_content:
        _debug("[MOCK DETECT] -> TITLE")
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


def _stage1_content(model: str, length: str = "medium") -> str:
    """
    Generate realistic Stage 1 response with markdown.

    Args:
        model: The model identifier (used for styling)
        length: "short", "medium", or "long" (based on max_tokens)

    Returns:
        Mock response content sized appropriately
    """
    short_model = model.split("/")[-1] if "/" in model else model

    if length == "short":
        return _stage1_short(short_model, model)
    elif length == "long":
        return _stage1_long(short_model, model)
    else:
        return _stage1_medium(short_model, model)


def _stage1_short(short_model: str, model: str) -> str:
    """Short Stage 1 response (~100 words, ~400 tokens)."""
    if "gpt" in model.lower():
        return f"""## Quick Analysis from {short_model}

**Key Points:**
1. A methodical approach would be most effective here
2. Risk is moderate with manageable downside
3. Phased implementation is advisable

**Recommendation:** Proceed with structured milestones and iterative refinement. This balances speed with prudent risk management."""

    elif "claude" in model.lower():
        return f"""Here's my quick take from {short_model}.

**The Core Trade-off:** Speed vs. thoroughness. Moving fast risks missing nuances; moving slow risks missing opportunities.

**My Recommendation:**
- Start with clear problem definition
- Validate key assumptions early
- Build in checkpoints for course correction

Make good decisions with available information while staying adaptable."""

    elif "gemini" in model.lower():
        return f"""# Brief Analysis from {short_model}

| Factor | Assessment |
|--------|------------|
| Feasibility | High (85%) |
| Resources | Moderate |
| Risk | Low-Medium |

**Recommendation:** Direct implementation with standard safeguards. Monitor KPIs at 30-day intervals."""

    elif "grok" in model.lower():
        return f"""Quick take from {short_model}:

→ You're choosing between new and proven approaches
→ Both have merit, be honest about trade-offs
→ Analysis paralysis is real—sometimes just decide and commit

**Bottom line:** Fortune favors the *prepared* bold. Know your downside, accept it, move with conviction."""

    elif "deepseek" in model.lower():
        return f"""## Quick Analysis from {short_model}

**Key Factors:**
- Resource allocation and timeline constraints
- Stakeholder alignment requirements
- Execution complexity (Medium risk)

**Recommendation:** Clear phase gates with defined success criteria. Parallel workstreams where possible. Regular sync points for alignment."""

    else:
        return f"""## Brief Analysis from {short_model}

**Key Points:**
1. Market timing appears favorable
2. Prioritize core competencies
3. Use phased implementation for risk mitigation

**Recommendation:** Start with a pilot program to validate assumptions before full commitment."""


def _stage1_medium(short_model: str, model: str) -> str:
    """Medium Stage 1 response (~375 words, ~1500 tokens) - the original templates."""
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


def _stage1_long(short_model: str, model: str) -> str:
    """Long Stage 1 response (~1250 words, ~5000 tokens)."""
    if "gpt" in model.lower():
        return f"""## Comprehensive Strategic Analysis from {short_model}

### Executive Summary

Based on an exhaustive examination of your query and its broader context, I've developed a detailed framework for approaching this challenge. This analysis covers strategic considerations, implementation pathways, risk factors, and specific recommendations with supporting rationale.

### Introduction and Context

The question you've posed touches on fundamental aspects of decision-making under uncertainty. Before diving into specifics, it's worth establishing the broader context: we're operating in an environment characterized by rapid change, incomplete information, and multiple competing priorities. Understanding this context is essential for developing a robust approach.

### Core Strategic Considerations

**1. Primary Factors Analysis**

The primary factors at play suggest that a methodical, phased approach would be most effective. Here's why:

First, the complexity of the situation argues against any single decisive action. When we examine the interconnected nature of the variables involved, we see that changes in one area ripple through others in sometimes unpredictable ways. This interconnectedness means that iterative approaches with feedback loops generally outperform "big bang" implementations.

Second, our risk assessment indicates moderate complexity with manageable downside. This is actually good news—it means we have room to experiment without catastrophic consequences if individual initiatives don't pan out as expected.

Third, historical precedents from similar situations support a phased implementation strategy. Looking at case studies from comparable contexts, we consistently see better outcomes from organizations that took the time to validate assumptions before scaling their efforts.

**2. Market and Competitive Context**

The broader market context suggests several important considerations:

- Timing appears favorable for action, but windows of opportunity are finite
- Competitive dynamics reward both speed and quality—finding the right balance is key
- Customer/stakeholder expectations continue to evolve, requiring adaptive responses
- Technology trends are creating new possibilities while rendering some traditional approaches obsolete

**3. Internal Capability Assessment**

An honest evaluation of internal capabilities reveals:

| Capability Area | Current State | Required State | Gap |
|-----------------|---------------|----------------|-----|
| Technical Skills | Strong | Strong | Minimal |
| Process Maturity | Moderate | High | Moderate |
| Change Readiness | Moderate | High | Moderate |
| Resource Availability | Constrained | Adequate | Significant |

### Technical Implementation Framework

```python
class ImplementationFramework:
    def __init__(self, risk_tolerance, resource_constraints):
        self.phases = ["validate", "pilot", "scale", "optimize"]
        self.risk_tolerance = risk_tolerance
        self.constraints = resource_constraints

    def recommended_approach(self):
        phase_1 = self.validate_assumptions()
        phase_2 = self.pilot_implementation()
        phase_3 = self.scaled_rollout()
        phase_4 = self.continuous_optimization()
        return self.optimize_sequence(phase_1, phase_2, phase_3, phase_4)

    def validate_assumptions(self):
        return {{
            "duration": "2-4 weeks",
            "focus": "Testing core hypotheses",
            "exit_criteria": "80% confidence in key assumptions"
        }}
```

### Risk Analysis and Mitigation

**Primary Risks Identified:**

1. **Execution Risk (Medium)**: The complexity of coordinating multiple workstreams creates execution challenges. Mitigation: Clear ownership, regular syncs, and explicit dependencies mapping.

2. **Resource Risk (Medium-High)**: Competing priorities may constrain available resources. Mitigation: Phased approach that allows for resource reallocation as priorities clarify.

3. **Market Risk (Low-Medium)**: External conditions may shift during implementation. Mitigation: Modular design that allows for pivots without scrapping entire efforts.

4. **Technology Risk (Low)**: Technical choices may prove suboptimal. Mitigation: Favor proven technologies for core systems; reserve experimental approaches for non-critical components.

### Detailed Recommendations

**Immediate Actions (Next 2 Weeks):**
1. Establish clear success criteria and metrics
2. Identify and secure key resources and stakeholder buy-in
3. Create rapid prototypes to test core assumptions
4. Develop contingency plans for identified risks

**Short-Term Actions (Weeks 3-8):**
1. Launch pilot program with limited scope
2. Establish feedback mechanisms for early learning
3. Iterate on approach based on pilot results
4. Build capabilities required for scale

**Medium-Term Actions (Months 3-6):**
1. Scaled rollout based on validated approach
2. Continuous monitoring and optimization
3. Knowledge capture and documentation
4. Expansion planning based on results

### Conclusion

The analysis presented here argues for a structured, phased approach that balances the urgency of action with the need for validation and learning. By establishing clear milestones and decision points, you can move forward with confidence while maintaining the flexibility to adapt as new information emerges.

The key insight is that this isn't about finding the "perfect" plan—it's about creating a robust process for making good decisions iteratively. Organizations that master this capability consistently outperform those that wait for certainty before acting.

I recommend proceeding with structured milestones, allowing for iterative refinement based on early feedback. This approach balances speed with prudent risk management, positioning you for success regardless of how external conditions evolve."""

    elif "claude" in model.lower():
        return f"""I've given considerable thought to this question from {short_model}, and I want to share a thorough analysis that addresses not just the immediate question, but the broader context that will shape your path forward.

### Understanding the Full Picture

The situation you're facing presents several interconnected factors worth examining in depth. Let me walk through each of these and how they relate to your decision.

### 1. Context and Circumstances

The specific circumstances surrounding your situation will heavily influence the optimal path forward. What works in theory often needs significant adaptation in practice, and that's particularly true here because:

**Environmental Factors:**
- The market conditions you're operating in create both opportunities and constraints
- Competitive dynamics may be shifting in ways that affect your timeline
- Regulatory or compliance considerations may limit certain approaches
- Technology trends are opening new possibilities while closing others

**Internal Factors:**
- Your organization's current capabilities and gaps
- The cultural readiness for change
- Available resources and competing priorities
- Historical patterns of success and failure with similar initiatives

**Stakeholder Dynamics:**
Different parties involved in this situation will have different priorities and concerns that need to be balanced. Understanding these perspectives is crucial:

| Stakeholder Group | Primary Concerns | Success Criteria |
|-------------------|------------------|------------------|
| Leadership | Strategic alignment, ROI | Measurable outcomes |
| Teams | Feasibility, workload | Clear direction |
| Customers/Users | Value delivery | Improved experience |
| Partners | Reliability | Consistent engagement |

### 2. The Central Trade-offs

There's an inherent tension between several competing priorities that you'll need to navigate:

**Speed vs. Thoroughness:**
Moving quickly risks missing important nuances and making errors that are costly to correct later. Moving slowly risks missing windows of opportunity and losing momentum. The right balance depends on your specific risk tolerance and competitive context.

**Innovation vs. Proven Approaches:**
New approaches may offer advantages but come with uncertainty. Proven approaches are safer but may not deliver differentiated results. Consider which elements of your challenge require innovation and which can rely on established methods.

**Centralization vs. Distributed Action:**
Should you maintain tight coordination, or empower distributed decision-making? Each has trade-offs in terms of speed, consistency, and adaptability.

### 3. Framework for Moving Forward

Given these considerations, I'd recommend an approach structured around these principles:

**Principle 1: Start with Clear Problem Definition**

Before jumping to solutions, ensure you have a shared understanding of:
- What specific problem are you trying to solve?
- How will you know if you've succeeded?
- What constraints are truly fixed vs. negotiable?
- What assumptions are you making that could be tested?

**Principle 2: Identify and Validate Key Assumptions**

Every plan rests on assumptions about how the world works. The riskier approach is to proceed without testing these assumptions. Consider:
- Which assumptions, if wrong, would cause the biggest problems?
- How can you test these assumptions quickly and cheaply?
- What early indicators would suggest your assumptions need revision?

**Principle 3: Build in Checkpoints for Course Correction**

Rather than committing to a fixed plan, design your approach with explicit decision points where you can:
- Assess progress against expectations
- Incorporate new information that's emerged
- Adjust direction if circumstances have changed
- Double down on what's working and redirect from what isn't

### 4. Practical Implementation Considerations

Here's how these principles might translate into action:

**Phase 1: Discovery and Alignment (2-4 weeks)**
- Conduct stakeholder interviews to surface perspectives and concerns
- Review relevant data and precedents
- Develop shared problem statement and success criteria
- Identify highest-risk assumptions for early testing

**Phase 2: Rapid Prototyping (4-6 weeks)**
- Create minimal viable tests of core assumptions
- Gather feedback from key stakeholders
- Iterate based on learnings
- Develop refined approach based on validation

**Phase 3: Controlled Rollout (8-12 weeks)**
- Implement approach with limited scope
- Establish clear metrics and monitoring
- Create feedback loops for continuous learning
- Document what works and what doesn't

**Phase 4: Scale and Optimize (ongoing)**
- Expand successful approaches
- Retire or revise what's not working
- Build organizational capability
- Capture and share knowledge

### 5. Navigating Uncertainty

This isn't about finding the "perfect" answer—it's about making good decisions with available information while remaining adaptable. The organizations and individuals who succeed in complex environments share some common characteristics:

- They act despite uncertainty, knowing that waiting for complete information is itself a choice with consequences
- They treat decisions as experiments rather than commitments, remaining open to new information
- They build feedback loops that accelerate learning
- They maintain optionality where possible, avoiding irreversible commitments until necessary

### Final Thoughts

The path forward requires balancing multiple considerations without perfect information. My recommendation is to move forward thoughtfully but decisively, with built-in mechanisms for learning and adaptation. This approach honors both the urgency of action and the wisdom of humility about what we can know in advance.

Remember that the goal isn't to get everything right from the start—it's to create conditions for continuous improvement and rapid correction when things don't go as expected. That's not a weakness in your approach; it's a feature."""

    elif "gemini" in model.lower():
        return f"""# Comprehensive Analysis Report from {short_model}

## Executive Summary

After conducting a multi-dimensional analysis of the query parameters and contextual factors, I've developed a detailed assessment with actionable recommendations. This report provides a systematic evaluation of key decision factors, quantitative assessments where appropriate, and a structured implementation framework.

## 1. Situational Assessment

### 1.1 Current State Analysis

The present situation can be characterized across several dimensions:

| Dimension | Current State | Implications |
|-----------|---------------|--------------|
| Market Position | Stable with growth potential | Opportunity to capture share with right approach |
| Competitive Intensity | Moderate and increasing | Time-sensitive window for action |
| Resource Availability | Constrained but manageable | Requires prioritization and phasing |
| Organizational Readiness | Moderate | Change management will be critical |
| Technology Maturity | Strong foundation exists | Can build on existing capabilities |

### 1.2 Key Environmental Factors

**External Environment:**
- Market dynamics suggest favorable conditions for action
- Competitive pressures are intensifying but not yet prohibitive
- Technology trends align with proposed direction
- Regulatory environment is stable with no major changes expected

**Internal Environment:**
- Organizational capabilities are adequate for initial phases
- Cultural readiness for change is moderate—will require attention
- Resource constraints necessitate careful prioritization
- Leadership alignment exists at strategic level

## 2. Key Findings

### 2.1 Quantitative Assessment

| Factor | Assessment | Confidence | Risk Level |
|--------|------------|------------|------------|
| Feasibility | High | 85% | Low |
| Resource Requirements | Moderate | 78% | Medium |
| Timeline Risk | Low-Medium | 72% | Medium-Low |
| Market Opportunity | Strong | 80% | Low |
| Execution Complexity | Moderate | 75% | Medium |
| Expected ROI | Favorable | 70% | Medium |

### 2.2 SWOT Analysis

**Strengths:**
- Strong technical foundation to build upon
- Aligned leadership and clear strategic direction
- Existing capabilities reduce implementation complexity
- Market position provides launch platform

**Weaknesses:**
- Resource constraints limit parallel initiatives
- Change management capabilities are developing
- Some capability gaps in key areas
- Historical patterns show mixed execution track record

**Opportunities:**
- Market timing is favorable for action
- Technology trends create new possibilities
- Competitive gaps exist that could be exploited
- Partnership opportunities could accelerate progress

**Threats:**
- Competitive response could intensify
- Market conditions could shift unexpectedly
- Resource competition from other initiatives
- Technology changes could require pivots

## 3. Detailed Analysis

### 3.1 Option Evaluation

The analysis suggests three primary paths forward:

**Option A: Direct Implementation**
- Proceed directly to full implementation with standard safeguards
- Pros: Fastest time to full value; demonstrates commitment
- Cons: Higher risk if assumptions prove incorrect; less learning opportunity
- Recommended when: High confidence in approach; time pressure is dominant factor

**Option B: Staged Approach**
- Implement through defined phases with intermediate validation
- Pros: Balances speed with learning; allows course correction
- Cons: Longer time to full value; requires phase transition management
- Recommended when: Moderate uncertainty; resources allow sequential investment

**Option C: Parallel Piloting**
- Run multiple smaller experiments simultaneously
- Pros: Maximum learning; reduces commitment to single path
- Cons: Resource intensive; coordination complexity
- Recommended when: High uncertainty; multiple viable approaches to test

### 3.2 Risk Analysis

**Risk Matrix:**

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| Execution delays | Medium | Medium | Phased approach with buffers |
| Resource competition | Medium | High | Early stakeholder alignment |
| Market shift | Low | High | Flexible architecture; monitoring |
| Technology changes | Low | Medium | Modular design; standards-based |
| Stakeholder resistance | Medium | Medium | Change management investment |

### 3.3 Financial Considerations

```
Estimated Investment Profile:
├── Phase 1 (Validation): $X * 0.15
├── Phase 2 (Pilot): $X * 0.25
├── Phase 3 (Scale): $X * 0.40
└── Phase 4 (Optimize): $X * 0.20

Expected Return Timeline:
├── Break-even: Month 12-18
├── Full ROI: Month 24-36
└── Ongoing value: Sustainable post Year 2

Risk-Adjusted NPV: Positive at discount rates < 15%
```

## 4. Implementation Framework

### 4.1 Recommended Approach

Based on the analysis, I recommend **Option B: Staged Approach** with the following structure:

**Phase 1: Foundation (Weeks 1-4)**
- Establish governance and success metrics
- Secure resources and stakeholder buy-in
- Validate core assumptions through rapid prototyping
- Exit criteria: 80%+ confidence in key assumptions

**Phase 2: Pilot (Weeks 5-12)**
- Implement with limited scope/audience
- Build capabilities and refine processes
- Gather data for scale decision
- Exit criteria: Metrics meet or exceed targets

**Phase 3: Scale (Months 4-9)**
- Expand successful approaches systematically
- Address gaps identified during pilot
- Build sustainable operating model
- Exit criteria: Full deployment complete

**Phase 4: Optimize (Month 10+)**
- Continuous improvement based on data
- Efficiency gains and cost optimization
- Knowledge capture and capability building
- Exit criteria: Ongoing

### 4.2 Success Metrics

| Metric | Target | Measurement Frequency |
|--------|--------|----------------------|
| Primary KPI | +20% improvement | Monthly |
| Secondary KPI | +15% improvement | Quarterly |
| Customer satisfaction | >4.0/5.0 | Monthly |
| Cost efficiency | -10% | Quarterly |
| Time to value | <6 months | Once |

## 5. Conclusions and Recommendations

### 5.1 Primary Recommendation

Proceed with Option B (Staged Approach) while maintaining Option A readiness if Phase 1 validation exceeds expectations. This approach optimizes for:
- Learning while doing
- Manageable risk profile
- Resource efficiency
- Stakeholder confidence building

### 5.2 Immediate Next Steps

1. Establish project governance and steering committee
2. Secure Phase 1 resources and timeline commitment
3. Define detailed success metrics and measurement approach
4. Identify and mitigate top 3 risks
5. Schedule Phase 1 kickoff within 2 weeks

### 5.3 Monitoring and Decision Points

Monitor key performance indicators at 30-day intervals. Establish formal phase-gate reviews at:
- End of Phase 1: Go/No-Go for Pilot
- End of Phase 2: Scale strategy decision
- 6-month mark: Full assessment and course correction

```
Analysis Metadata:
├── Confidence Score: 0.82
├── Methodology: Multi-factor weighted analysis
├── Data Sources: Historical data, market research, stakeholder input
├── Assumptions: See Appendix A
└── Last Updated: Current Date
```"""

    elif "grok" in model.lower():
        return f"""Alright, let's have a real conversation about what you're facing. {short_model} here, and I'm going to give you my full, unfiltered analysis of your situation.

### The Real Question You're Asking

Strip away the formalities, and you're essentially asking: should I bet on the new approach or stick with what's proven? Both have merit, but let's be ruthlessly honest about the trade-offs instead of pretending there's an obvious answer.

### What Conventional Wisdom Gets Wrong

Here's the thing about conventional wisdom—it produces conventional results. If you do what everyone else does, you'll get what everyone else gets. That's not necessarily bad, but let's be clear about the choice you're making.

**What the "Safe" Path Really Means:**
- You'll avoid the worst outcomes
- You'll also avoid the best outcomes
- You'll spend a lot of energy justifying why you didn't take bigger swings
- You'll probably end up where competitors who were more aggressive will define the market for you

**What the "Bold" Path Really Means:**
- You're accepting higher variance
- Some things will fail, possibly publicly
- The successes will be bigger when they happen
- You'll learn faster, even from the failures

### My Honest Assessment

Let's talk about what I actually think, not what sounds wise:

**1. Most People Overthink This**

Analysis paralysis is real. I've seen countless situations where people spent more time analyzing the decision than it would have taken to try something, learn from it, and iterate. At some point, the best decision is the one you actually make and commit to.

**2. Your Actual Risk Tolerance Is Probably Lower Than You Claim**

Here's an uncomfortable truth: most people overestimate their risk tolerance. They say they're willing to take big swings, but when the moment comes, they hedge. Know yourself. If you're going to half-commit to the bold path, you might be better off with the conservative approach fully executed.

**3. The "Prepared Bold" Framework**

Fortune favors the bold, but only the *prepared* bold. Here's what that means in practice:

| Unprepared Bold | Prepared Bold |
|-----------------|---------------|
| Jumps without looking | Looks, then jumps decisively |
| Ignores downside | Knows and accepts downside |
| Hopes for best | Plans for worst, optimizes for best |
| Confuses confidence with competence | Builds competence, then gains confidence |
| Bets everything on one outcome | Bets big but maintains optionality |

**4. The Time Factor**

Something people don't talk about enough: the cost of delay is often invisible but real. While you're deliberating, the world is moving. Opportunities are opening and closing. Your competitors are acting or not acting. Time spent in analysis has an opportunity cost.

### The Contrarian View

Let me push back on some assumptions that might be constraining your thinking:

**Assumption: We need more information to decide**
*Contrarian take:* You probably have enough information already. The marginal value of additional analysis is low, and the cost (time, momentum, mental energy) is higher than you're accounting for.

**Assumption: We should get alignment before moving**
*Contrarian take:* Sometimes it's easier to get forgiveness than permission. Not always, but sometimes action creates clarity that discussion never will.

**Assumption: We should mitigate all identified risks**
*Contrarian take:* Not all risks are worth mitigating. Some are worth taking. The goal isn't zero risk—it's the right risk/reward trade-off.

**Assumption: The plan needs to be comprehensive**
*Contrarian take:* Overplanned initiatives are fragile. They break when reality doesn't match the plan. Better to have a clear direction with built-in adaptability.

### What I'd Actually Do

If I were in your position, here's my honest take:

**Short-term (Next 2 weeks):**
- Make a call. Pick a direction. The perfect decision made too late is worse than a good decision made now.
- Communicate it clearly. Uncertainty is poison for execution.
- Identify the first concrete action and take it.

**Medium-term (Weeks 3-8):**
- Move fast enough that you're learning from reality, not speculation
- Build in weekly reality checks—are you on track? What's surprised you?
- Kill things that aren't working quickly. Don't throw good energy after bad.

**Long-term (Months 2-6):**
- Reassess the big picture—is your original thesis holding up?
- Double down on what's working
- Build the capability to do this again—the meta-skill of making good decisions under uncertainty

### The Bottom Line

Here's what I want you to take away:

1. **Know your downside.** What's the worst that happens if this fails? Can you live with that? If yes, proceed.

2. **Accept the downside.** Don't pretend it doesn't exist. Don't assume you'll avoid it. Price it in mentally.

3. **Move with conviction.** Once you've decided, commit. Half-measures satisfy no one and achieve nothing.

4. **Stay adaptable.** Conviction in direction, flexibility in tactics. The goal is what matters; the path can change.

5. **Don't confuse activity with progress.** More planning isn't always better. More meetings aren't always better. Sometimes you just need to do the thing.

Fortune favors the bold, but only the *prepared* bold. Know your downside, accept it, then move with conviction.

— {short_model}"""

    elif "deepseek" in model.lower():
        return f"""## Comprehensive Strategic Analysis from {short_model}

### Executive Overview

This analysis provides a systematic decomposition of the question posed, examining it from multiple angles including strategic, technical, organizational, and risk perspectives. The goal is to provide a thorough framework for decision-making that accounts for both explicit factors and hidden complexities.

### 1. Problem Decomposition

Let me break this down systematically, examining each component of the challenge.

#### 1.1 Strategic Assessment

The fundamental question requires examining multiple interdependent variables. Key dependencies include:

**Resource Factors:**
- Resource availability and allocation efficiency
- Competing priorities and opportunity costs
- Skill availability and capability gaps
- Capital constraints and investment timing

**Timeline Factors:**
- Timeline constraints and flexibility margins
- External dependencies and their schedules
- Market timing considerations
- Competitive dynamics affecting urgency

**Organizational Factors:**
- Stakeholder alignment and decision authority
- Change management readiness
- Cultural factors affecting execution
- Historical patterns of success/failure

#### 1.2 Dependency Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                    Decision Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐               │
│  │Strategic│     │Technical│     │ Organi- │               │
│  │ Factors │────▶│ Factors │────▶│zational │               │
│  └────┬────┘     └────┬────┘     └────┬────┘               │
│       │               │               │                     │
│       ▼               ▼               ▼                     │
│  ┌─────────────────────────────────────────┐               │
│  │         Resource Constraints            │               │
│  └─────────────────────────────────────────┘               │
│                       │                                     │
│                       ▼                                     │
│  ┌─────────────────────────────────────────┐               │
│  │           Risk Assessment               │               │
│  └─────────────────────────────────────────┘               │
│                       │                                     │
│                       ▼                                     │
│  ┌─────────────────────────────────────────┐               │
│  │         Decision Framework              │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Technical Considerations

From an implementation standpoint, several technical factors require attention:

#### 2.1 Architecture Considerations

The technical architecture should support:
- Modularity for independent component evolution
- Scalability to handle growth without redesign
- Maintainability for long-term sustainability
- Observability for monitoring and debugging

```
Implementation Flow:
Input → Process → Validate → Iterate → Output
           ↑                      ↓
           └──── Feedback Loop ───┘

Detail:
├── Input: Requirements, data, context
│   ├── Validate inputs against constraints
│   ├── Transform to internal representations
│   └── Queue for processing
│
├── Process: Core transformation logic
│   ├── Apply business rules
│   ├── Handle edge cases
│   └── Generate outputs
│
├── Validate: Quality assurance
│   ├── Check against success criteria
│   ├── Identify anomalies
│   └── Flag issues for review
│
├── Iterate: Continuous improvement
│   ├── Collect feedback
│   ├── Analyze patterns
│   └── Implement enhancements
│
└── Output: Deliverables
    ├── Core results
    ├── Metadata and logging
    └── Feedback for next iteration
```

#### 2.2 Integration Considerations

Key integration points to address:
- External system interfaces and contracts
- Data flow and synchronization
- Error handling and recovery
- Performance optimization

### 3. Risk Analysis

Primary risks identified with detailed mitigation strategies:

#### 3.1 Risk Matrix

| Risk Category | Specific Risk | Likelihood | Impact | Mitigation |
|---------------|---------------|------------|--------|------------|
| Execution | Complexity underestimated | Medium | High | Phase gates, early prototyping |
| Execution | Coordination failures | Medium | Medium | Clear ownership, regular syncs |
| Resources | Key person dependencies | Low | High | Knowledge sharing, documentation |
| Resources | Budget constraints | Medium | Medium | Phased investment, clear ROI |
| External | Vendor/partner issues | Low | Medium | Contingency plans, alternatives |
| External | Market changes | Low | High | Modular design, monitoring |
| Technical | Integration challenges | Medium | Medium | Early testing, fallback options |
| Technical | Performance issues | Low | Medium | Benchmarking, optimization |

#### 3.2 Risk-Adjusted Decision Framework

When accounting for risks, the analysis suggests:

**Low Risk Tolerance (Conservative):**
- Recommend phased approach with extensive validation
- Prioritize proven technologies and methods
- Build significant contingency into timelines
- Accept slower progress for higher certainty

**Medium Risk Tolerance (Balanced):**
- Recommend staged approach with intermediate checkpoints
- Mix of proven and innovative elements
- Moderate contingency buffers
- Balance speed and certainty

**High Risk Tolerance (Aggressive):**
- Recommend faster implementation with lighter validation
- Embrace innovative approaches where beneficial
- Lean contingencies, accept higher variance
- Prioritize speed and learning

### 4. Implementation Framework

#### 4.1 Phased Approach

**Phase 1: Foundation (Weeks 1-4)**
Objectives:
- Establish governance and decision-making framework
- Secure resources and stakeholder alignment
- Validate core assumptions
- Define success metrics

Deliverables:
- Project charter and governance model
- Resource plan and assignments
- Assumption validation report
- Metrics dashboard design

**Phase 2: Development (Weeks 5-12)**
Objectives:
- Build core capabilities
- Implement with limited scope
- Establish operational patterns
- Gather initial feedback

Deliverables:
- Working implementation (limited scope)
- Operational procedures
- Feedback collection mechanism
- Performance baseline

**Phase 3: Expansion (Weeks 13-24)**
Objectives:
- Scale to full scope
- Optimize based on learnings
- Build sustainable operations
- Document and train

Deliverables:
- Full-scope implementation
- Optimized processes
- Operational documentation
- Trained team

#### 4.2 Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Core KPI | +X% improvement | Monthly review |
| Quality | <Y% error rate | Weekly monitoring |
| Efficiency | Z% improvement | Quarterly assessment |
| Satisfaction | >4.0/5.0 | Monthly survey |
| ROI | Positive by Month N | Quarterly calculation |

### 5. Synthesis and Recommendations

Balancing the factors analyzed above, my recommendation emphasizes:

**Strategic Positioning:**
- Clear phase gates with defined success criteria
- Explicit decision points for continuation, pivot, or termination
- Built-in flexibility for adaptation

**Tactical Execution:**
- Parallel workstreams where dependencies allow
- Regular sync points for cross-functional alignment
- Aggressive but realistic timelines

**Operational Excellence:**
- Strong governance without bureaucratic overhead
- Clear ownership and accountability
- Continuous feedback and adaptation

**Risk Management:**
- Explicit risk monitoring and response triggers
- Contingency plans for identified risks
- Regular risk reassessment

### 6. Conclusion

This structured approach maximizes probability of successful outcomes while maintaining flexibility for adaptation. The key is not to seek certainty before acting, but to create a robust process for making good decisions as you go.

The recommended path forward balances:
- Speed of execution with quality of outcomes
- Confidence in direction with adaptability in tactics
- Bold ambition with prudent risk management

Implementation should begin with Phase 1 activities within the next 2 weeks, with a formal Phase 1 gate review scheduled for Week 4."""

    else:
        return f"""## Comprehensive Analysis from {short_model}

### Executive Summary

This analysis examines the key considerations for your decision, providing a structured framework for evaluation and action. The goal is to balance thoroughness with practicality, giving you the information you need to move forward with confidence.

### 1. Situational Analysis

Based on the available information, here are the key factors shaping your decision:

**Market Context:**
- Current market timing appears favorable for action
- Competitive dynamics suggest moderate but increasing pressure
- Customer expectations continue to evolve
- Technology trends are creating both opportunities and challenges

**Internal Context:**
- Organizational capabilities align reasonably well with requirements
- Resource constraints necessitate careful prioritization
- Cultural factors will influence execution approach
- Historical patterns suggest areas for attention

### 2. Strategic Factors

The following strategic considerations should inform your approach:

**1. Core Competency Alignment:**
Resource allocation should prioritize core competencies. Initiatives that leverage existing strengths typically have higher success rates and better returns than those requiring significant new capability building.

**2. Risk Profile:**
Risk mitigation through phased implementation is advisable. This approach allows for learning and adaptation while managing downside exposure.

**3. Timing Considerations:**
Market timing appears favorable, but windows of opportunity are finite. The cost of delay should be weighed against the benefits of additional preparation.

**4. Stakeholder Dynamics:**
Different stakeholders will have different perspectives and priorities. Success requires understanding and addressing these varying needs.

### 3. Options Analysis

| Option | Pros | Cons | Best When |
|--------|------|------|-----------|
| Aggressive | Fast results, market share | Higher risk, more demanding | High confidence, time pressure |
| Moderate | Balanced risk/reward | Moderate pace | Typical situations |
| Conservative | Lower risk, thorough | Slower, may miss opportunities | High uncertainty |

### 4. Technical Considerations

```python
def implementation_framework():
    \"\"\"
    Framework for systematic implementation
    \"\"\"
    phases = {
        'validate': {'duration': '2-4 weeks', 'focus': 'Assumption testing'},
        'pilot': {'duration': '4-8 weeks', 'focus': 'Limited implementation'},
        'scale': {'duration': '8-16 weeks', 'focus': 'Full rollout'},
        'optimize': {'duration': 'Ongoing', 'focus': 'Continuous improvement'}
    }

    return phases
```

### 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Execution delays | Medium | Medium | Phased approach, buffers |
| Resource constraints | Medium | High | Prioritization, early alignment |
| Market changes | Low | High | Modular design, monitoring |
| Stakeholder resistance | Medium | Medium | Change management |

### 6. Recommendations

**Short-term (Next 4 weeks):**
1. Validate core assumptions through targeted research or prototyping
2. Secure stakeholder alignment and resource commitments
3. Define clear success metrics and measurement approach
4. Identify and mitigate top risks

**Medium-term (Weeks 5-16):**
1. Launch pilot program with limited scope
2. Establish feedback mechanisms and monitoring
3. Iterate based on learnings
4. Prepare for scale

**Long-term (Months 4+):**
1. Scaled rollout based on validated approach
2. Continuous optimization and improvement
3. Knowledge capture and capability building
4. Expansion planning

### 7. Conclusion

I recommend proceeding with a measured approach, starting with a pilot program to validate assumptions before full commitment.

This balanced approach minimizes downside risk while preserving upside potential. The key is not to seek certainty before acting, but to create conditions for rapid learning and adaptation as you proceed.

Success will depend on:
- Clear goals and metrics from the start
- Willingness to learn and adapt
- Consistent execution with built-in flexibility
- Strong stakeholder engagement throughout

The recommended first step is to secure alignment on objectives and begin the validation phase within the next two weeks."""


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


def _stage3_content(length: str = "medium") -> str:
    """
    Generate Chairman synthesis with length variants.

    Args:
        length: "short", "medium", or "long" (based on max_tokens)

    Returns:
        Mock synthesis content sized appropriately
    """
    if length == "short":
        return _stage3_short()
    elif length == "long":
        return _stage3_long()
    else:
        return _stage3_medium()


def _stage3_short() -> str:
    """Short Stage 3 synthesis (~100 words, ~400 tokens)."""
    return """# Chairman's Synthesis

**Council Consensus:** Proceed with a phased approach, starting small and iterating based on data.

## Key Points
1. Define success metrics upfront
2. Start with a limited pilot
3. Establish 30/60/90 day checkpoints
4. Maintain adaptability for course correction

| Risk | Mitigation |
|------|------------|
| Execution complexity | Phased approach |
| Resource constraints | Clear prioritization |

**Confidence: 75%** — Strong consensus with some external uncertainty.

**Next Step:** Align stakeholders, resource the pilot, begin execution."""


def _stage3_medium() -> str:
    """Medium Stage 3 synthesis (~375 words, ~1500 tokens) - the original template."""
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


def _stage3_long() -> str:
    """Long Stage 3 synthesis (~1250 words, ~5000 tokens)."""
    return """# Chairman's Executive Synthesis

## Executive Summary

After careful deliberation, the AI Council has reached a comprehensive recommendation for your strategic challenge. This synthesis integrates insights from all council members, resolving areas of disagreement and presenting a unified path forward. The council recommends a phased approach with clear success metrics, starting small and iterating based on data, while maintaining appropriate guardrails throughout.

## Table of Contents

- [Executive Summary](#executive-summary)
- [Deliberation Overview](#deliberation-overview)
- [Key Insights and Consensus](#key-insights-and-consensus)
- [Points of Debate and Resolution](#points-of-debate-and-resolution)
- [Detailed Recommendations](#detailed-recommendations)
- [Risk Assessment](#risk-assessment)
- [Implementation Roadmap](#implementation-roadmap)
- [Success Metrics](#success-metrics)
- [Conclusion](#conclusion)

## Deliberation Overview

The council examined your challenge from multiple perspectives:

- **Strategic lens**: Long-term positioning and competitive implications
- **Technical lens**: Implementation feasibility and architectural considerations
- **Operational lens**: Resource requirements and execution complexity
- **Risk lens**: Downside scenarios and mitigation strategies

Each perspective contributed valuable insights that shaped the final recommendations.

## Key Insights and Consensus

### Areas of Strong Agreement

The council reached strong consensus on several fundamental points:

**1. Proceed with Appropriate Guardrails**

All council members support moving forward with defined limits and checkpoints. This isn't about playing it safe—it's about creating conditions for sustainable success. The guardrails serve not to limit ambition but to ensure that progress is measurable and course corrections are possible.

**2. Start Small, Iterate Fast**

Multiple responses emphasized phased approaches over big-bang implementations. The rationale is consistent across perspectives:
- Small starts allow for rapid learning
- Early failures are cheaper to address
- Success builds organizational confidence
- Momentum is more sustainable than one-time effort

**3. Define Success Metrics Upfront**

Clear agreement emerged that measurable criteria are essential before proceeding. Metrics should be:
- Quantitative where possible
- Leading indicators, not just lagging
- Actionable (linked to specific decisions)
- Reviewed regularly with explicit response protocols

**4. Maintain Adaptability**

The council values approaches that preserve optionality. In an environment of uncertainty:
- Avoid irreversible commitments until necessary
- Design for pivots without complete restarts
- Build learning loops into every phase
- Distinguish between core direction (stable) and tactical approach (flexible)

### Cross-Cutting Themes

Several themes emerged across multiple council members:

| Theme | Implications |
|-------|-------------|
| Speed vs. quality | Balance through iteration rather than choosing one |
| Bold vs. prudent | "Prepared bold" - know downside, then commit |
| Individual vs. collective | Clear ownership with regular cross-functional syncs |
| Short-term vs. long-term | Phased approach that builds toward long-term goals |

## Points of Debate and Resolution

### Debate 1: Risk Tolerance Level

**The tension**: Views ranged from conservative (extensive validation before each step) to aggressive (move fast, learn fast, accept some failures).

**Resolution**: The council recommends a graduated approach:
- Higher risk tolerance in early phases when stakes are lower
- Increasing rigor as investment grows
- Explicit risk thresholds that trigger pause-and-assess

### Debate 2: Technical Depth vs. Strategic Focus

**The tension**: Some responses prioritized high-level strategic considerations while others focused on implementation details.

**Resolution**: Both are necessary, but sequenced:
- Phase 1: Strategic clarity (what and why)
- Phase 2: Technical validation (how)
- Phase 3: Execution excellence (detailed implementation)

### Debate 3: Timeline Urgency

**The tension**: Some members emphasized market timing and competitive pressure; others cautioned against rushing.

**Resolution**: Create a "fast but thorough" approach:
- Aggressive timelines for each phase
- Clear exit criteria before advancing
- Willingness to extend if criteria unmet, but not indefinitely

## Detailed Recommendations

### Immediate Actions (Next 2 Weeks)

1. **Establish governance structure**
   - Identify decision-makers and accountabilities
   - Set meeting cadence and escalation paths
   - Define information flow requirements

2. **Define success criteria**
   - Quantitative metrics for each phase
   - Leading indicators to monitor weekly
   - Explicit thresholds for go/no-go decisions

3. **Validate core assumptions**
   - List the 3-5 assumptions that matter most
   - Design minimal tests for each
   - Accept that some uncertainty will remain

4. **Secure resources**
   - Identify required skills and availability
   - Address gaps before beginning
   - Build in contingency for the unexpected

### Short-Term Actions (Weeks 3-8)

1. **Launch pilot program**
   - Limited scope, clear boundaries
   - Intensive monitoring and learning
   - Regular stakeholder updates

2. **Build measurement infrastructure**
   - Dashboards for key metrics
   - Feedback loops from execution to strategy
   - Early warning indicators

3. **Iterate based on learnings**
   - Weekly retrospectives
   - Rapid adjustment of approach
   - Documentation of what works and what doesn't

4. **Prepare for scale**
   - Build capabilities needed for next phase
   - Address systemic issues before they scale
   - Develop playbooks for expansion

### Medium-Term Actions (Months 3-6)

1. **Scaled rollout**
   - Expand based on validated approach
   - Maintain quality as scope grows
   - Regular checkpoints to assess trajectory

2. **Continuous optimization**
   - Efficiency improvements
   - Process refinements
   - Capability building

3. **Knowledge capture**
   - Document learnings for future reference
   - Build organizational capability
   - Share insights across teams

## Risk Assessment

### Risk Matrix

| Risk Factor | Likelihood | Impact | Mitigation Strategy |
|-------------|------------|--------|---------------------|
| Execution complexity | Medium | High | Phased approach, regular reviews |
| Resource constraints | Low | Medium | Clear prioritization, staged commitment |
| External dependencies | Variable | Medium | Contingency planning, parallel paths |
| Stakeholder alignment | Low | High | Early engagement, regular communication |
| Technology changes | Low | Medium | Modular design, monitoring trends |
| Market shifts | Variable | High | Flexible architecture, quick pivots |

### Risk Monitoring Protocol

- **Weekly**: Check leading indicators for early warning signs
- **Bi-weekly**: Review risk register and update assessments
- **Monthly**: Deep-dive on highest-priority risks
- **As-needed**: Escalate issues that exceed defined thresholds

## Implementation Roadmap

```
Phase 1: Foundation (Weeks 1-4)
├── Establish governance
├── Define success criteria
├── Validate assumptions
├── Secure resources
└── Gate: 80%+ confidence to proceed

Phase 2: Pilot (Weeks 5-12)
├── Launch limited program
├── Intensive monitoring
├── Weekly iterations
├── Prepare for scale
└── Gate: Metrics meet targets

Phase 3: Scale (Months 4-6)
├── Expanded rollout
├── Continuous optimization
├── Capability building
├── Knowledge capture
└── Gate: Sustainable operations

Phase 4: Optimize (Month 7+)
├── Efficiency improvements
├── Advanced capabilities
├── Strategic expansion
└── Ongoing: Continuous improvement
```

## Success Metrics

| Metric Category | Specific Metric | Target | Frequency |
|-----------------|-----------------|--------|-----------|
| Progress | Milestones completed | Per plan | Weekly |
| Quality | Error/issue rate | <5% | Weekly |
| Efficiency | Resource utilization | >80% | Monthly |
| Outcomes | Primary KPI improvement | +20% | Monthly |
| Learning | Assumptions validated | 80%+ | Per phase |

## Conclusion

### The Path Forward

The council's recommendation is clear: proceed with confidence, but proceed wisely. This means:

1. **Commit to the direction** - The analysis supports moving forward
2. **Embrace the uncertainty** - Perfect information isn't coming; act anyway
3. **Build in adaptability** - Design for learning and course correction
4. **Execute with discipline** - Follow the process, respect the checkpoints
5. **Maintain momentum** - Don't let perfect be the enemy of good

### Immediate Next Steps

1. Align stakeholders on success criteria
2. Resource the pilot phase
3. Establish governance cadence
4. Begin execution with a checkpoint at Day 30

### Confidence Assessment

**Overall Confidence: Moderate-High (75%)**

This reflects:
- Strong council consensus on direction
- Well-understood problem domain
- Proven approaches being recommended
- Some uncertainty in external factors

The council is confident that following this approach will maximize the probability of success while maintaining the flexibility to adapt as circumstances evolve.

---

*This synthesis represents the integrated wisdom of the AI Council. The recommendations balance diverse perspectives to provide a coherent, actionable path forward.*"""


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


async def generate_mock_response(
    model: str,
    messages: List[Dict],
    max_tokens: Optional[int] = None
) -> Optional[Dict]:
    """
    Main entry point for non-streaming mock responses.

    Args:
        model: The model identifier
        messages: List of message dicts
        max_tokens: Optional max tokens (used for length-aware responses)

    Returns:
        dict with 'content', 'reasoning_details', and 'usage' keys, or None for simulated failure
    """
    # Simulate network latency
    await asyncio.sleep(random.uniform(MOCK_DELAY_MIN, MOCK_DELAY_MAX))

    # Simulate model failure in failure scenario
    if MOCK_LLM_SCENARIO == "one_model_fails":
        # Fail models with "gpt" in name, or 20% random failure
        if "gpt" in model.lower() or random.random() < 0.2:
            _debug(f"[MOCK FAIL] Simulating failure for {model}")
            return None

    stage = _detect_stage(messages)
    effective_tokens = _get_effective_max_tokens(max_tokens)
    length = _get_length_category(max_tokens)
    override_info = f", override={effective_tokens}" if effective_tokens != max_tokens else ""
    _debug(f"[MOCK] {model} -> {stage} (length={length}, max_tokens={max_tokens}{override_info})")

    if stage == "stage1":
        content = _stage1_content(model, length)
    elif stage == "stage2":
        content = _stage2_content(model)
    elif stage == "stage3":
        content = _stage3_content(length)
    elif stage == "curator":
        content = _curator_content()
    elif stage == "title":
        content = _title_content()
    elif stage == "triage":
        content = _triage_content()
    else:
        content = _stage1_content(model, length)

    return {
        "content": content,
        "reasoning_details": None,
        "usage": _estimate_mock_usage(content, messages),
        "model": model,
    }


async def generate_mock_response_stream(
    model: str,
    messages: List[Dict],
    max_tokens: Optional[int] = None
) -> AsyncGenerator[str, None]:
    """
    Main entry point for streaming mock responses.
    Yields content token-by-token to simulate streaming.

    Args:
        model: The model identifier
        messages: List of message dicts
        max_tokens: Optional max tokens (used for length-aware responses)

    Yields:
        Text chunks simulating streaming response
    """
    # Simulate initial connection latency
    await asyncio.sleep(random.uniform(0.1, 0.3))

    # Simulate model failure in failure scenario
    if MOCK_LLM_SCENARIO == "one_model_fails":
        if "gpt" in model.lower() or random.random() < 0.2:
            _debug(f"[MOCK STREAM FAIL] Simulating failure for {model}")
            yield "[Error: Model overloaded (mock failure)]"
            return

    stage = _detect_stage(messages)
    effective_tokens = _get_effective_max_tokens(max_tokens)
    length = _get_length_category(max_tokens)
    override_info = f", override={effective_tokens}" if effective_tokens != max_tokens else ""
    _debug(f"[MOCK STREAM] {model} -> {stage} (length={length}, max_tokens={max_tokens}{override_info})")

    if stage == "stage1":
        content = _stage1_content(model, length)
    elif stage == "stage2":
        content = _stage2_content(model)
    elif stage == "stage3":
        content = _stage3_content(length)
    elif stage == "curator":
        content = _curator_content()
    elif stage == "title":
        content = _title_content()
    elif stage == "triage":
        content = _triage_content()
    else:
        content = _stage1_content(model, length)

    # Stream content in chunks (simulating token-by-token delivery)
    # Use larger chunks for faster testing, smaller for more realistic streaming
    chunk_size = 15  # characters per chunk
    delay_per_chunk = 0.02  # seconds between chunks

    for i in range(0, len(content), chunk_size):
        chunk = content[i:i + chunk_size]
        yield chunk
        await asyncio.sleep(delay_per_chunk)
