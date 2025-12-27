# Resilience & Observability Audit - Failure Recovery & Visibility

You are a Site Reliability Engineer (SRE) auditing a production system for resilience and observability. This system must handle failures gracefully and provide visibility into its health.

**The Stakes**: Users expect 99.9% uptime. Partial failures shouldn't corrupt state. When things break, you need to know immediately.

## Architecture Context

AxCouncil's Failure-Prone Components:
- **5 LLM Providers**: Each can fail independently
- **3-Stage Pipeline**: Partial failures at each stage
- **Streaming Responses**: Can fail mid-stream
- **Supabase**: Database and auth
- **Stripe**: Payment webhooks

## Audit Checklist

### 1. Circuit Breaker Effectiveness
```
Check for:
- [ ] Circuit breaker configuration documented
- [ ] Failure threshold appropriate (not too sensitive/lenient)
- [ ] Reset timeout reasonable
- [ ] State transitions logged
- [ ] Half-open state testing (gradual recovery)
- [ ] Per-service vs global circuit breakers
- [ ] Circuit breaker metrics exposed
- [ ] Alerting on circuit open
```

**Files to Review:**
- `backend/openrouter.py` - Circuit breaker implementation
- States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)

### 2. Partial Failure Handling
```
Stage 1 (5 parallel models):
- [ ] Continues if 1-2 models fail
- [ ] Minimum viable responses defined
- [ ] Failed model logged but not blocking
- [ ] User informed of reduced council

Stage 2 (Ranking):
- [ ] Handles missing rankings gracefully
- [ ] Fallback if parsing fails
- [ ] Weighted aggregation with missing votes

Stage 3 (Synthesis):
- [ ] Chairman fallback chain
- [ ] Maximum retry attempts
- [ ] Graceful failure message to user
```

### 3. Timeout Configuration
```
Check for:
- [ ] Database query timeout (10s default)
- [ ] Triage analysis timeout (30s)
- [ ] Council query timeout (120s)
- [ ] HTTP client timeout
- [ ] Streaming timeout
- [ ] Timeouts appropriate for operation type
- [ ] Timeout errors distinguishable from other errors
```

### 4. Retry Logic
```
Check for:
- [ ] Exponential backoff implementation
- [ ] Maximum retry attempts
- [ ] Jitter to prevent thundering herd
- [ ] Retry only on transient errors
- [ ] No retry on 4xx errors
- [ ] Retry state not persisted (safe for restarts)
- [ ] Rate limit (429) specific handling
```

### 5. Streaming Error Recovery
```
Check for:
- [ ] Mid-stream failure detection
- [ ] Partial response handling
- [ ] Client notification of stream error
- [ ] Cleanup of failed streams
- [ ] Memory management for concurrent streams
- [ ] Reconnection strategy (if applicable)
```

### 6. Health Checks
```
Check for:
- [ ] /health endpoint exists
- [ ] Checks database connectivity
- [ ] Checks LLM provider connectivity
- [ ] Checks cache availability
- [ ] Returns structured health status
- [ ] Appropriate for load balancer probes
- [ ] Separate liveness vs readiness probes
```

**Current state:** `/health` endpoint exists but completeness unknown

### 7. Graceful Shutdown
```
Check for:
- [ ] SIGTERM handling
- [ ] In-flight request completion
- [ ] Connection draining
- [ ] Resource cleanup (HTTP clients, DB connections)
- [ ] Shutdown timeout
- [ ] No orphaned streams
```

**Files to Review:**
- `backend/main.py` - on_event("shutdown") handler

### 8. Bulkhead Pattern
```
Check for:
- [ ] Separate thread/connection pools per service
- [ ] LLM calls don't block database calls
- [ ] One slow provider doesn't affect others
- [ ] Resource limits per operation type
- [ ] Queue depth limits
```

### 9. Error Classification
```
Check for:
- [ ] Transient vs permanent error distinction
- [ ] Retryable vs non-retryable errors
- [ ] User-actionable vs system errors
- [ ] Error categorization for metrics
- [ ] Error codes documented
```

### 10. Observability - Metrics
```
Check for:
- [ ] Request rate metrics
- [ ] Error rate metrics (by type)
- [ ] Latency metrics (p50, p95, p99)
- [ ] Circuit breaker state metrics
- [ ] Queue depth metrics
- [ ] Resource utilization metrics
- [ ] Business metrics (queries/day, revenue)
- [ ] Metrics infrastructure (Prometheus, DataDog, etc.)
```

