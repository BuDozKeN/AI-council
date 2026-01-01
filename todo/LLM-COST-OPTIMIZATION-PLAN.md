# LLM Cost Optimization Implementation Plan

## AxCouncil - 65-75% Cost Reduction Strategy

**Created:** 2026-01-02
**Based on:** Council Deliberation Analysis
**Target:** Reduce from ~$13.75k to ~$4-4.5k/month at 10k deliberations

---

## Implementation Status

| Phase | Status | Savings/Month | Cumulative |
|-------|--------|---------------|------------|
| **Phase 1:** Utility Model Optimization | COMPLETE | ~$150-180 | $150-180 |
| **Phase 2:** Stage 2 Peer Review Reset | COMPLETE | ~$7,000-8,000 | $7,150-8,180 |
| **Phase 3:** Prompt Caching | COMPLETE | ~$1,500-2,000 | $8,650-10,180 |
| **Phase 4:** Dynamic Council Sizing | PENDING | ~$500-1,000 | $9,150-11,180 |
| **Phase 5:** Advanced Optimizations | FUTURE | TBD | TBD |

---

## Phase 1: Utility Model Optimization

**Effort:** ~2 hours | **Risk:** Very Low | **Savings:** ~$150-180/month

### Changes Required

| Role | Current Model | New Model | Price Change |
|------|---------------|-----------|--------------|
| `ai_polish` | Gemini 3 Pro ($2/$12) | Gemini 2.5 Flash ($0.15/$0.60) | -95% |
| `sop_writer` | GPT-4o ($2.50/$10) | GPT-4o-mini ($0.15/$0.60) | -94% |
| `framework_author` | GPT-4o ($2.50/$10) | GPT-4o-mini ($0.15/$0.60) | -94% |
| `policy_writer` | GPT-4o ($2.50/$10) | GPT-4o-mini ($0.15/$0.60) | -94% |

### Implementation Checklist

- [x] Update `FALLBACK_MODELS` in `backend/model_registry.py`
- [x] Create SQL migration for Supabase `model_registry` table
- [ ] Run migration in production (deploy or manual SQL)
- [ ] Verify changes in production after deployment

### Files Modified
- `backend/model_registry.py` - Updated fallback model lists
- `supabase/migrations/20260102000000_cost_optimization_phase1.sql` - Database migration

---

## Phase 2: Stage 2 Peer Review Reset

**Effort:** ~4-6 hours | **Risk:** Low-Medium | **Savings:** ~$7,000-8,000/month

### Problem
Stage 2 uses same 5 premium models as Stage 1 (~$2-12/M tokens each) = 61% of total cost

### Solution
New dedicated Stage 2 reviewer lineup (3 cheap, diverse models):

| Priority | Model | Price (Input/Output) | Strengths |
|----------|-------|---------------------|-----------|
| 0 | `x-ai/grok-4-fast` | $0.20/$0.50 | Very cheap, huge context |
| 1 | `deepseek/deepseek-chat-v3-0324` | $0.28/$0.42 | Strong reasoning |
| 2 | `openai/gpt-4o-mini` | $0.15/$0.60 | Diverse architecture |

### Implementation Checklist

- [x] Add `stage2_reviewer` role to `FALLBACK_MODELS` in `backend/model_registry.py`
- [x] Create SQL migration for `stage2_reviewer` entries in Supabase
- [x] Modify `stage2_stream_rankings()` in `backend/council.py` to use separate model list
- [x] Modify `stage2_collect_rankings()` for consistency
- [ ] Run SQL migration in production
- [ ] Test quality with new reviewer lineup
- [ ] Deploy and monitor

### Files Modified
- `backend/model_registry.py` - Added stage2_reviewer fallbacks
- `backend/council.py` - Uses STAGE2_MODELS instead of COUNCIL_MODELS for Stage 2
- `supabase/migrations/20260102000001_cost_optimization_phase2.sql` - New model entries

---

## Phase 3: Enable Prompt Caching

**Effort:** ~3-4 hours | **Risk:** Low | **Savings:** ~$1,500-2,000/month

### Current State
- Infrastructure exists in `openrouter.py:372-443`
- Disabled via `ENABLE_PROMPT_CACHING=false`
- Gemini excluded due to documented issues

### Implementation Checklist

- [x] Expand `CACHE_SUPPORTED_MODELS` in `backend/config.py`:
  - Add `deepseek/deepseek-chat`
  - Add `openai/gpt-5.1`
  - Add `openai/gpt-4o`
- [x] Set `ENABLE_PROMPT_CACHING=true` as default (env var override still available)
- [ ] Restructure prompts in `context_loader.py` for cacheability (static prefix, dynamic suffix) - OPTIONAL
- [ ] Monitor cache hit rates

### Files Modified
- `backend/config.py` - Expanded cache-supported models list, enabled caching by default

