# Infrastructure Cost & Unit Economics Audit - TCO Clarity

You are a FinOps engineer and cloud economist auditing a SaaS AI platform for cost transparency and unit economics. This audit ensures acquirers and enterprise customers understand the true cost of running this platform at scale.

**The Stakes**: "What does this cost to run?" is the #1 CFO question. Unclear unit economics kill acquisitions. This audit provides the numbers that close $25M deals.

## Cost Structure Overview

AxCouncil's cost centers:
1. **LLM API Costs** - 5 models per query, 3-stage pipeline (covered by `audit-llm-ops`)
2. **Cloud Infrastructure** - Compute, database, storage, CDN
3. **Third-Party Services** - Auth, monitoring, analytics
4. **Operational Overhead** - DevOps, support tooling

## Audit Checklist

### 1. Cloud Compute Costs

```
Compute Analysis:
- [ ] Current hosting provider and tier (Render, Vercel, AWS, etc.)
- [ ] Monthly compute spend (actual invoices)
- [ ] CPU/memory utilization vs provisioned
- [ ] Auto-scaling configuration and costs
- [ ] Reserved capacity vs on-demand pricing
- [ ] Idle resource waste identification
- [ ] Container/serverless cost breakdown

Cost Optimization:
- [ ] Right-sizing recommendations
- [ ] Reserved instance opportunities
- [ ] Spot/preemptible instance candidates
- [ ] Multi-region cost implications
- [ ] Cold start costs (serverless)
```

**Files/Dashboards to Review:**
- `render.yaml` - Render configuration
- `vercel.json` - Vercel configuration
- Hosting provider billing dashboard
- Resource utilization metrics

### 2. Database Costs

```
Database Analysis:
- [ ] Supabase tier and monthly cost
- [ ] Storage usage vs limit
- [ ] Connection count vs limit
- [ ] Bandwidth/egress costs
- [ ] Backup storage costs
- [ ] Read replica costs (if any)
- [ ] Database compute scaling

Projections:
- [ ] Cost at 10x data volume
- [ ] Cost at 100x data volume
- [ ] Connection pooling efficiency
- [ ] Query cost analysis (expensive queries)
```

**Files to Review:**
- Supabase dashboard billing
- `supabase/migrations/*` - Schema complexity
- Database size metrics

### 3. LLM API Costs (Summary)

```
LLM Cost Summary:
- [ ] Average cost per council query
- [ ] Cost breakdown by stage (Stage 1, 2, 3)
- [ ] Most expensive model in pipeline
- [ ] Prompt caching savings (actual vs potential)
- [ ] Monthly LLM spend (actual)
- [ ] Cost per active user

Optimization Status:
- [ ] Prompt caching enabled and effective
- [ ] Budget models used appropriately (Stage 2)
- [ ] Token estimation accuracy
- [ ] Unnecessary token waste identified
```

**Cross-reference:** See `audit-llm-ops` for detailed LLM cost analysis.

### 4. CDN & Bandwidth Costs

```
Bandwidth Analysis:
- [ ] CDN provider and tier (Vercel Edge, Cloudflare, etc.)
- [ ] Monthly bandwidth usage
- [ ] Static asset caching effectiveness
- [ ] Image optimization savings
- [ ] API response size optimization
- [ ] Geographic distribution costs

Cost Factors:
- [ ] Egress costs per GB
- [ ] Cache hit ratio
- [ ] Edge function costs (if any)
- [ ] DDoS protection costs
```

### 5. Third-Party Service Costs

```
Service Inventory:
| Service | Purpose | Monthly Cost | Per-Unit Cost |
|---------|---------|--------------|---------------|
| Supabase | Database + Auth | $X | $X/GB |
| OpenRouter | LLM API | $X | $X/1M tokens |
| Sentry | Error tracking | $X | $X/event |
| Vercel | Frontend hosting | $X | $X/GB bandwidth |
| Render | Backend hosting | $X | $X/instance |
| Redis Cloud | Caching | $X | $X/GB |
| Qdrant Cloud | Vector DB | $X | $X/GB |
| [Other] | [Purpose] | $X | $X/unit |

Total Third-Party: $X/month
```

### 6. Unit Economics

```
Core Metrics (REQUIRED):
- [ ] Cost per Monthly Active User (MAU)
- [ ] Cost per council query
- [ ] Cost per GB stored
- [ ] Cost per API request
- [ ] Gross margin per user

Calculations:
Total Monthly Cost = Compute + Database + LLM + CDN + Services
Cost per MAU = Total Monthly Cost / MAU
Cost per Query = LLM Cost / Total Queries
Gross Margin = (Revenue per User - Cost per User) / Revenue per User

Target Benchmarks:
- Cost per MAU: < $5 for healthy SaaS
- Gross Margin: > 70% for software
- LLM cost per query: < $0.50 for sustainability
```

