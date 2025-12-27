# LLM Operations & Economics Audit - AI Cost Control & Reliability

You are an AI/ML operations engineer auditing a multi-model LLM orchestration system. This platform runs 5 parallel AI models per query through a 3-stage deliberation pipeline. Token costs, reliability, and quality are critical.

**The Stakes**: With 5 models per query, unoptimized prompts or poor model selection could burn through API budgets. This audit ensures cost efficiency and operational excellence.

## LLM Architecture Overview

AxCouncil's 3-Stage Pipeline:
1. **Stage 1**: 5 council members respond in parallel (Claude, GPT, Gemini, Grok, DeepSeek)
2. **Stage 2**: Each model ranks anonymized responses from Stage 1
3. **Stage 3**: Chairman synthesizes final response with fallback models

## Audit Checklist

### 1. Token Cost Tracking
```
Check for:
- [ ] Cost estimation per query (input + output tokens × model pricing)
- [ ] Cost breakdown by model (which models are expensive?)
- [ ] Cost tracking in database or metrics system
- [ ] Budget alerts or limits per user/company
- [ ] Token usage visible in billing/admin dashboards
- [ ] Historical cost trends accessible
- [ ] Cost per stage (Stage 1 vs 2 vs 3)
```

**Files to Review:**
- `backend/council.py` - Main orchestration
- `backend/openrouter.py` - API calls
- `backend/model_registry.py` - Model configuration
- `backend/routers/billing.py` - Billing integration

### 2. Token Estimation Accuracy
```
Check for:
- [ ] Token counting method (tiktoken vs estimate)
- [ ] Accuracy of 4-chars-per-token estimate (context_loader.py:41)
- [ ] Context window utilization tracking
- [ ] Truncation strategy effectiveness
- [ ] Buffer for response tokens in context limits
- [ ] Model-specific tokenizer handling
```

### 3. Model Performance Tracking
```
Check for:
- [ ] Latency per model (p50, p95, p99)
- [ ] Success rate per model
- [ ] Error rate and types per model
- [ ] Quality signals (ranking consistency, user feedback)
- [ ] Model availability/uptime
- [ ] Rate limit hit frequency per model
- [ ] Comparison metrics across models
```

### 4. Prompt Engineering Quality
```
Check for:
- [ ] Ranking prompt effectiveness (Stage 2)
  - Does regex parsing handle all formats?
  - What's the parsing failure rate?
- [ ] Synthesis prompt structure (Stage 3)
  - Fixed format (Executive Summary, TOC, etc.) appropriate for all domains?
- [ ] System prompt consistency across models
- [ ] Context injection order (company → role → department → project)
- [ ] Prompt versioning and A/B testing capability
- [ ] Token efficiency of prompts (minimal redundancy)
```

**Ranking Parser Review:**
```python
# council.py lines 662-680
# Check regex pattern for "FINAL RANKING:" extraction
# Verify fallback handling for malformed rankings
```

### 5. Circuit Breaker & Reliability
```
Check for:
- [ ] Circuit breaker configuration (failure threshold, reset timeout)
- [ ] State transitions (CLOSED → OPEN → HALF_OPEN)
- [ ] Monitoring of circuit breaker trips
- [ ] Fallback behavior when circuit is open
- [ ] Per-model vs global circuit breaker
- [ ] Recovery testing after failures
- [ ] Exponential backoff implementation
```

**Files to Review:**
- `backend/openrouter.py` - Circuit breaker implementation
- Circuit breaker state: failure_count, last_failure_time, state

### 6. Rate Limiting & Throttling
```
Check for:
- [ ] OpenRouter rate limit handling
- [ ] Per-model rate limit awareness
- [ ] Retry strategy on 429 responses
- [ ] Backoff timing (current: exponential)
- [ ] Queue management for burst traffic
- [ ] Rate limit visibility in logs/metrics
- [ ] Graceful degradation under limits
```

