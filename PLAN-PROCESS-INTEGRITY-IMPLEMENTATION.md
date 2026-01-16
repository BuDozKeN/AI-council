# Process Integrity Implementation Plan

> **Status**: Planning (Not Started)
> **Priority**: High (Foundation for fast, confident shipping)
> **Estimated Effort**: 4 weeks (1 hour/day, ~20 hours total)
> **Target Score**: 8.0/10 minimum for enterprise-grade

---

## Executive Summary

This plan implements **enterprise-grade process integrity** for AxCouncil, enabling:
- ✅ **Fast debugging**: Fix production issues in 2 minutes (currently 30+ min)
- ✅ **Confident shipping**: Contract tests catch breakage before deploy
- ✅ **Proactive alerting**: Know about failures before users do
- ✅ **Zero production surprises**: Health checks + metrics + traces

**Why now?**
- Approaching $25M investment readiness
- Need operational maturity for enterprise buyers
- Current process tracking is minimal (logs only)
- Production incidents take too long to debug

**The Stack (All Free Tier):**
- OpenTelemetry + Honeycomb (tracing)
- Sentry (errors + performance) - already installed
- pytest (contract tests)
- BetterUptime (synthetic monitoring)

**Total Cost**: $0/month
**Setup Time**: ~20 hours over 4 weeks
**Maintenance**: ~1 hour/month

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Target State](#2-target-state)
3. [Critical Processes to Track](#3-critical-processes-to-track)
4. [Implementation Phases](#4-implementation-phases)
5. [Phase 1: Observability Foundation](#phase-1-observability-foundation)
6. [Phase 2: Contract Testing](#phase-2-contract-testing)
7. [Phase 3: Health Checks & Monitoring](#phase-3-health-checks--monitoring)
8. [Phase 4: Process Registry & Documentation](#phase-4-process-registry--documentation)
9. [Testing Strategy](#testing-strategy)
10. [Rollout Plan](#rollout-plan)
11. [Success Metrics](#success-metrics)
12. [Cost-Benefit Analysis](#cost-benefit-analysis)

---

## 1. Current State Assessment

### Existing Infrastructure (✅ Good Foundation)

| Component | Status | Notes |
|-----------|--------|-------|
| **Sentry** | ✅ Installed | Error tracking active |
| **Logging** | ✅ Basic | Python `logging` module used |
| **CI Pipeline** | ✅ Active | GitHub Actions with tests |
| **Test Coverage** | ✅ 70%+ | Backend 70%, Frontend decent |
| **Health Endpoint** | ✅ Basic | `/health` returns 200 |

### Gaps (❌ What's Missing)

| Component | Status | Impact |
|-----------|--------|--------|
| **Distributed Tracing** | ❌ None | Can't debug across stages |
| **Contract Tests** | ❌ None | No end-to-end process validation |
| **Synthetic Monitoring** | ❌ None | Learn about failures from users |
| **Process Registry** | ❌ None | No central process documentation |
| **Performance Metrics** | ⚠️ Partial | Sentry has it, not fully used |
| **Rich Error Context** | ⚠️ Minimal | Errors lack business context |

**Current Process Integrity Score: ~3.5/10** (Estimated)
- Observability: 5/20 (basic logging only)
- Error Tracking: 10/20 (Sentry installed but minimal context)
- Contract Testing: 0/30 (doesn't exist)
- Health Checks: 3/15 (basic endpoint only)
- Metrics: 3/10 (not actively monitored)
- Registry: 0/5 (doesn't exist)

---

## 2. Target State

**Target Process Integrity Score: 8.5/10**

### What Success Looks Like (4 Weeks from Now)

**Developer Experience:**
- ✅ New developer runs contract tests → validates setup works
- ✅ Make code change → CI runs contract tests → catches breakage instantly
- ✅ Deploy with confidence → health checks validate process works
- ✅ Production issue → Honeycomb trace → debug in 2 minutes

**Operational Excellence:**
- ✅ Health checks alert BEFORE user reports issue
- ✅ Every council execution traced with full context
- ✅ Can answer: "What happened for Company X at 2:43 PM yesterday?"
- ✅ Performance regressions detected automatically

**Business Value:**
- ✅ Faster incident response (30 min → 2 min = 93% reduction)
- ✅ Fewer production bugs (contract tests catch in CI)
- ✅ Confident deployments (ship multiple times per day)
- ✅ Enterprise-ready operational maturity

---

## 3. Critical Processes to Track

### Process Priority Matrix

| Process | Priority | Complexity | User Impact | Implementation Order |
|---------|----------|------------|-------------|---------------------|
| **council_deliberation_3stage** | CRITICAL | High | High | 1 (Week 1) |
| **user_authentication** | CRITICAL | Medium | High | 2 (Week 2) |
| **company_context_load** | HIGH | Medium | Medium | 3 (Week 2) |
| **payment_subscription** | CRITICAL | High | High | 4 (Week 3) |
| **knowledge_entry_save** | MEDIUM | Low | Low | 5 (Week 3) |
| **department_delete** | MEDIUM | Medium | Low | 6 (Week 4) |
| **conversation_delete** | LOW | Low | Low | 7 (Week 4) |

### Process Definitions

#### 1. council_deliberation_3stage (CRITICAL)

**What it does**: 3-stage AI council pipeline
- Stage 1: 5 models respond in parallel
- Stage 2: Peer review and ranking
- Stage 3: Chairman synthesis

**SLA**: <120 seconds end-to-end

**Why critical**: Core product feature, user-facing, 90% of usage

**Current state**:
- ✅ Implemented in `backend/council.py`
- ⚠️ Basic error logging
- ❌ No distributed tracing
- ❌ No contract tests
- ❌ No health checks

**Target state**:
- ✅ Full OpenTelemetry tracing (each stage)
- ✅ Rich error context (company_id, query, stage)
- ✅ Contract tests validate 3-stage flow
- ✅ Health endpoint: `/health/council`
- ✅ Performance metrics (P50, P95, P99)
- ✅ Alerts on timeout/failure

---

#### 2. user_authentication (CRITICAL)

**What it does**: JWT-based authentication
- Login flow
- Token validation
- Session management

**SLA**: <2 seconds

**Why critical**: Security, all features depend on it

**Current state**:
- ✅ Implemented with Supabase Auth
- ✅ Basic error handling
- ❌ No tracing
- ❌ No contract tests

**Target state**:
- ✅ OpenTelemetry tracing
- ✅ Contract tests (login, token refresh, logout)
- ✅ Health endpoint: `/health/auth`
- ✅ Alerts on auth failures spike

---

#### 3. company_context_load (HIGH)

**What it does**: Aggregates context from multiple sources
- Company context
- Department context
- Role system prompts
- Playbooks (auto-inject)
- Decisions (auto-inject)

**SLA**: <5 seconds

**Why high**: Impacts council quality, complex logic

**Current state**:
- ✅ Implemented in `backend/context_loader.py`
- ⚠️ Some error handling
- ❌ No tracing for sub-steps
- ❌ No contract tests

**Target state**:
- ✅ OpenTelemetry tracing (show context injection order)
- ✅ Contract tests validate injection order
- ✅ Performance metrics

---

#### 4. payment_subscription (CRITICAL)

**What it does**: Stripe integration for billing
- Subscription creation
- Payment processing
- Invoice generation
- Webhook handling

**SLA**: <10 seconds

**Why critical**: Revenue, compliance, user trust

**Current state**:
- ✅ Implemented in `backend/routers/billing.py`
- ⚠️ Basic Stripe error handling
- ❌ No comprehensive tracing
- ❌ No contract tests

**Target state**:
- ✅ Full tracing (subscription flow)
- ✅ Contract tests (subscribe, cancel, webhook)
- ✅ Health endpoint: `/health/billing`
- ✅ Alerts on payment failures

---

## 4. Implementation Phases

### Phase Overview

| Phase | Focus | Duration | Effort | Deliverables |
|-------|-------|----------|--------|--------------|
| **1** | Observability Foundation | Week 1 | 5 hours | OpenTelemetry + Honeycomb setup |
| **2** | Contract Testing | Week 2 | 6 hours | Contract tests for top 3 processes |
| **3** | Health Checks & Monitoring | Week 3 | 4 hours | Health endpoints + BetterUptime |
| **4** | Process Registry & Docs | Week 4 | 5 hours | Registry + documentation |

**Total**: 4 weeks, ~20 hours

---

## Phase 1: Observability Foundation

**Goal**: Add OpenTelemetry tracing to critical processes

**Duration**: Week 1 (5 hours)

### 1.1 Install OpenTelemetry

**Files to modify**: `requirements.txt`, `pyproject.toml`

**Add dependencies**:
```toml
# pyproject.toml
[project]
dependencies = [
    # ... existing
    "opentelemetry-api>=1.20.0",
    "opentelemetry-sdk>=1.20.0",
    "opentelemetry-instrumentation-fastapi>=0.41b0",
    "opentelemetry-exporter-otlp>=1.20.0",
]
```

**Install**:
```bash
pip install -e ".[dev]"
```

**Time**: 15 minutes

---

### 1.2 Setup OpenTelemetry Provider

**File to create**: `backend/instrumentation.py`

```python
"""
OpenTelemetry instrumentation for AxCouncil.

This module sets up distributed tracing for all critical processes.
Traces are sent to Honeycomb for visualization and debugging.
"""

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
import os

def setup_tracing(app):
    """
    Initialize OpenTelemetry tracing for the FastAPI app.

    Sends traces to Honeycomb (or any OTLP-compatible backend).

    Usage:
        from backend.instrumentation import setup_tracing
        app = FastAPI()
        setup_tracing(app)
    """

    # Resource identifies this service in traces
    resource = Resource.create({
        "service.name": "axcouncil-backend",
        "service.version": "2.1.0",
        "deployment.environment": os.getenv("ENVIRONMENT", "production"),
    })

    # Tracer provider
    tracer_provider = TracerProvider(resource=resource)

    # Exporter (sends to Honeycomb)
    otlp_exporter = OTLPSpanExporter(
        endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "https://api.honeycomb.io"),
        headers={
            "x-honeycomb-team": os.getenv("HONEYCOMB_API_KEY", ""),
        }
    )

    # Batch processor (efficient batching)
    span_processor = BatchSpanProcessor(otlp_exporter)
    tracer_provider.add_span_processor(span_processor)

    # Set global tracer provider
    trace.set_tracer_provider(tracer_provider)

    # Auto-instrument FastAPI
    FastAPIInstrumentor.instrument_app(app)

    print("✅ OpenTelemetry tracing initialized")

# Tracer for manual instrumentation
tracer = trace.get_tracer(__name__)
```

**File to modify**: `backend/main.py`

```python
# Add at top
from backend.instrumentation import setup_tracing

# After app creation
app = FastAPI(...)

# Setup tracing
if os.getenv("ENABLE_TRACING", "true").lower() == "true":
    setup_tracing(app)
```

**Environment variables** (add to `.env`):
```env
# OpenTelemetry / Honeycomb
ENABLE_TRACING=true
HONEYCOMB_API_KEY=your_honeycomb_api_key
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
```

**Sign up for Honeycomb** (free tier):
1. Go to https://honeycomb.io
2. Sign up (free 20GB/month)
3. Create API key
4. Add to `.env`

**Time**: 1 hour

---

### 1.3 Instrument Council Deliberation

**File to modify**: `backend/council.py`

**Add tracing to 3-stage pipeline**:

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

async def run_council_deliberation(
    query: str,
    company_id: str,
    conversation_id: str,
    user_id: str,
    **kwargs
):
    """
    Run 3-stage council deliberation with full distributed tracing.
    """

    # Start main process span
    with tracer.start_as_current_span("council.3stage") as span:
        # Add business context to trace
        span.set_attribute("process.id", "council_3stage")
        span.set_attribute("process.version", "2.1.0")
        span.set_attribute("company_id", company_id)
        span.set_attribute("user_id", user_id)
        span.set_attribute("conversation_id", conversation_id)
        span.set_attribute("query_length", len(query))

        try:
            # Stage 1: Individual Responses
            with tracer.start_as_current_span("council.stage1") as stage1_span:
                stage1_span.set_attribute("stage", 1)
                stage1_span.set_attribute("description", "parallel_model_responses")

                stage1_results = await run_stage1_parallel(query, company_id, **kwargs)

                stage1_span.set_attribute("model_count", len(stage1_results))
                stage1_span.set_attribute("success", True)

            # Stage 2: Peer Review & Ranking
            with tracer.start_as_current_span("council.stage2") as stage2_span:
                stage2_span.set_attribute("stage", 2)
                stage2_span.set_attribute("description", "peer_review_ranking")

                stage2_rankings = await run_stage2_ranking(stage1_results, **kwargs)

                stage2_span.set_attribute("rankings_generated", len(stage2_rankings))
                stage2_span.set_attribute("success", True)

            # Stage 3: Chairman Synthesis
            with tracer.start_as_current_span("council.stage3") as stage3_span:
                stage3_span.set_attribute("stage", 3)
                stage3_span.set_attribute("description", "chairman_synthesis")

                final_answer = await run_stage3_synthesis(
                    stage1_results,
                    stage2_rankings,
                    **kwargs
                )

                stage3_span.set_attribute("answer_length", len(final_answer))
                stage3_span.set_attribute("success", True)

            # Mark process successful
            span.set_attribute("process.status", "completed")
            span.set_attribute("process.success", True)

            return {
                "final_answer": final_answer,
                "stage1_responses": stage1_results,
                "stage2_rankings": stage2_rankings,
                "process_id": "council_3stage",
                "version": "2.1.0",
            }

        except asyncio.TimeoutError as e:
            # Timeout error
            span.set_attribute("process.status", "timeout")
            span.set_attribute("process.success", False)
            span.record_exception(e)
            raise

        except Exception as e:
            # Other errors
            span.set_attribute("process.status", "failed")
            span.set_attribute("process.success", False)
            span.set_attribute("error.type", type(e).__name__)
            span.set_attribute("error.message", str(e))
            span.record_exception(e)
            raise
```

**Also instrument sub-functions**:

```python
async def run_stage1_parallel(query: str, company_id: str, **kwargs):
    """Stage 1: Run 5 models in parallel"""

    with tracer.start_as_current_span("stage1.load_context"):
        context = await load_company_context(company_id)

    with tracer.start_as_current_span("stage1.parallel_llm_calls") as span:
        span.set_attribute("model_count", len(COUNCIL_MODELS))

        tasks = [
            call_llm_model(model, query, context)
            for model in COUNCIL_MODELS
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Count successes/failures
        successes = [r for r in results if not isinstance(r, Exception)]
        failures = [r for r in results if isinstance(r, Exception)]

        span.set_attribute("successes", len(successes))
        span.set_attribute("failures", len(failures))

        return successes
```

**Time**: 2 hours

---

### 1.4 Enhance Sentry Error Context

**File to modify**: `backend/council.py`

**Add rich context to all errors**:

```python
import sentry_sdk

async def run_council_deliberation(query: str, company_id: str, **kwargs):
    # Configure Sentry scope with business context
    with sentry_sdk.configure_scope() as scope:
        scope.set_context("council", {
            "process_id": "council_3stage",
            "version": "2.1.0",
            "query": query[:200],  # First 200 chars
            "company_id": company_id,
            "conversation_id": kwargs.get("conversation_id"),
            "user_id": kwargs.get("user_id"),
        })

        scope.set_tag("process", "council_3stage")
        scope.set_tag("company_id", company_id)

        try:
            return await _run_council_internal(query, company_id, **kwargs)
        except Exception as e:
            # Sentry automatically captures with full context
            sentry_sdk.capture_exception(e)
            raise
```

**Time**: 30 minutes

---

### 1.5 Test & Validate

**Checklist**:
- [ ] Run backend locally
- [ ] Execute council deliberation
- [ ] Check Honeycomb dashboard for traces
- [ ] Verify trace has all attributes (company_id, stage info, etc.)
- [ ] Trigger error → verify Sentry has rich context

**Time**: 1 hour

**Total Phase 1**: 5 hours

---

## Phase 2: Contract Testing

**Goal**: Write contract tests for critical processes

**Duration**: Week 2 (6 hours)

### 2.1 Create Contract Test Infrastructure

**File to create**: `tests/test_process_contracts.py`

```python
"""
Process Contract Tests - Validate critical business processes work end-to-end.

Contract tests define the expected behavior of processes. If these tests pass,
the processes work correctly in production.

These tests are MORE IMPORTANT than unit tests because they validate actual
business logic, not implementation details.
"""

import pytest
from backend.council import run_council_deliberation
from backend.auth import authenticate_user
from backend.context_loader import load_company_context

# === COUNCIL DELIBERATION CONTRACTS ===

class TestCouncilDeliberationContract:
    """Validates council 3-stage process contract"""

    @pytest.mark.asyncio
    async def test_happy_path_3stage_flow(self):
        """
        CONTRACT: Council deliberation must complete all 3 stages successfully.

        Given: A valid user query
        When: Running council deliberation
        Then: All 3 stages complete and return structured output
        """

        # Given
        query = "What is artificial intelligence?"
        company_id = "test-company-123"

        # When
        result = await run_council_deliberation(
            query=query,
            company_id=company_id,
            conversation_id="test-conv-123",
            user_id="test-user-123"
        )

        # Then - Process completed
        assert result is not None, "Process must return result"
        assert result.get("process_id") == "council_3stage"
        assert result.get("version") == "2.1.0"

        # Then - Stage 1 results
        assert "stage1_responses" in result, "Must include Stage 1 responses"
        assert len(result["stage1_responses"]) >= 3, "Must have 3+ model responses"
        assert all(
            isinstance(r, dict) and "content" in r
            for r in result["stage1_responses"]
        ), "Each Stage 1 response must be structured dict"

        # Then - Stage 2 rankings
        assert "stage2_rankings" in result, "Must include Stage 2 rankings"
        assert result["stage2_rankings"] is not None

        # Then - Stage 3 synthesis
        assert "final_answer" in result, "Must include final answer"
        assert len(result["final_answer"]) > 100, "Final answer must be substantive"

        # Then - Performance SLA
        # Note: We don't assert duration here because it depends on external APIs
        # But we log it for monitoring
        if "duration_ms" in result:
            print(f"Council duration: {result['duration_ms']}ms")

    @pytest.mark.asyncio
    async def test_handles_stage1_timeout_gracefully(self):
        """
        CONTRACT: If Stage 1 times out, process must return fallback response.

        Given: Stage 1 LLM calls timeout
        When: Running council deliberation
        Then: Process returns fallback response without crashing
        """

        # Given - Mock LLM timeout
        with mock_llm_timeout(stage=1):
            # When
            result = await run_council_deliberation(
                query="Test query",
                company_id="test-company",
                conversation_id="test-conv",
                user_id="test-user"
            )

            # Then
            assert result is not None, "Must return fallback on timeout"
            assert result.get("fallback_used") == True
            assert "error" in result
            assert "timeout" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_respects_context_injection_order(self):
        """
        CONTRACT: Context must be injected in correct order:
        Company → Department → Role → Playbooks → Decisions → Query

        Given: Company with department, playbooks, and decisions
        When: Running council
        Then: Context is injected in documented order
        """

        # Given
        company_id = create_test_company(context="Company: ACME Corp")
        dept_id = create_test_department(
            company_id,
            context="Department: Engineering"
        )
        create_test_playbook(company_id, auto_inject=True)
        create_test_decision(company_id, auto_inject=True)

        # When
        result = await run_council_deliberation(
            query="Test query",
            company_id=company_id,
            department_id=dept_id,
            conversation_id="test-conv",
            user_id="test-user"
        )

        # Then - Context order preserved
        assert "context_order" in result
        assert result["context_order"] == [
            "company_context",
            "department_context",
            "role_system_prompt",
            "playbooks",
            "decisions",
            "user_query"
        ]

    @pytest.mark.asyncio
    async def test_respects_sla_under_normal_conditions(self):
        """
        CONTRACT: Council must complete in <120s under normal conditions.

        This is a SOFT contract - we log violations but don't fail the test,
        because external API latency is unpredictable.
        """

        import time

        # When
        start = time.time()
        result = await run_council_deliberation(
            query="What is AI?",
            company_id="test-company",
            conversation_id="test-conv",
            user_id="test-user"
        )
        duration_sec = time.time() - start

        # Then - Log SLA compliance
        sla_seconds = 120
        if duration_sec > sla_seconds:
            print(f"⚠️ SLA VIOLATION: Council took {duration_sec:.1f}s (SLA: {sla_seconds}s)")
        else:
            print(f"✅ SLA MET: Council took {duration_sec:.1f}s (SLA: {sla_seconds}s)")

        # Always pass (soft contract)
        assert result is not None


# === AUTHENTICATION CONTRACTS ===

class TestAuthenticationContract:
    """Validates user authentication process contract"""

    @pytest.mark.asyncio
    async def test_login_flow_happy_path(self):
        """
        CONTRACT: Login with valid credentials returns JWT token.
        """

        # Given
        email = "test@example.com"
        password = "valid_password"

        # When
        result = await authenticate_user(email, password)

        # Then
        assert result is not None
        assert "access_token" in result
        assert "refresh_token" in result
        assert "user" in result
        assert result["user"]["email"] == email

    @pytest.mark.asyncio
    async def test_login_invalid_credentials_fails(self):
        """
        CONTRACT: Login with invalid credentials raises error.
        """

        with pytest.raises(Exception) as exc_info:
            await authenticate_user("test@example.com", "wrong_password")

        assert "invalid" in str(exc_info.value).lower()


# === CONTEXT LOADING CONTRACTS ===

class TestContextLoadingContract:
    """Validates company context loading process contract"""

    @pytest.mark.asyncio
    async def test_context_aggregation_order(self):
        """
        CONTRACT: Context is aggregated in documented order.
        """

        # Given
        company_id = create_test_company(context="Company context")
        dept_id = create_test_department(company_id, context="Dept context")

        # When
        context = await load_company_context(
            company_id=company_id,
            department_id=dept_id
        )

        # Then
        assert "company" in context
        assert "department" in context
        assert context["company"] == "Company context"
        assert context["department"] == "Dept context"
```

**Time**: 3 hours

---

### 2.2 Add Contract Tests to CI

**File to modify**: `.github/workflows/ci.yml`

```yaml
jobs:
  backend-tests:
    # ... existing setup ...

    - name: Run Unit Tests
      run: |
        pytest tests/ -v --cov=backend --cov-report=term-missing

    # NEW: Run contract tests separately for visibility
    - name: Run Process Contract Tests
      run: |
        pytest tests/test_process_contracts.py -v --tb=short
      continue-on-error: false  # Block merge on failure
```

**Time**: 30 minutes

---

### 2.3 Test & Validate

**Checklist**:
- [ ] Run contract tests locally: `pytest tests/test_process_contracts.py -v`
- [ ] All tests pass
- [ ] Push to GitHub → CI runs tests
- [ ] CI passes

**Time**: 30 minutes

---

### 2.4 Expand Coverage (Ongoing)

Add contract tests for:
- [ ] Payment/subscription flow
- [ ] Department delete
- [ ] Knowledge entry save

**Time**: 2 hours

**Total Phase 2**: 6 hours

---

## Phase 3: Health Checks & Monitoring

**Goal**: Add health endpoints and synthetic monitoring

**Duration**: Week 3 (4 hours)

### 3.1 Create Health Endpoints

**File to create**: `backend/routers/health.py`

```python
"""
Health check endpoints for synthetic monitoring.

These endpoints validate that critical processes work, not just that
the server is responding. Used by BetterUptime, Pingdom, etc.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
import time

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/")
async def health_basic():
    """Basic health check - server is responding"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "axcouncil-backend",
        "version": "2.1.0"
    }

@router.get("/council")
async def health_council():
    """
    Validates council deliberation process is working.

    Runs minimal council execution with synthetic query.
    Fails if process doesn't complete or takes too long.
    """

    try:
        start = time.time()

        # Run minimal council execution
        result = await run_council_deliberation(
            query="Health check - is the system working?",
            company_id="system-health-check",
            conversation_id="health-check",
            user_id="system",
            timeout=30  # Fast timeout for health check
        )

        duration_ms = (time.time() - start) * 1000

        # Validate result structure
        if not result or "final_answer" not in result:
            raise ValueError("Council returned invalid structure")

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "process_id": "council_3stage",
            "latency_ms": round(duration_ms, 2),
            "checks": {
                "stage1": "pass",
                "stage2": "pass",
                "stage3": "pass",
                "openrouter_api": "pass",
                "supabase_db": "pass",
            }
        }

    except asyncio.TimeoutError:
        return {
            "status": "unhealthy",
            "error": "Council execution timeout (>30s)",
            "process_id": "council_3stage",
            "timestamp": datetime.utcnow().isoformat(),
        }, 503

    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "process_id": "council_3stage",
            "timestamp": datetime.utcnow().isoformat(),
        }, 503

@router.get("/db")
async def health_database():
    """Validates database connectivity"""

    try:
        start = time.time()

        # Simple query to validate DB works
        result = await supabase.table("companies").select("id").limit(1).execute()

        latency_ms = (time.time() - start) * 1000

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "supabase",
            "latency_ms": round(latency_ms, 2),
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "service": "supabase",
            "timestamp": datetime.utcnow().isoformat(),
        }, 503

@router.get("/api")
async def health_external_apis():
    """Validates external API dependencies"""

    checks = {}
    overall_healthy = True

    # Check OpenRouter API
    try:
        response = await openrouter_client.health_check()  # Implement this
        checks["openrouter"] = {"status": "healthy", "latency_ms": response.latency}
    except Exception as e:
        checks["openrouter"] = {"status": "unhealthy", "error": str(e)}
        overall_healthy = False

    # Check Redis (if critical)
    try:
        await redis_client.ping()
        checks["redis"] = {"status": "healthy"}
    except Exception as e:
        checks["redis"] = {"status": "unhealthy", "error": str(e)}
        overall_healthy = False

    status_code = 200 if overall_healthy else 503

    return {
        "status": "healthy" if overall_healthy else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks
    }, status_code
```

**File to modify**: `backend/main.py`

```python
# Add health router
from backend.routers import health

app.include_router(health.router)
```

**Time**: 1.5 hours

---

### 3.2 Setup Synthetic Monitoring (BetterUptime)

**Steps**:

1. **Sign up for BetterUptime** (free tier: 50 checks/month)
   - Go to https://betteruptime.com
   - Sign up with GitHub
   - Create new monitor

2. **Configure Monitors**:

**Monitor 1: Council Health**
- URL: `https://axcouncil-backend.onrender.com/health/council`
- Interval: Every 5 minutes
- Timeout: 60 seconds
- Alert if: Status != 200 OR latency > 45s
- Alert to: Slack + Email

**Monitor 2: Database Health**
- URL: `https://axcouncil-backend.onrender.com/health/db`
- Interval: Every 5 minutes
- Timeout: 10 seconds
- Alert if: Status != 200 OR latency > 3s
- Alert to: Slack + Email

**Monitor 3: API Dependencies**
- URL: `https://axcouncil-backend.onrender.com/health/api`
- Interval: Every 10 minutes
- Timeout: 30 seconds
- Alert if: Status != 200
- Alert to: Slack + Email

**Time**: 1 hour

---

### 3.3 Setup Slack Alerts

**Steps**:
1. In BetterUptime dashboard → Integrations → Slack
2. Authorize Slack workspace
3. Select channel (e.g., `#alerts`)
4. Test alert

**Time**: 15 minutes

---

### 3.4 Test & Validate

**Checklist**:
- [ ] Test `/health/council` locally → returns healthy
- [ ] Test `/health/db` locally → returns healthy
- [ ] Deploy to production
- [ ] Verify BetterUptime checks are green
- [ ] Trigger failure (stop backend) → verify alert received

**Time**: 1 hour

**Total Phase 3**: 4 hours

---

## Phase 4: Process Registry & Documentation

**Goal**: Create central process registry and documentation

**Duration**: Week 4 (5 hours)

### 4.1 Create Process Registry

**File to create**: `backend/process_registry.py`

```python
"""
Process Registry - Single source of truth for all business processes.

This registry documents every critical process in AxCouncil:
- What it does
- SLA (performance target)
- Version
- Handler function
- Critical flag

Used for:
- Documentation (new developers)
- Monitoring (filter metrics by process ID)
- Testing (generate contract tests)
- Alerting (SLA violations)
"""

from dataclasses import dataclass
from typing import Callable, Optional

@dataclass
class ProcessDefinition:
    """Definition of a business process"""

    id: str  # Unique identifier (e.g., "council_3stage")
    name: str  # Human-readable name
    description: str  # What this process does
    version: str  # Semantic version
    handler: Callable  # Python function that implements this
    sla_seconds: int  # Performance SLA
    critical: bool  # Is this critical for core product?
    documentation_url: Optional[str] = None  # Link to detailed docs

# === PROCESS REGISTRY ===

from backend.council import run_council_deliberation
from backend.auth import authenticate_user
from backend.context_loader import load_company_context
from backend.routers.billing import create_subscription

PROCESSES = {
    "council_3stage": ProcessDefinition(
        id="council_3stage",
        name="AI Council Deliberation",
        description="3-stage LLM council pipeline: Stage 1 (parallel responses) → Stage 2 (peer review) → Stage 3 (synthesis)",
        version="2.1.0",
        handler=run_council_deliberation,
        sla_seconds=120,
        critical=True,
        documentation_url="/docs/processes/council-deliberation.md"
    ),

    "user_auth": ProcessDefinition(
        id="user_auth",
        name="User Authentication",
        description="JWT-based authentication flow with Supabase",
        version="1.0.0",
        handler=authenticate_user,
        sla_seconds=2,
        critical=True,
        documentation_url="/docs/processes/authentication.md"
    ),

    "company_context_load": ProcessDefinition(
        id="company_context_load",
        name="Load Company Context",
        description="Aggregate context from company, department, playbooks, and decisions",
        version="1.0.0",
        handler=load_company_context,
        sla_seconds=5,
        critical=True,
        documentation_url="/docs/processes/context-loading.md"
    ),

    "payment_subscription": ProcessDefinition(
        id="payment_subscription",
        name="Create Subscription",
        description="Stripe subscription creation and payment processing",
        version="1.0.0",
        handler=create_subscription,
        sla_seconds=10,
        critical=True,
        documentation_url="/docs/processes/billing.md"
    ),

    # Add more processes...
}

def get_process(process_id: str) -> ProcessDefinition:
    """Get process definition by ID"""
    if process_id not in PROCESSES:
        raise ValueError(f"Unknown process: {process_id}")
    return PROCESSES[process_id]

def list_critical_processes() -> list[ProcessDefinition]:
    """Get all critical processes"""
    return [p for p in PROCESSES.values() if p.critical]

def get_process_sla(process_id: str) -> int:
    """Get SLA for a process (in seconds)"""
    return get_process(process_id).sla_seconds
```

**Time**: 1 hour

---

### 4.2 Document Critical Processes

**File to create**: `docs/processes/README.md`

```markdown
# AxCouncil Business Processes

This directory documents all critical business processes in AxCouncil.

## Process List

| Process ID | Name | SLA | Critical | Status |
|------------|------|-----|----------|--------|
| `council_3stage` | AI Council Deliberation | <120s | ✅ Yes | ✅ Documented |
| `user_auth` | User Authentication | <2s | ✅ Yes | ✅ Documented |
| `company_context_load` | Load Company Context | <5s | ✅ Yes | ✅ Documented |
| `payment_subscription` | Create Subscription | <10s | ✅ Yes | ⚠️ Partial |

## Process Documentation Template

Each process should be documented with:
- Overview (what it does)
- Flow diagram
- Inputs/outputs
- Error handling
- SLA
- Monitoring/alerting
- Runbook for failures

See [council-deliberation.md](./council-deliberation.md) for example.
```

**File to create**: `docs/processes/council-deliberation.md`

```markdown
# Council Deliberation Process (council_3stage)

## Overview

The council deliberation process is the **core feature** of AxCouncil. It orchestrates 5 AI models through a 3-stage pipeline to produce high-quality, well-reasoned answers.

**Process ID**: `council_3stage`
**Version**: 2.1.0
**SLA**: <120 seconds end-to-end
**Critical**: Yes

## Flow Diagram

```
User Query
    ↓
┌─────────────────────────────────┐
│  Stage 1: Individual Responses  │
│  (5 models in parallel)         │
│  - Claude Opus 4.5              │
│  - GPT-5.1                      │
│  - Gemini 3 Pro                 │
│  - Grok 4                       │
│  - DeepSeek                     │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Stage 2: Peer Review           │
│  (3 cheap models rank Stage 1)  │
│  - Rankings & critiques         │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Stage 3: Chairman Synthesis    │
│  (1 model synthesizes final)    │
│  - Integrates best ideas        │
│  - Produces final answer        │
└─────────────────────────────────┘
    ↓
Final Answer
```

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | User's question |
| `company_id` | string | Yes | Company context |
| `conversation_id` | string | Yes | Conversation for history |
| `user_id` | string | Yes | User for tracking |
| `department_id` | string | No | Department context |
| `project_id` | string | No | Project context |

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `final_answer` | string | Chairman's synthesized answer |
| `stage1_responses` | array | All Stage 1 model responses |
| `stage2_rankings` | object | Peer review rankings |
| `process_id` | string | Always "council_3stage" |
| `version` | string | Process version |
| `duration_ms` | number | Total execution time |

## Error Handling

### Stage 1 Timeout
- **Condition**: Any model takes >40s
- **Action**: Skip that model, continue with others
- **Fallback**: If <3 models respond, return generic fallback

### Stage 2 Failure
- **Condition**: Ranking fails
- **Action**: Use default ranking (order by response quality heuristics)

### Stage 3 Failure
- **Condition**: Chairman synthesis fails
- **Action**: Return best Stage 1 response directly

## Monitoring

**Traces**: Every execution traced in Honeycomb with:
- Company ID
- User ID
- Stage breakdown
- Model response times

**Metrics** (Sentry):
- P50, P95, P99 latency
- Success rate
- Failure rate by stage
- Timeout rate

**Alerts**:
- Success rate <95% (5 min window)
- P95 latency >90s (1 hour window)
- Any Stage 1 timeout spike (>10% of requests)

## Runbook: "Council is slow"

**Symptom**: Users reporting council takes >2 minutes

**Diagnosis**:
1. Check Honeycomb → filter `process.id = council_3stage`
2. Look at P95 latency trend (spiking?)
3. Check which stage is slow (Stage 1 usually)

**Common Causes**:
- OpenRouter API slowness → Check `/health/api`
- Too many concurrent requests → Check rate limiting
- Database slow (context loading) → Check `/health/db`

**Fix**:
- If Stage 1 slow: Reduce timeout to fail faster
- If Stage 2 slow: Skip Stage 2 temporarily (feature flag)
- If DB slow: Check Supabase dashboard

## Contract Tests

See `tests/test_process_contracts.py::TestCouncilDeliberationContract`
```

**Time**: 2 hours

---

### 4.3 Create Runbooks for Common Failures

**File to create**: `docs/runbooks/council-timeout.md`

```markdown
# Runbook: Council Deliberation Timeout

## Alert

"Council process timeout rate >5% (last 5 minutes)"

## Severity

🔴 **High** - Core product feature affected

## Impact

Users cannot get council responses, must wait or retry.

## Diagnosis Steps

1. **Check health endpoint**:
   ```bash
   curl https://axcouncil-backend.onrender.com/health/council
   ```
   - If unhealthy → proceed to step 2
   - If healthy → false alarm, check alerting threshold

2. **Check Honeycomb traces**:
   - Go to https://ui.honeycomb.io
   - Filter: `process.id = council_3stage AND process.status = timeout`
   - Look at recent traces → which stage is timing out?

3. **Check OpenRouter API status**:
   - Go to https://status.openrouter.ai
   - Any incidents?

4. **Check Supabase status**:
   - Go to Supabase dashboard → Health
   - Database responding?

## Common Causes & Fixes

### Cause 1: OpenRouter API Degradation

**Symptoms**: Stage 1 timeouts, OpenRouter slow

**Fix**:
1. Check `/health/api` → if OpenRouter unhealthy, wait for recovery
2. Reduce Stage 1 timeout from 40s to 30s (faster failover)
3. Consider disabling slowest models temporarily

**ETA**: 10-30 minutes (wait for OpenRouter recovery)

### Cause 2: Database Slow (Context Loading)

**Symptoms**: High latency in `stage1.load_context` span

**Fix**:
1. Check Supabase dashboard → slow queries?
2. Check if too many auto-inject playbooks (>10)
3. Add caching for company context

**ETA**: 5-10 minutes (add cache) or 1 hour (optimize queries)

### Cause 3: Too Many Concurrent Requests

**Symptoms**: Timeouts spike during high traffic

**Fix**:
1. Check request rate in Sentry
2. Increase rate limit if legitimate traffic
3. Add queue for council requests (future)

**ETA**: 15 minutes (adjust rate limit)

## Resolution Steps

1. Identify root cause using diagnosis
2. Apply fix
3. Monitor `/health/council` for 10 minutes
4. Verify alert clears
5. Post incident in #tech-incidents channel

## Prevention

- Add load testing for council process
- Implement circuit breaker for OpenRouter
- Cache company context (90% hit rate)

## Related Docs

- [Council Deliberation Process](../processes/council-deliberation.md)
- [Contract Tests](../../tests/test_process_contracts.py)
```

**Time**: 1.5 hours

---

### 4.4 Update Main README

**File to modify**: `README.md`

Add section:

```markdown
## Business Processes

AxCouncil has full process integrity tracking for all critical business processes:

- ✅ **Distributed Tracing** (OpenTelemetry + Honeycomb)
- ✅ **Contract Tests** (pytest)
- ✅ **Health Checks** (BetterUptime synthetic monitoring)
- ✅ **Performance Metrics** (Sentry)
- ✅ **Process Registry** (documented in code)

**Critical Processes**:
- Council Deliberation (3-stage pipeline) - SLA: <120s
- User Authentication (JWT) - SLA: <2s
- Company Context Loading - SLA: <5s
- Payment Processing (Stripe) - SLA: <10s

See [docs/processes/](./docs/processes/) for detailed documentation.

**Process Integrity Score: 8.5/10** (Enterprise-grade)
```

**Time**: 30 minutes

**Total Phase 4**: 5 hours

---

## Testing Strategy

### Unit Tests (Existing)
- Continue existing unit test coverage
- Contract tests complement, not replace unit tests

### Contract Tests (New)
- Test critical processes end-to-end
- Run in CI on every PR
- Block merge if contract violated

### Integration Tests (Existing)
- Keep existing integration tests
- Enhance with OpenTelemetry validation

### Load Tests (Future)
- Implement load testing for council process
- Validate SLA under high concurrency
- Use Locust or k6

---

## Rollout Plan

### Week 1: Observability Foundation
- Add OpenTelemetry to council deliberation
- Enhance Sentry context
- Validate traces appear in Honeycomb

### Week 2: Contract Testing
- Write contract tests for top 3 processes
- Add to CI pipeline
- Ensure all tests pass

### Week 3: Health Checks & Monitoring
- Add health endpoints
- Configure BetterUptime
- Setup Slack alerts
- Validate alerts work

### Week 4: Process Registry & Documentation
- Create process registry
- Document critical processes
- Write runbooks for common failures
- Update README

### Week 5+: Continuous Improvement
- Expand contract test coverage
- Add more processes to registry
- Optimize based on metrics
- Refine alerts to reduce noise

---

## Success Metrics

### Before Implementation (Current State)

| Metric | Value |
|--------|-------|
| Time to debug production issue | 30+ minutes |
| Contract test coverage | 0% |
| Production bugs per deploy | 2-3 |
| Process documentation | Minimal (README only) |
| Synthetic monitoring | None |
| Distributed tracing | None |
| Process Integrity Score | 3.5/10 |

### After Implementation (Target State)

| Metric | Target | Impact |
|--------|--------|--------|
| Time to debug production issue | 2 minutes | **93% reduction** |
| Contract test coverage | 100% (critical processes) | **Prevents bugs in CI** |
| Production bugs per deploy | 0-1 | **50%+ reduction** |
| Process documentation | Complete | **Faster onboarding** |
| Synthetic monitoring | All critical processes | **Proactive alerts** |
| Distributed tracing | All critical processes | **Full observability** |
| **Process Integrity Score** | **8.5/10** | **Enterprise-grade** |

---

## Cost-Benefit Analysis

### Costs

**Development Time**: ~20 hours over 4 weeks
- Week 1: 5 hours (observability)
- Week 2: 6 hours (contract tests)
- Week 3: 4 hours (health checks)
- Week 4: 5 hours (registry + docs)

**Ongoing Costs**:
- Maintenance: ~1 hour/month
- Monitoring: $0 (free tiers)
- Developer time: Minimal (automated)

**Total First Year**: ~32 hours (~$3,200 at $100/hour)

### Benefits

**Incident Response Time Reduction**:
- Current: 30 minutes/incident × 20 incidents/year = 10 hours
- After: 2 minutes/incident × 20 incidents/year = 0.67 hours
- **Savings: 9.3 hours/year (~$930)**

**Production Bug Reduction**:
- Current: 2 bugs/deploy × 100 deploys/year × 2 hours/fix = 400 hours
- After: 0.5 bugs/deploy × 100 deploys/year × 2 hours/fix = 100 hours
- **Savings: 300 hours/year (~$30,000)**

**Faster Onboarding**:
- Current: 1 week = 40 hours
- After: 1 day = 8 hours
- **Savings per new hire: 32 hours (~$3,200)**

**Confidence to Ship Faster**:
- Current: 1 deploy/week (fear of breaking things)
- After: 5 deploys/week (confidence in contract tests)
- **Value: Faster feature delivery = competitive advantage**

**Total Annual Benefit**: ~$34,000+
**ROI**: ~10x in first year

---

## Risks & Mitigations

### Risk 1: OpenTelemetry Performance Overhead

**Risk**: Tracing adds latency to requests

**Mitigation**:
- OpenTelemetry is async and batched (minimal overhead <5ms)
- Can disable tracing via feature flag if needed
- Monitor performance before/after implementation

**Likelihood**: Low
**Impact**: Low

---

### Risk 2: False Positive Alerts

**Risk**: Too many alerts lead to alert fatigue

**Mitigation**:
- Start with conservative thresholds
- Tune based on historical data
- Use "warning" vs "critical" alert levels
- Review alerts weekly, adjust thresholds

**Likelihood**: Medium
**Impact**: Medium

---

### Risk 3: Contract Tests Become Brittle

**Risk**: Tests break on every code change

**Mitigation**:
- Test behavior, not implementation
- Focus on inputs/outputs, not internal logic
- Use mocks for external dependencies
- Review test design with team

**Likelihood**: Medium
**Impact**: Low

---

### Risk 4: Documentation Becomes Stale

**Risk**: Process docs become outdated

**Mitigation**:
- Include docs in PR review checklist
- Quarterly documentation review
- Link docs from code comments
- Use process registry as source of truth

**Likelihood**: Medium
**Impact**: Low

---

## Next Steps

1. ✅ **Approved?** Review this plan with team
2. ✅ **Budget?** Allocate ~20 hours over 4 weeks
3. ✅ **Start?** Begin Week 1 (Observability Foundation)
4. ✅ **Track?** Update progress in weekly standup

---

## Appendix: Tools Comparison

### Tracing: OpenTelemetry vs Custom

| Feature | OpenTelemetry | Custom Solution |
|---------|---------------|-----------------|
| Implementation Time | 1 hour | 40+ hours |
| Vendor Lock-in | None (vendor-neutral) | High |
| Maintenance | Low (standard library) | High |
| Community Support | Large | None |
| Cost | Free | Developer time |
| **Winner** | ✅ OpenTelemetry | ❌ Custom |

### Monitoring: BetterUptime vs Custom

| Feature | BetterUptime | Custom Solution |
|---------|--------------|-----------------|
| Implementation Time | 1 hour | 20+ hours |
| Maintenance | None | High |
| Alerting | Built-in | Build from scratch |
| Status Page | Included | Build from scratch |
| Cost | Free (50 checks) | Developer time + hosting |
| **Winner** | ✅ BetterUptime | ❌ Custom |

**Conclusion**: Use standard tools, don't reinvent the wheel.

---

## Related Documents

- [Audit Command](../.claude/commands/audit-process-integrity.md)
- [Observability Architecture](./docs/architecture/observability.md) (to be created)
- [Contract Testing Guide](./docs/testing/contract-tests.md) (to be created)
- [Runbook Index](./docs/runbooks/README.md) (to be created)

---

**Status**: Ready for review
**Next Action**: Team review and approval
**Owner**: Engineering Lead
**Last Updated**: 2026-01-16