### Notes
- Caching is now enabled by default but can be disabled via `ENABLE_PROMPT_CACHING=false` in .env
- Gemini models intentionally excluded (causes hallucinations per documented issues)
- Grok/xAI models intentionally excluded (have automatic implicit caching, no cache_control needed)
- OpenAI, Anthropic, and DeepSeek models use explicit cache_control via OpenRouter
- Model IDs use substring matching (e.g., `anthropic/claude-3-5-sonnet` matches `claude-3-5-sonnet-20241022`)
- UI toggle available: Settings → Developer → Prompt Caching

---

## Phase 4: Dynamic Council Sizing

**Effort:** ~8-12 hours | **Risk:** Medium | **Savings:** ~$500-1,000/month

### Implementation Checklist

- [ ] Extend `triage.py` with complexity/stakes classification
- [ ] Add `get_council_config()` function to `council.py`
- [ ] Implement routing logic:
  - Low-stakes + trivial = 3 models, skip Stage 2
  - Normal = 5 models Stage 1, 3 reviewers Stage 2
  - High-stakes/complex = full council
- [ ] Add "Request full council review" UI option
- [ ] Track routing decisions in usage data
- [ ] A/B test and monitor quality

### Files to Modify
- `backend/triage.py` - Add routing classification
- `backend/council.py` - Add council config logic
- `backend/routers/conversations.py` - Integrate routing

---

## Phase 5: Advanced Optimizations (Month 2+)

### Future Opportunities

- [ ] Response compression before Stage 2 (LLMLingua or similar)
- [ ] Batching low-priority Stage 2 reviews
- [ ] Distilled "AxCouncil" expert model training
- [ ] Semantic similarity for unanimous detection

---

## Monitoring & Rollback

### KPIs to Track
- User satisfaction (thumbs up/down)
- Manual QA scores (target >=4.2/5)
- Re-ask/clarification rate
- Stage 2 disagreement rate
- Cache hit rate (target >=40%)
- Cost per deliberation (target <=$0.45)

### Rollback Triggers
- User satisfaction drop >10%
- Error rate increase >5%
- QA scores <4.0/5 for 2 weeks

### Rollback Process
1. Revert `model_registry` database entries
2. Git revert code changes
3. Set `ENABLE_PROMPT_CACHING=false`

---

## Key Files Reference

| Component | File | Purpose |
|-----------|------|---------|
| Model Registry | `backend/model_registry.py` | Model fallbacks and DB lookup |
| Council Pipeline | `backend/council.py` | 3-stage orchestration |
| OpenRouter Client | `backend/openrouter.py` | API calls, caching |
| Context Building | `backend/context_loader.py` | Prompt construction |
| Config | `backend/config.py` | Feature flags |
| Triage | `backend/triage.py` | Query classification |
| DB Schema | `supabase/migrations/20251220000000_model_registry.sql` | Model registry table |

---

## Changelog

### 2026-01-02
- **Phase 1 COMPLETE**: Updated utility model fallbacks in `model_registry.py`
  - `ai_polish`: Gemini 3 Pro -> Gemini 2.5 Flash
  - `sop_writer`, `framework_author`, `policy_writer`: GPT-4o -> GPT-4o-mini
- Created SQL migration `20260102000000_cost_optimization_phase1.sql`
- **Phase 1 SQL DEPLOYED** to production

- **Phase 2 COMPLETE**: Separated Stage 2 from Stage 1 models
  - Added `stage2_reviewer` role with 3 cheap models:
    - Grok 4 Fast ($0.20/$0.50) - primary
    - DeepSeek V3 ($0.28/$0.42)
    - GPT-4o-mini ($0.15/$0.60)
  - Modified `council.py` to use dedicated Stage 2 models
  - Created SQL migration `20260102000001_cost_optimization_phase2.sql`
- **Phase 2 SQL DEPLOYED** to production

- **Phase 3 COMPLETE**: Enabled prompt caching
  - Expanded `CACHE_SUPPORTED_MODELS` in `config.py` using substring patterns:
    - Anthropic: claude-opus-4, claude-sonnet-4, claude-3-5-sonnet, claude-3-5-haiku
    - OpenAI: gpt-5, gpt-4o
    - DeepSeek: deepseek-chat
  - Changed default `ENABLE_PROMPT_CACHING` from "false" to "true"
  - Gemini excluded (documented issues with explicit cache_control)
  - Grok/xAI excluded (automatic implicit caching, no cache_control needed)
  - Updated UI description: "Claude, GPT & DeepSeek" (was "Claude & Gemini")
  - QC: Fixed model ID mismatch (claude-3.5 → claude-3-5 for substring matching)
- No SQL migration needed (code-only change)

- **ALL PHASES 1-3 DEPLOYED**
  - Commit: `7d4b1a0` - feat: LLM cost optimization phases 1-3
  - Pushed to master (Vercel auto-deploy triggered)
  - Render: Deploy manually via dashboard (hook expired)

---

*Last Updated: 2026-01-02*