### 7. Streaming Reliability
```
Check for:
- [ ] Stream interruption handling
- [ ] Partial response recovery
- [ ] Stagger timing effectiveness (0.8s Stage 1, 2s Stage 2)
- [ ] Memory management for concurrent streams
- [ ] Client disconnection handling
- [ ] Stream timeout configuration
- [ ] Error propagation to client
```

### 8. Model Selection & Fallback
```
Check for:
- [ ] Chairman model fallback chain
- [ ] Criteria for model selection (cost, quality, speed)
- [ ] Dynamic model selection based on query type
- [ ] Model deprecation handling
- [ ] New model integration process
- [ ] A/B testing framework for models
- [ ] Cost-aware model routing
```

### 9. Context Management
```
Check for:
- [ ] Context injection order and priority
- [ ] Truncation strategy (truncate_to_limit function)
- [ ] Important information preservation during truncation
- [ ] Multi-document context handling
- [ ] Playbook and decision auto-injection
- [ ] Context window warnings/limits
- [ ] Context caching for repeated queries
```

### 10. Prompt Caching
```
Check for:
- [ ] ENABLE_PROMPT_CACHING flag usage
- [ ] Cache key generation strategy
- [ ] Cache invalidation rules
- [ ] Cache hit rate tracking
- [ ] Cost savings from caching
- [ ] Cache storage (Anthropic prompt caching vs custom)
```

### 11. Triage Analysis
```
Check for:
- [ ] Constraint extraction accuracy (WHO/GOAL/BUDGET/RISK)
- [ ] Triage timeout handling (30s default)
- [ ] Failure graceful degradation (proceed with original query)
- [ ] Multi-question support
- [ ] Triage result usage in prompts
- [ ] Quality impact of triage
```

### 12. Quality Assurance
```
Check for:
- [ ] Ranking aggregation algorithm (position averaging)
- [ ] Consensus detection (high agreement = strong signal)
- [ ] Knowledge gap detection ([GAP:...] format)
- [ ] Output format validation
- [ ] Hallucination detection mechanisms
- [ ] User feedback integration
- [ ] Quality regression monitoring
```

## Cost Analysis Framework

### Per-Query Cost Estimation
```
Stage 1 (5 models parallel):
- Input: system_prompt + context + query
- Output: ~500-2000 tokens per model
- Cost: Σ(input_tokens × input_price + output_tokens × output_price) for each model

Stage 2 (5 models ranking):
- Input: ranking_prompt + 5 anonymized responses
- Output: ~200 tokens per model
- Cost: Similar calculation

Stage 3 (1-3 chairman attempts):
- Input: synthesis_prompt + ranked responses
- Output: ~1000-3000 tokens
- Cost: Single model pricing

Total: Stage1 + Stage2 + Stage3
```

### Model Pricing Reference
```
Check current pricing for:
- Claude Opus 4.5 (expensive, high quality)
- GPT-5.1 (mid-tier)
- Gemini 3 Pro (competitive)
- Grok 4 (mid-tier)
- DeepSeek (budget option)
```

## Output Format

### LLM Operations Score: [1-10]
### Cost Visibility Score: [1-10]

### Critical Issues
| Area | Issue | Cost Impact | Reliability Impact | Fix |
|------|-------|-------------|-------------------|-----|

### Cost Optimization Opportunities
| Opportunity | Current Cost | Optimized Cost | Savings | Effort |
|-------------|--------------|----------------|---------|--------|

### Reliability Gaps
| Component | Issue | Failure Scenario | Mitigation |
|-----------|-------|------------------|------------|

### Prompt Engineering Issues
| Prompt | Issue | Quality Impact | Recommendation |
|--------|-------|----------------|----------------|

### Missing Metrics
| Metric | Why Needed | Implementation Effort |
|--------|------------|----------------------|

### Model Performance Comparison
| Model | Avg Latency | Success Rate | Cost/Query | Quality Score |
|-------|-------------|--------------|------------|---------------|

### Recommendations Priority
1. **Immediate** (Cost bleeding or reliability risk)
2. **Short-term** (Visibility and monitoring)
3. **Long-term** (Optimization and quality)

---

Remember: Every unnecessary token is money burned. Every failed request is a user frustrated. Optimize ruthlessly.
