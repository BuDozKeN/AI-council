# Process Integrity Audit - Flawless Feature Shipping

You are a Site Reliability Engineer (SRE) and DevOps architect auditing process integrity for an enterprise SaaS platform. This audit ensures every critical business process is **observable, testable, monitored, and recoverable** - enabling fast, confident feature shipping with zero production surprises.

**The Stakes**: Process integrity = shipping speed. Good process tracking = fix bugs in 2 minutes. Bad process tracking = 30 minutes of log grepping + guessing. Enterprise buyers evaluate operational maturity in procurement decisions.

**Goal**: Fast, confident shipping where you know IMMEDIATELY when you break something, and exactly what you broke.

---

## What is Process Integrity?

**Process Integrity** means every critical business process:
1. **Is documented** - Clear definition of expected behavior
2. **Has observability** - Every execution is traced with full context
3. **Has contract tests** - Automated validation that process works end-to-end
4. **Has health checks** - Synthetic monitoring catches failures proactively
5. **Has error handling** - Graceful degradation with automatic alerts
6. **Has metrics** - Performance tracked, SLAs monitored, regressions detected

---

## Process Maturity Model

```
Level 0: Hope-Based Deployment
├── No process tracking
├── Find bugs from user complaints
├── Debugging takes hours
└── Fear of deploying

Level 1: Basic Logging
├── Errors logged to file
├── Can grep logs for issues
├── Debugging takes 30+ min
└── Still fear deploying

Level 2: Structured Observability
├── OpenTelemetry tracing
├── Errors in Sentry with context
├── Debugging takes 5-10 min
└── Some confidence deploying

Level 3: Full Process Integrity (TARGET)
├── All Level 2 features
├── Contract tests catch breakage in CI
├── Health checks alert before user impact
├── Debugging takes 1-2 min
└── Ship with confidence

Target: Level 3 minimum for $25M readiness
```

---

## Audit Checklist (Lean, Modern Stack)

### 1. Observability - OpenTelemetry (20 points)

**Modern Standard**: Use OpenTelemetry (vendor-neutral, industry standard)

```
Critical Processes Instrumented:
- [ ] Council deliberation (3-stage pipeline)
- [ ] User authentication flow
- [ ] Company context loading
- [ ] Payment/subscription process
- [ ] Knowledge entry save
- [ ] Department/role CRUD operations

OpenTelemetry Setup:
- [ ] opentelemetry-api installed
- [ ] opentelemetry-sdk installed
- [ ] opentelemetry-instrumentation-fastapi installed
- [ ] Traces sent to provider (Honeycomb, Grafana, Datadog)
- [ ] All spans include business context (company_id, user_id, process_id)
- [ ] Parent-child relationships tracked (stage1 → stage2 → stage3)

Trace Quality:
- [ ] Can answer: "What happened for User X at 2:43 PM?"
- [ ] Can see full execution timeline
- [ ] Can see where process failed
- [ ] Can see performance breakdown by stage
- [ ] Traces retained for 30+ days
```

**Implementation Example:**
```python
# backend/instrumentation.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

tracer_provider = TracerProvider()
tracer_provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint="https://api.honeycomb.io"))
)
trace.set_tracer_provider(tracer_provider)

# In your code:
tracer = trace.get_tracer(__name__)

async def run_council_deliberation(query: str, company_id: str):
    with tracer.start_as_current_span("council.3stage") as span:
        span.set_attribute("company_id", company_id)
        span.set_attribute("query_length", len(query))

        with tracer.start_as_current_span("council.stage1"):
            stage1 = await run_stage1(query)
            span.set_attribute("stage1.model_count", len(stage1))

        with tracer.start_as_current_span("council.stage2"):
            stage2 = await run_stage2(stage1)

        with tracer.start_as_current_span("council.stage3"):
            result = await run_stage3(stage1, stage2)

        return result
```

**Files to Review:**
- Check if `opentelemetry` is in `requirements.txt` or `pyproject.toml`
- Look for `tracer.start_as_current_span()` in critical flows
- Check `backend/council.py`, `backend/routers/auth.py`, `backend/context_loader.py`

**Score:**
- 20 points: All critical processes instrumented, traces include context
- 15 points: 50%+ processes instrumented
- 10 points: Basic logging exists but no tracing
- 0 points: No structured observability

---

### 2. Error Tracking - Sentry Context Enrichment (20 points)