### 11. Observability - Logging
```
Check for:
- [ ] Structured logging format
- [ ] Correlation IDs / request tracing
- [ ] Log levels appropriate
- [ ] Sensitive data masked
- [ ] Log aggregation (ELK, CloudWatch, etc.)
- [ ] Log retention policy
- [ ] Searchable logs
```

**Files to Review:**
- `backend/security.py` - Security logging
- Logging patterns throughout

### 12. Observability - Tracing
```
Check for:
- [ ] Request correlation across services
- [ ] Trace IDs in logs
- [ ] Distributed tracing (Jaeger, Zipkin, etc.)
- [ ] Trace sampling strategy
- [ ] Cross-service trace propagation
```

### 13. Alerting
```
Check for:
- [ ] Error rate threshold alerts
- [ ] Latency threshold alerts
- [ ] Circuit breaker open alerts
- [ ] Database connection alerts
- [ ] Billing/payment failure alerts
- [ ] Alert routing (PagerDuty, Slack, etc.)
- [ ] Alert fatigue prevention
- [ ] Runbooks linked to alerts
```

### 14. Sentry Integration
```
Check for:
- [ ] Sentry DSN configured
- [ ] Error sampling appropriate
- [ ] Transaction sampling for performance
- [ ] Source maps uploaded (frontend)
- [ ] User context attached
- [ ] Release tracking
- [ ] Error grouping effective
```

**Current state:** Sentry integrated with 10% transactions, 100% errors

### 15. Cache Reliability
```
Check for:
- [ ] Cache failure handling (fallback to source)
- [ ] Cache invalidation correctness
- [ ] Cache hit/miss metrics
- [ ] TTL configuration appropriate
- [ ] Cache stampede prevention
- [ ] Memory limits
```

**Files to Review:**
- `backend/utils/cache.py` - TTLCache implementation

### 16. Database Resilience
```
Check for:
- [ ] Connection pooling
- [ ] Connection timeout handling
- [ ] Query timeout handling
- [ ] Retry on transient failures
- [ ] Read replica usage (if applicable)
- [ ] Connection leak prevention
```

## Failure Scenario Testing

### Test Each Scenario:
```
1. Single LLM provider down
   - Expected: Other 4 respond, degraded but functional

2. All LLM providers slow
   - Expected: Timeout, circuit breaker opens, error to user

3. Database unreachable
   - Expected: Health check fails, no new requests accepted

4. Mid-stream failure
   - Expected: Client notified, resources cleaned up

5. Stripe webhook delayed
   - Expected: Idempotent processing when received

6. Cache full
   - Expected: Eviction works, no memory leak

7. Concurrent load spike
   - Expected: Rate limiting activates, graceful degradation
```

## SLO Definition

### Proposed SLOs:
```
Availability: 99.9% (8.7 hours downtime/year)
Latency p95: <5s for council queries
Latency p99: <10s for council queries
Error Rate: <0.1% of requests
```

## Output Format

### Resilience Score: [1-10]
### Observability Score: [1-10]

### Critical Resilience Gaps
| Component | Failure Scenario | Current Behavior | Required Behavior | Fix |
|-----------|------------------|------------------|-------------------|-----|

### Circuit Breaker Issues
| Service | Issue | Configuration Change |
|---------|-------|---------------------|

### Missing Observability
| Type | What's Missing | Implementation |
|------|----------------|----------------|

### Partial Failure Risks
| Stage | Failure Mode | State Corruption Risk | Mitigation |
|-------|--------------|----------------------|------------|

### Health Check Gaps
| Check | Missing | Priority |
|-------|---------|----------|

### Alerting Gaps
| Condition | Alert Needed | Threshold |
|-----------|--------------|-----------|

### SLO Readiness
| SLO | Current Capability | Gap |
|-----|-------------------|-----|

### Failure Scenario Test Results
| Scenario | Pass/Fail | Issue |
|----------|-----------|-------|

### Recommendations Priority
1. **Critical** (System can fail silently)
2. **High** (Degraded visibility or recovery)
3. **Medium** (Operational efficiency)

---

Remember: Hope is not a strategy. Every failure mode must be handled explicitly. If it can fail, it will fail.
