# LLM Operations & Economics Audit Report

## AxCouncil - Multi-Model AI Council Platform

**Date:** 2026-01-01
**Auditor:** Claude Opus 4.5

---

## Executive Summary

AxCouncil implements a sophisticated 3-stage LLM deliberation pipeline with **strong cost tracking** and **excellent reliability patterns**, but lacks **observability metrics** for model performance optimization. The codebase demonstrates mature engineering practices with per-model circuit breakers, detailed usage tracking, and budget alerting. Key gaps exist in latency monitoring, quality feedback loops, and cost-aware model routing.

---

### LLM Operations Score: 7/10
### Cost Visibility Score: 8/10

---

## Critical Issues

| Area | Issue | Cost Impact | Reliability Impact | Fix |
|------|-------|-------------|-------------------|-----|
| Metrics | No latency tracking per model | High - can't identify slow models | Medium | Add timing instrumentation around `query_model_stream()` |
| Metrics | No success rate tracking | High - can't optimize model selection | High | Track success/failure counts per model in database |
| Routing | No cost-aware model routing | High - expensive models used for simple queries | Low | Add query complexity classifier, route to cheaper models |
| Quality | No hallucination detection | Medium - bad advice possible | High | Add fact-checking step or confidence scoring |

---

## Cost Optimization Opportunities

| Opportunity | Current Cost | Optimized Cost | Savings | Effort |
|-------------|--------------|----------------|---------|--------|
| Route simple queries to Gemini Flash | ~$0.15/query | ~$0.02/query | 85% | Medium |
| Enable prompt caching for Anthropic | $5/1M input | $2.50/1M (50% cache) | 50% | Low (already built, just enable) |
| Use DeepSeek for Stage 2 rankings | ~$0.03/ranking | ~$0.01/ranking | 66% | Low |
| Skip Stage 2 for high-consensus queries | Full 3-stage | Skip 20% of Stage 2 | 15% | Medium |
| Truncate Stage 1 responses before Stage 2 | Full responses | First 500 tokens | 40% on Stage 2 input | Low |

**Estimated Per-Query Cost: ~$0.23**

---

## Recommendations Priority

### 1. IMMEDIATE (Cost bleeding or reliability risk)

- [ ] **Add model latency/success metrics** - Add timing and success counters in `backend/openrouter.py`
- [ ] **Enable prompt caching** - Set `ENABLE_PROMPT_CACHING=true` in production `.env`
- [ ] **Add ranking parse failure alerting** - Track in `parse_ranking_from_text()`

### 2. SHORT-TERM (Visibility and monitoring)

- [ ] **Expose cache hit rate in dashboard** - Data already in `session_usage.cache_read_tokens`
- [ ] **Add cost breakdown by stage** - Modify `save_session_usage()` to include stage costs
- [ ] **Create model health dashboard** - New endpoint `/api/admin/model-health`

### 3. LONG-TERM (Optimization and quality)

- [ ] **Cost-aware model routing** - Add query complexity classifier
- [ ] **A/B testing framework** - Track prompt versions, measure quality impact
- [ ] **User feedback loop** - Add thumbs up/down on responses
- [ ] **Hallucination detection** - Add fact-checking step for critical domains

---

## Audit Results Summary

| Category | Score | Status |
|----------|-------|--------|
| Token Cost Tracking | 9/10 | EXCELLENT |
| Token Estimation Accuracy | 6/10 | ADEQUATE |
| Model Performance Tracking | 2/10 | CRITICAL GAP |
| Prompt Engineering Quality | 7/10 | GOOD |
| Circuit Breaker & Reliability | 9/10 | EXCELLENT |
| Rate Limiting & Throttling | 9/10 | EXCELLENT |
| Streaming Reliability | 7/10 | GOOD |
| Model Selection & Fallback | 7/10 | GOOD |
| Context Management | 8/10 | GOOD |
| Prompt Caching | 5/10 | PARTIAL |
| Triage Analysis | 8/10 | GOOD |
| Quality Assurance | 4/10 | MODERATE |

---

## Missing Metrics (Priority Implementation)

| Metric | Why Needed | Effort |
|--------|------------|--------|
| Model latency (p50/p95/p99) | Identify slow models | Low |
| Model success rate | Track reliability | Low |
| Ranking parse success rate | Quality gate for Stage 2 | Low |
| Cache hit rate (visible) | Validate caching | Low |
| Cost per council type | Identify expensive use cases | Medium |
| User feedback score | Quality signal | High |

---

## Key Files Referenced

- `backend/council.py` - Main 3-stage orchestration
- `backend/openrouter.py` - API calls, circuit breaker, retry logic
- `backend/model_registry.py` - Model configuration
- `backend/routers/company/utils.py` - MODEL_PRICING, usage tracking
- `backend/routers/company/llm_ops.py` - LLM ops dashboard endpoint
- `backend/context_loader.py` - Context management, truncation
- `backend/triage.py` - Pre-council question analysis
- `backend/config.py` - ENABLE_PROMPT_CACHING, model lists

---

## Quick Wins (< 1 day each)

1. Set `ENABLE_PROMPT_CACHING=true` in `.env` (instant 50% savings on Anthropic)
2. Add `start_time = time.time()` timing around API calls
3. Log ranking parse failures with model name
4. Add cache_hit_rate to LLM ops dashboard response

---

*Full audit report with detailed findings available in conversation history.*