**Already using Sentry** - just enhance with business context

```
Error Context:
- [ ] All errors captured in Sentry
- [ ] Errors include process_id
- [ ] Errors include company_id
- [ ] Errors include user_id
- [ ] Errors include version
- [ ] Can filter: "All council errors for Company X"

Alerting:
- [ ] Alerts configured for error spikes (>10 errors in 5 min)
- [ ] Alerts configured for critical process failures
- [ ] Alerts sent to Slack/email
- [ ] On-call rotation configured

Error Handling:
- [ ] All critical processes have try-catch blocks
- [ ] Errors logged before re-raising
- [ ] User-friendly error messages
- [ ] Technical errors sent to Sentry
```

**Implementation Example:**
```python
# backend/council.py
import sentry_sdk

async def run_council_deliberation(query: str, company_id: str):
    with sentry_sdk.configure_scope() as scope:
        scope.set_context("council", {
            "query": query[:100],
            "company_id": company_id,
            "process": "council_3stage",
            "version": "2.1.0"
        })

        try:
            return await _run_council(query, company_id)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            raise
```

**Files to Review:**
- `backend/main.py` - Sentry initialization
- `backend/council.py` - Error handling in 3-stage pipeline
- `backend/routers/` - Error handling in all routes

**Score:**
- 20 points: All errors captured with rich context, alerts configured
- 15 points: Errors captured but minimal context
- 10 points: Basic error logging exists
- 0 points: Errors swallowed or not tracked

---

### 3. Contract Testing (30 points) ⭐ MOST IMPORTANT

**Contract tests validate process behavior** - catches 90% of bugs before production

```
Critical Processes Have Contract Tests:
- [ ] Council deliberation (3-stage contract)
- [ ] User authentication
- [ ] Company context loading
- [ ] Payment processing
- [ ] Department/role operations

Contract Test Quality:
- [ ] Tests define expected inputs/outputs
- [ ] Tests validate process completes successfully
- [ ] Tests validate error handling (timeout, API failure)
- [ ] Tests validate SLA compliance (e.g., <120s for council)
- [ ] Tests run in CI on every PR
- [ ] Contract violations block merge

Test Coverage:
- [ ] Happy path tested for all critical processes
- [ ] Error scenarios tested
- [ ] Edge cases tested
- [ ] Performance tested (load tests)
```

**Implementation Example:**
```python
# tests/test_process_contracts.py
import pytest
from backend.council import run_council_deliberation

class TestCouncilProcessContract:
    """Contract tests - if these pass, the process works end-to-end"""

    @pytest.mark.asyncio
    async def test_council_3stage_contract(self):
        """Council deliberation follows the 3-stage contract"""

        # Given: A valid query
        query = "What is AI?"
        company_id = "test-company-123"

        # When: Running council
        result = await run_council_deliberation(query, company_id)

        # Then: Contract is satisfied
        assert result is not None, "Process must return result"
        assert "stage1_responses" in result, "Must include Stage 1 responses"
        assert len(result["stage1_responses"]) >= 3, "Must have 3+ models"
        assert "stage2_rankings" in result, "Must include Stage 2 rankings"
        assert "final_answer" in result, "Must include chairman synthesis"
        assert result["duration_ms"] < 120_000, "Must complete in <2 min"

        # Process metadata
        assert result["process_id"] == "council_3stage"
        assert result["version"] == "2.1.0"

    @pytest.mark.asyncio
    async def test_council_handles_stage1_timeout(self):
        """Council gracefully handles Stage 1 timeout"""

        with mock_llm_timeout():
            result = await run_council_deliberation("Test", "company-123")

        # Contract: Must return fallback, not crash
        assert result is not None
        assert result["fallback_used"] == True
        assert "error" in result

    @pytest.mark.asyncio
    async def test_council_respects_context_injection_order(self):
        """Context is injected in correct order"""

        company_id = create_test_company(context="Company: ACME")
        dept_id = create_test_department(company_id, context="Dept: Sales")

        result = await run_council_deliberation(
            "Test query",
            company_id,
            department_id=dept_id
        )

        # Contract: Context order is Company → Department → Query
        assert result["context_order"] == [
            "company_context",
            "department_context",
            "user_query"
        ]
```

**Files to Review:**
- `tests/test_process_contracts.py` (may not exist - create it!)
- `.github/workflows/ci.yml` - Check if contract tests run

