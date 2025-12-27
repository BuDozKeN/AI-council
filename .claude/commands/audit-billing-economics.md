# Billing & Economics Audit - Revenue Protection & Cost Control

You are a fintech billing systems engineer auditing a SaaS subscription platform. This audit ensures revenue is protected, costs are controlled, and the billing system is abuse-resistant.

**The Stakes**: Billing bugs mean lost revenue or angry customers. At $25M valuation, every dollar matters.

## Billing Architecture Context

AxCouncil's Billing Model:
- **Free Tier**: 5 queries/month
- **Pro Tier**: 100 queries/month
- **Enterprise**: Unlimited queries
- **Payment**: Stripe integration
- **Metering**: Query-based (not token-based)

## Audit Checklist

### 1. Query Counting Accuracy
```
Check for:
- [ ] Atomic increment (PostgreSQL function vs application code)
- [ ] No double-counting on retries
- [ ] No counting on failed queries
- [ ] Count only after successful completion
- [ ] Count visible to user in real-time
- [ ] Period reset handling (monthly)
- [ ] Timezone handling for period boundaries
```

**Files to Review:**
- `backend/utils/` - Query increment logic
- `supabase/migrations/20251224110000_*.sql` - increment_query_usage function
- `backend/routers/billing.py` - Usage tracking

### 2. Tier Limit Enforcement
```
Check for:
- [ ] Pre-query limit check (before LLM calls)
- [ ] Atomic check-and-increment (no race condition)
- [ ] Clear error message when limit reached
- [ ] Grace period handling (if any)
- [ ] Upgrade prompt at limit
- [ ] No bypass via API manipulation
- [ ] Limit check on all query paths
```

### 3. Cost vs Revenue Analysis
```
Check for:
- [ ] Token cost tracking per query
- [ ] Model cost breakdown
- [ ] Average cost per tier
- [ ] Margin calculation (revenue - cost)
- [ ] Unprofitable query patterns
- [ ] Cost per stage (Stage 1/2/3)
```

**Economic Model:**
```
Free Tier: 5 queries × $X cost = $Y loss (acquisition cost)
Pro Tier: $29/month ÷ 100 queries = $0.29/query budget
Enterprise: Custom pricing vs actual usage

Calculate: Is Pro tier profitable at 100 queries/month?
```

### 4. Stripe Integration Security
```
Check for:
- [ ] Webhook signature verification
- [ ] Event idempotency (no duplicate processing)
- [ ] Subscription status sync
- [ ] Payment failure handling
- [ ] Dunning management (retry failed payments)
- [ ] Subscription cancellation flow
- [ ] Refund handling
- [ ] Stripe customer ID stored securely
```

**Files to Review:**
- `backend/routers/billing.py` - Webhook handlers
- Event types: checkout.session.completed, customer.subscription.*, invoice.*

### 5. Webhook Reliability
```
Check for:
- [ ] Idempotency key storage and checking
- [ ] Retry handling from Stripe
- [ ] Failure logging and alerting
- [ ] Event ordering handling
- [ ] Missing event detection
- [ ] Webhook endpoint security (HTTPS, signature)
```

### 6. Subscription State Management
```
Check for:
- [ ] Status transitions (active → past_due → canceled)
- [ ] Grace period for past_due
- [ ] Feature access during past_due
- [ ] Reactivation flow
- [ ] Downgrade handling (Pro → Free)
- [ ] Upgrade proration
- [ ] Trial period handling (if any)
```

### 7. Abuse Prevention
```
Check for:
- [ ] Rate limiting on free tier (beyond query count)
- [ ] Account creation limits (prevent farm accounts)
- [ ] Query size limits
- [ ] API key abuse detection
- [ ] Multiple account detection
- [ ] Referral/promo code abuse
- [ ] Chargeback monitoring
```

### 8. BYOK (Bring Your Own Key) Economics
```
Check for:
- [ ] BYOK tier pricing strategy
- [ ] Key validation before use
- [ ] Usage still tracked (for analytics)
- [ ] Cost passthrough to user
- [ ] Key security (encryption at rest)
- [ ] Key rotation support
```

### 9. Usage Analytics
```
Check for:
- [ ] Query volume by tier
- [ ] Peak usage patterns
- [ ] Conversion funnel (Free → Pro)
- [ ] Churn indicators
- [ ] Feature usage correlation
- [ ] Revenue per user metrics
```

### 10. Tax & Compliance
```
Check for:
- [ ] Tax ID collection (VAT, GST)
- [ ] Tax rate application by region
- [ ] Invoice generation
- [ ] Receipt delivery
- [ ] Tax reporting capability
- [ ] B2B vs B2C handling
```

### 11. Billing UI/UX
```
Check for:
- [ ] Clear pricing display
- [ ] Usage meter visibility
- [ ] Upgrade prompts at right moments
- [ ] Payment method management
- [ ] Invoice history access
- [ ] Cancellation flow friction (not too easy, not too hard)
```

### 12. Revenue Protection
```
Check for:
- [ ] No free tier abuse paths
- [ ] Paid features properly gated
- [ ] API access requires valid subscription
- [ ] No session hijacking for tier benefits
- [ ] Webhook failures don't grant free access
- [ ] Subscription verification on critical operations
```

## Financial Model Validation

### Query Cost Estimation
```
Per Query Cost (5 models):
Stage 1: 5 × (input_tokens × price + output_tokens × price)
Stage 2: 5 × (input_tokens × price + output_tokens × price)
Stage 3: 1 × (input_tokens × price + output_tokens × price)

Estimate with:
- Average input: ~2000 tokens
- Average output: ~1000 tokens per model
- Model prices: Check OpenRouter pricing
```

### Margin Analysis
```
Free Tier:
- Revenue: $0
- Cost: 5 queries × avg_cost
- Margin: Negative (acquisition cost)

Pro Tier ($29/month):
- Revenue: $29
- Cost: 100 queries × avg_cost
- Target Margin: >50%

Is this sustainable?
```

## Output Format

### Billing Security Score: [1-10]
### Revenue Protection Score: [1-10]

### Critical Billing Vulnerabilities
| Issue | Revenue Impact | Exploit Scenario | Fix |
|-------|----------------|------------------|-----|

### Query Counting Issues
| Issue | Impact | Fix |
|-------|--------|-----|

### Stripe Integration Gaps
| Webhook/Feature | Issue | Risk | Fix |
|-----------------|-------|------|-----|

### Abuse Vectors
| Attack | Prevention Status | Recommendation |
|--------|-------------------|----------------|

### Economic Analysis
| Tier | Revenue | Est. Cost | Margin | Sustainable |
|------|---------|-----------|--------|-------------|

### Missing Billing Features
| Feature | Business Impact | Priority |
|---------|-----------------|----------|

### Revenue Leakage Points
| Leakage | Est. Monthly Loss | Fix Effort |
|---------|-------------------|------------|

### Recommendations Priority
1. **Critical** (Revenue loss or abuse)
2. **High** (Billing accuracy)
3. **Medium** (Analytics and optimization)

---

Remember: Billing is trust. One wrong charge and you lose a customer forever. One abuse loophole and you bleed money.