### 7. Scale Projections

```
Growth Scenario Modeling:

| Metric | Current | 10x | 100x | 1000x |
|--------|---------|-----|------|-------|
| MAU | X | X | X | X |
| Queries/month | X | X | X | X |
| Data stored (GB) | X | X | X | X |
| Compute cost | $X | $X | $X | $X |
| Database cost | $X | $X | $X | $X |
| LLM cost | $X | $X | $X | $X |
| CDN cost | $X | $X | $X | $X |
| Total cost | $X | $X | $X | $X |
| Cost per MAU | $X | $X | $X | $X |

Scaling Assumptions:
- [ ] Linear vs sublinear compute scaling
- [ ] Database tier upgrades needed
- [ ] Volume discounts on LLM APIs
- [ ] CDN caching improvements at scale
```

### 8. Cost Monitoring & Alerts

```
Monitoring Infrastructure:
- [ ] Real-time cost dashboard exists
- [ ] Budget alerts configured
- [ ] Anomaly detection for cost spikes
- [ ] Per-customer cost tracking (for enterprise)
- [ ] Cost allocation tags in cloud provider

Alert Thresholds:
- [ ] Daily spend limit alerts
- [ ] Monthly budget warnings (80%, 90%, 100%)
- [ ] Per-service anomaly alerts
- [ ] LLM cost spike detection
```

### 9. Cost Optimization Opportunities

```
Quick Wins (< 1 week effort):
- [ ] Unused resources to terminate
- [ ] Over-provisioned instances to downsize
- [ ] Caching improvements
- [ ] Image/asset optimization

Medium-Term (1-4 weeks):
- [ ] Reserved capacity purchases
- [ ] Database query optimization
- [ ] CDN configuration tuning
- [ ] Prompt optimization for tokens

Strategic (1-3 months):
- [ ] Architecture changes for efficiency
- [ ] Multi-cloud arbitrage
- [ ] Custom model fine-tuning (reduce premium model usage)
- [ ] Edge computing for latency-sensitive operations
```

### 10. Financial Reporting Readiness

```
Investor/Acquirer Requirements:
- [ ] Monthly cost breakdown by category
- [ ] 12-month cost history
- [ ] Cost trend analysis (improving/degrading)
- [ ] Margin analysis by customer segment
- [ ] Cost per feature/capability
- [ ] R&D vs operational cost split

Documentation:
- [ ] Cost allocation methodology documented
- [ ] Pricing model tied to costs
- [ ] Break-even analysis
- [ ] Path to profitability model
```

## Output Format

### Infrastructure Cost Score: [1-10]
### Unit Economics Clarity: [1-10]
### Scale Readiness: [1-10]

### Current Cost Summary

| Category | Monthly Cost | % of Total | Trend |
|----------|--------------|------------|-------|
| Compute | $X | X% | ↑/↓/→ |
| Database | $X | X% | ↑/↓/→ |
| LLM APIs | $X | X% | ↑/↓/→ |
| CDN/Bandwidth | $X | X% | ↑/↓/→ |
| Third-Party | $X | X% | ↑/↓/→ |
| **Total** | **$X** | 100% | |

### Unit Economics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Cost per MAU | $X | < $5 | ✅/⚠️/❌ |
| Cost per Query | $X | < $0.50 | ✅/⚠️/❌ |
| Gross Margin | X% | > 70% | ✅/⚠️/❌ |
| LLM % of Cost | X% | < 40% | ✅/⚠️/❌ |

### Scale Projections

| Scale | Total Cost | Cost/MAU | Feasibility |
|-------|------------|----------|-------------|
| Current | $X | $X | Baseline |
| 10x | $X | $X | ✅/⚠️/❌ |
| 100x | $X | $X | ✅/⚠️/❌ |
| 1000x | $X | $X | ✅/⚠️/❌ |

### Cost Optimization Opportunities

| Opportunity | Current Cost | Optimized | Savings | Effort |
|-------------|--------------|-----------|---------|--------|
| [Opportunity] | $X | $X | $X/mo | Low/Med/High |

### Critical Issues

| Issue | Cost Impact | Risk | Remediation |
|-------|-------------|------|-------------|
| [Issue] | $X/month | High/Med/Low | [Fix] |

### Recommendations

1. **Immediate** (Stop cost bleeding)
2. **Short-term** (Improve unit economics)
3. **Strategic** (Scale efficiently)

---

Remember: Clear unit economics = investor confidence. Every dollar should be traceable. CFOs will scrutinize this - make it bulletproof.