**Score:**
- 30 points: All critical processes have contract tests running in CI
- 20 points: Some contract tests exist
- 10 points: Only unit tests (no end-to-end process validation)
- 0 points: No contract tests

---

### 4. Health Checks & Synthetic Monitoring (15 points)

**Catch failures before users do** - proactive alerting

```
Health Endpoints:
- [ ] /health/council endpoint exists
- [ ] /health/db endpoint exists
- [ ] /health/api endpoint exists
- [ ] Health checks validate process works (not just "server is up")
- [ ] Health checks timeout quickly (<30s)

Synthetic Monitoring:
- [ ] Health endpoints monitored externally (BetterUptime, Pingdom, etc.)
- [ ] Checks run every 5 minutes
- [ ] Alerts configured on failure
- [ ] Alerts sent to Slack/PagerDuty
- [ ] Historical uptime tracked

Dependency Health:
- [ ] OpenRouter API health checked
- [ ] Supabase DB health checked
- [ ] Redis health checked (if critical)
- [ ] Qdrant health checked (if critical)
```

**Implementation Example:**
```python
# backend/routers/health.py
from fastapi import APIRouter

router = APIRouter(prefix="/health")

@router.get("/council")
async def council_health():
    """Validates council process is working"""

    try:
        # Run minimal council execution
        result = await run_council_deliberation(
            query="Health check",
            company_id="system",
            timeout=30  # Fast check
        )

        return {
            "status": "healthy",
            "timestamp": now(),
            "process_id": "council_3stage",
            "version": "2.1.0",
            "latency_ms": result["duration_ms"],
            "checks": {
                "stage1": "pass",
                "stage2": "pass",
                "stage3": "pass",
                "openrouter_api": "pass",
                "supabase_db": "pass",
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "process_id": "council_3stage"
        }, 503

@router.get("/db")
async def db_health():
    """Validates database connectivity"""
    try:
        result = await supabase.table("companies").select("id").limit(1).execute()
        return {"status": "healthy", "latency_ms": result.elapsed_ms}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}, 503
```

**Files to Review:**
- `backend/routers/health.py`
- Check if health endpoints exist: `curl https://axcouncil-backend.onrender.com/health/council`
- Check if monitoring configured in BetterUptime, Pingdom, or similar

**Score:**
- 15 points: Health endpoints exist + external monitoring + alerts
- 10 points: Health endpoints exist but no monitoring
- 5 points: Basic /health endpoint (just returns 200)
- 0 points: No health checks

---

### 5. Process Metrics & Performance (10 points)

**Use Sentry Performance** - don't build custom metrics

```
Performance Tracking:
- [ ] Sentry Performance enabled
- [ ] Transactions tracked for critical processes
- [ ] P50, P75, P95, P99 latency visible
- [ ] Throughput (requests/sec) tracked
- [ ] Error rate (%) tracked

SLA Monitoring:
- [ ] SLAs defined for each critical process
- [ ] SLA compliance tracked
- [ ] Alerts on SLA violations
- [ ] Regression detection (alerts when latency spikes)

Dashboards:
- [ ] Process health dashboard exists
- [ ] Historical trends visible
- [ ] Can filter by company/user
- [ ] Can see error breakdown by type
```

**Implementation Example:**
```python
# backend/council.py
import sentry_sdk

async def run_council_deliberation(query: str, company_id: str):
    # Automatic performance tracking
    with sentry_sdk.start_transaction(op="council", name="3stage_deliberation"):
        with sentry_sdk.start_span(op="stage1", description="parallel_models"):
            stage1 = await run_stage1(query)

        with sentry_sdk.start_span(op="stage2", description="peer_ranking"):
            stage2 = await run_stage2(stage1)

        with sentry_sdk.start_span(op="stage3", description="synthesis"):
            result = await run_stage3(stage1, stage2)

        return result
```

**Files to Review:**
- Check if `sentry_sdk.start_transaction()` used in critical flows
- Check Sentry dashboard for Performance tab

**Score:**
- 10 points: Full performance tracking with dashboards and alerts
- 7 points: Basic performance tracking exists
- 3 points: Only error tracking (no performance)
- 0 points: No metrics

---

### 6. Process Registry & Documentation (5 points)

**Single source of truth** for all processes

```
Process Registry:
- [ ] PROCESSES dict exists in code
- [ ] All critical processes registered
- [ ] Each process has: id, name, description, version, handler, SLA
- [ ] Process versions tracked
- [ ] Breaking changes documented

Documentation:
- [ ] README explains critical processes
- [ ] Flow diagrams exist for complex processes
- [ ] Runbooks for common failures
- [ ] Onboarding docs reference process registry
```

**Implementation Example:**
```python
# backend/process_registry.py
from dataclasses import dataclass
from typing import Callable

@dataclass
class ProcessDefinition:
    id: str
    name: str
    description: str
    version: str
    handler: Callable
    sla_seconds: int
    critical: bool

# Process registry - single source of truth
PROCESSES = {
    "council_3stage": ProcessDefinition(
        id="council_3stage",
        name="AI Council Deliberation",
        description="3-stage LLM council pipeline",
        version="2.1.0",
        handler=run_council_deliberation,
        sla_seconds=120,
        critical=True
    ),
    "company_context_load": ProcessDefinition(
        id="company_context_load",
        name="Load Company Context",
        description="Aggregate context from company/dept/playbooks",
        version="1.0.0",
        handler=load_company_context,
        sla_seconds=5,
        critical=True
    ),
    "user_auth": ProcessDefinition(
        id="user_auth",
        name="User Authentication",
        description="JWT validation and session management",
        version="1.0.0",
        handler=authenticate_user,
        sla_seconds=2,
        critical=True
    ),
}

def get_process(process_id: str) -> ProcessDefinition:
    """Get process by ID"""
    if process_id not in PROCESSES:
        raise ValueError(f"Unknown process: {process_id}")
    return PROCESSES[process_id]
```

**Files to Review:**
- `backend/process_registry.py`
- `README.md` - Does it explain critical processes?
- `docs/` - Flow diagrams, runbooks

**Score:**
- 5 points: Complete process registry + documentation
- 3 points: Processes documented in README
- 1 point: Minimal documentation
- 0 points: No process documentation

---

## Critical Processes for AxCouncil

**Must be audited:**

1. **council_deliberation_3stage** (CRITICAL)
   - 3-stage pipeline (Stage 1 → Stage 2 → Stage 3)
   - Model execution
   - Context injection
   - SLA: <120 seconds

2. **user_authentication** (CRITICAL)
   - Login flow
   - JWT validation
   - Session management
   - SLA: <2 seconds

3. **company_context_load** (HIGH)
   - Context aggregation
   - Department/role resolution
   - Playbook injection
   - SLA: <5 seconds

4. **payment_subscription** (CRITICAL)
   - Stripe integration
   - Billing calculations
   - Invoice generation
   - SLA: <10 seconds

5. **knowledge_entry_save** (MEDIUM)
   - Decision capture
   - Tagging
   - Auto-inject flagging
   - SLA: <3 seconds

6. **department_delete** (MEDIUM)
   - Cascade delete roles
   - Validation
   - Audit logging
   - SLA: <5 seconds

---

## Scoring

```
Process Integrity Score = (
    Observability (20) +
    Error Tracking (20) +
    Contract Testing (30) +
    Health Checks (15) +
    Metrics (10) +
    Process Registry (5)
) / 10

Target: 8.0/10 minimum for enterprise-grade
```

**Grade Interpretation:**
- **9.0-10.0**: Excellent - Ship with confidence, minimal production surprises
- **8.0-8.9**: Good - Solid foundation, minor improvements needed
- **6.0-7.9**: Needs Work - Missing critical components, risky deployments
- **<6.0**: Poor - High risk of production issues, user-facing bugs

---

## Modern Tools Stack (All Free Tier)

**Don't build custom solutions** - use industry-standard tools:

| Need | Tool | Why | Cost |
|------|------|-----|------|
| **Tracing** | OpenTelemetry + Honeycomb | Industry standard, vendor-neutral | Free 20GB/mo |
| **Errors** | Sentry | Already using, just enhance | Free 5K events/mo |
| **Testing** | pytest + contract tests | Python standard | Free |
| **Monitoring** | BetterUptime | Synthetic monitoring | Free 50 checks/mo |
| **Metrics** | Sentry Performance | Integrated with error tracking | Included |
| **Dashboards** | Grafana Cloud | Open source standard | Free 10K series |

**Total Cost**: $0/month (free tiers are generous)
**Setup Time**: ~4 hours
**Maintenance**: ~1 hour/month

---

## What NOT to Build

❌ **Custom process execution tables** → Use OpenTelemetry traces
❌ **Custom metrics database** → Use Sentry Performance
❌ **Custom alerting** → Use BetterUptime + Sentry
❌ **Custom dashboards** → Use Grafana/Honeycomb
❌ **Immutable audit logs** → Use Supabase audit (built-in)
❌ **Circuit breakers** → Use `tenacity` library
❌ **Rate limiting** → Use `slowapi` (already implemented)

**Build ONLY**:
- ✅ Process registry (`backend/process_registry.py`)
- ✅ Contract tests (`tests/test_process_contracts.py`)
- ✅ Health endpoints (`backend/routers/health.py`)
- ✅ OpenTelemetry instrumentation (add to existing code)

---

## How This Helps Long-Term Survival

**Scenario 1: New developer joins**
- Reads `PROCESSES` dict → understands critical flows
- Runs contract tests → validates setup works
- Makes change → contract tests catch breakage BEFORE deploy
- **Onboarding: 1 day** (was 1 week)

**Scenario 2: Production incident**
- User reports: "Council didn't work at 2:43 PM"
- Open Honeycomb → search trace ID → full execution context
- See: Stage 2 timed out (OpenRouter API slow)
- Fix identified in **2 minutes** (was 30 minutes)

**Scenario 3: Refactoring**
- Want to optimize Stage 2 ranking algorithm
- Contract tests give confidence nothing breaks
- Run tests → green → deploy
- **Ship without fear**

**Scenario 4: Scaling**
- Honeycomb shows Stage 1 P95 latency is 45s (up from 20s)
- Optimize JUST that stage (parallel execution, caching)
- Verify improvement in metrics
- **Data-driven optimization**

**Scenario 5: Compliance audit**
- Auditor asks: "Can you prove the council process works?"
- Show: Contract tests (100% pass rate) + Health checks (99.9% uptime) + Traces (full audit trail)
- **Pass audit in 15 minutes**

**Scenario 6: Feature shipping**
- Developer adds new feature
- Contract tests run in CI → catch breaking change
- Fix before merge → never reaches production
- **Zero production bugs from that feature**

---

## Implementation Priority

**Phase 1: Foundation (Week 1)**
1. Add OpenTelemetry to council deliberation
2. Enhance Sentry context for all errors
3. Create process registry

**Phase 2: Testing (Week 2)**
4. Write contract tests for council
5. Write contract tests for auth
6. Add to CI pipeline

**Phase 3: Monitoring (Week 3)**
7. Add health endpoints
8. Configure BetterUptime synthetic monitoring
9. Set up alerts

**Phase 4: Coverage (Ongoing)**
10. Expand contract tests to all critical processes
11. Add dashboards
12. Document runbooks

---

## Audit Execution

1. **Review codebase** for each checklist item
2. **Score each category** (0-100%)
3. **Calculate overall score** (weighted average)
4. **Identify gaps** (highest impact improvements)
5. **Create action plan** (prioritized by ROI)

**Output Format:**
```markdown
# Process Integrity Audit Report - [Date]

## Executive Summary
- Overall Score: X.X/10
- Critical Issues: X
- High Priority: X
- Medium Priority: X

## Findings by Category
[Detailed findings...]

## Critical Gaps
[What's missing that blocks 8.0+ score...]

## Recommended Actions
[Prioritized list with effort/impact...]

## Implementation Roadmap
[4-week plan to reach 8.0+...]
```

---

## Success Metrics (After Implementation)

**Before Process Integrity:**
- Time to debug production issue: 30+ minutes
- Contract test coverage: 0%
- Production bugs per deploy: 2-3
- Developer confidence: Low
- Onboarding time: 1 week

**After Process Integrity (Target):**
- Time to debug production issue: 2 minutes ✅
- Contract test coverage: 100% for critical processes ✅
- Production bugs per deploy: 0-1 ✅
- Developer confidence: High ✅
- Onboarding time: 1 day ✅

**ROI**: ~$50K/year in reduced incident time + faster onboarding + fewer bugs

---

## Related Audits

- `/audit-test-coverage` - Validates unit/integration test quality
- `/audit-resilience` - Validates error handling and recovery
- `/audit-devops` - Validates CI/CD pipeline maturity
- `/audit-performance` - Validates application performance
- `/audit-security` - Validates security controls

**Process Integrity is the foundation** - without it, other audits have limited value.
