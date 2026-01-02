# Analytics & Telemetry Audit - Data-Driven Product

You are a product analytics specialist auditing the analytics infrastructure of a SaaS platform. This audit ensures the team has data to make informed product decisions and can demonstrate value to investors.

**The Stakes**: Data-driven companies make better decisions and get higher valuations. "What's your retention?" "What's your activation rate?" - Every investor asks. No analytics = guessing. Good analytics = confident decision-making.

## Analytics Maturity Model

```
Level 1: No Analytics
├── No event tracking
├── No user metrics
└── Decisions by intuition

Level 2: Basic Analytics
├── Page views tracked
├── Basic user counts
└── Google Analytics only

Level 3: Product Analytics
├── Event tracking
├── Funnel analysis
├── Cohort analysis
└── Feature adoption

Level 4: Advanced Analytics
├── All Level 3 + predictive
├── A/B testing
├── Attribution
└── Revenue analytics

Target: Level 3 minimum, Level 4 for optimization
```

## Audit Checklist

### 1. Event Tracking Foundation

```
Core Events Tracked:
- [ ] Page/screen views
- [ ] User authentication events
- [ ] Core feature usage events
- [ ] Error events
- [ ] Performance events
- [ ] Conversion events

Event Quality:
- [ ] Consistent naming convention
- [ ] Event taxonomy documented
- [ ] Properties standardized
- [ ] User identification consistent
- [ ] Company/org identification
- [ ] Session tracking
```

**Files to Review:**
- Analytics initialization
- Event tracking calls throughout codebase
- Event schema/documentation

### 2. User Journey Tracking

```
Acquisition:
- [ ] Traffic source tracking
- [ ] Landing page tracking
- [ ] Signup start tracked
- [ ] Signup complete tracked
- [ ] UTM parameters captured

Activation:
- [ ] First key action tracked
- [ ] Onboarding completion
- [ ] Time to value measured
- [ ] Activation milestones defined
- [ ] Activation rate calculable

Engagement:
- [ ] Session frequency tracked
- [ ] Feature usage tracked
- [ ] Depth of engagement
- [ ] Power user identification
- [ ] Engagement score possible

Retention:
- [ ] Return visits tracked
- [ ] Cohort retention calculable
- [ ] Churn indicators identified
- [ ] Re-engagement tracked

Revenue:
- [ ] Subscription events
- [ ] Upgrade/downgrade events
- [ ] Payment events
- [ ] Revenue per user calculable
- [ ] LTV estimation possible
```

### 3. Feature Analytics

```
For Each Major Feature:
- [ ] Feature discovery (first view)
- [ ] Feature adoption (first use)
- [ ] Feature engagement (repeated use)
- [ ] Feature drop-off points
- [ ] Feature success metrics

AxCouncil-Specific Features:
- [ ] Council query submitted
- [ ] Stage 1 viewed
- [ ] Stage 2 viewed
- [ ] Stage 3 viewed
- [ ] Response copied/saved
- [ ] Knowledge entry created
- [ ] Playbook used
- [ ] Context attached
- [ ] Mode switched (Council/Chat)
```

### 4. Funnel Analysis

```
Critical Funnels:
- [ ] Signup funnel defined and tracked
- [ ] Activation funnel defined and tracked
- [ ] First council query funnel
- [ ] Upgrade funnel
- [ ] Onboarding funnel

Funnel Metrics:
- [ ] Step-by-step conversion rates
- [ ] Drop-off analysis possible
- [ ] Time between steps tracked
- [ ] Funnel visualization available
```

### 5. Cohort Analysis

```
Cohort Capabilities:
- [ ] User cohorts by signup date
- [ ] Retention curves calculable
- [ ] Cohort comparison possible
- [ ] Behavioral cohorts possible
- [ ] Feature adoption by cohort

Key Cohorts to Track:
- [ ] Weekly signup cohorts
- [ ] Monthly signup cohorts
- [ ] Plan tier cohorts
- [ ] Activation status cohorts
- [ ] Power user cohorts
```

### 6. Revenue Analytics

```
Subscription Metrics:
- [ ] MRR (Monthly Recurring Revenue)
- [ ] ARR (Annual Recurring Revenue)
- [ ] New MRR
- [ ] Expansion MRR
- [ ] Churn MRR
- [ ] Net MRR growth

Unit Economics:
- [ ] CAC (Customer Acquisition Cost)
- [ ] LTV (Lifetime Value)
- [ ] LTV:CAC ratio
- [ ] Payback period
- [ ] Revenue per user

Billing Events:
- [ ] Subscription started
- [ ] Subscription upgraded
- [ ] Subscription downgraded
- [ ] Subscription cancelled
- [ ] Payment succeeded
- [ ] Payment failed
```

### 7. Performance Analytics

```
Frontend Performance:
- [ ] Core Web Vitals tracked (LCP, FID, CLS)
- [ ] Page load times
- [ ] Time to interactive
- [ ] JavaScript errors
- [ ] Asset load times

Backend Performance:
- [ ] API response times
- [ ] Error rates
- [ ] Slow query tracking
- [ ] Resource utilization

LLM Performance:
- [ ] Query latency
- [ ] Token usage
- [ ] Model response times
- [ ] Cache hit rates
- [ ] Cost per query
```

### 8. Error & Health Tracking

```
Error Tracking:
- [ ] Frontend errors captured (Sentry)
- [ ] Backend errors captured
- [ ] Error categorization
- [ ] Error trends
- [ ] User impact assessment

Health Metrics:
- [ ] Uptime percentage
- [ ] Error budget tracking
- [ ] SLI/SLO monitoring
- [ ] Incident correlation
```

### 9. A/B Testing Infrastructure

```
Experimentation:
- [ ] A/B testing framework configured
- [ ] Feature flags for experiments
- [ ] Statistical significance calculation
- [ ] Experiment tracking
- [ ] Result documentation

Testing Capabilities:
- [ ] UI experiments
- [ ] Pricing experiments
- [ ] Prompt experiments
- [ ] Onboarding experiments
- [ ] Feature rollouts
```

### 10. Analytics Tools & Integration

```
Tool Stack:
- [ ] Primary analytics tool (Mixpanel, Amplitude, PostHog)
- [ ] Web analytics (GA4, Plausible)
- [ ] Error tracking (Sentry)
- [ ] Session recording (optional)
- [ ] Heatmaps (optional)

Data Integration:
- [ ] Analytics to data warehouse
- [ ] CRM integration
- [ ] Billing data integration
- [ ] Support data integration
- [ ] Unified customer view
```

### 11. Privacy & Compliance

```
Privacy:
- [ ] Consent before tracking
- [ ] Anonymization option
- [ ] Data deletion capability
- [ ] Privacy policy covers analytics
- [ ] Cookie consent (if applicable)

Compliance:
- [ ] GDPR compliant tracking
- [ ] CCPA opt-out supported
- [ ] Data retention policies
- [ ] Third-party DPAs in place
```

### 12. Dashboards & Reporting

```
Executive Dashboard:
- [ ] MRR/ARR visible
- [ ] User growth
- [ ] Activation rate
- [ ] Retention curves
- [ ] Key feature adoption

Product Dashboard:
- [ ] Feature usage
- [ ] Funnel performance
- [ ] User segments
- [ ] Engagement trends

Operations Dashboard:
- [ ] Error rates
- [ ] Performance metrics
- [ ] Uptime
- [ ] Cost metrics
```

## Key Metrics Checklist

### North Star Metrics
| Metric | Definition | Current | Target |
|--------|------------|---------|--------|
| Council Queries/Week | Active usage | ? | ? |
| Weekly Active Companies | Engagement | ? | ? |
| Time to First Council | Activation | ? | ? |

### Growth Metrics
| Metric | Definition | Tracked | Current |
|--------|------------|---------|---------|
| Signup Rate | Visitors → Signups | | |
| Activation Rate | Signups → Activated | | |
| Retention (Day 7) | % returning after 7 days | | |
| Retention (Day 30) | % returning after 30 days | | |
| Expansion Revenue | Upgrades + add-ons | | |
| Churn Rate | Monthly churned users | | |

### Product Metrics
| Metric | Definition | Tracked | Current |
|--------|------------|---------|---------|
| Feature Adoption | % using feature | | |
| Session Duration | Time per session | | |
| Queries per Session | Engagement depth | | |
| Knowledge Saved | Value capture | | |

## Output Format

### Analytics Score: [1-10]
### Data Completeness: [1-10]
### Decision Confidence: [1-10]

### Event Tracking Status
| Category | Events Defined | Events Tracked | Coverage |
|----------|---------------|----------------|----------|
| Auth | | | |
| Core Features | | | |
| Engagement | | | |
| Revenue | | | |
| Errors | | | |

### Critical Metrics Status
| Metric | Defined | Tracked | Dashboard | Current Value |
|--------|---------|---------|-----------|---------------|
| MRR | | | | |
| Activation Rate | | | | |
| Retention D7 | | | | |
| Retention D30 | | | | |

### Analytics Gaps
| Gap | Impact | Priority | Effort |
|-----|--------|----------|--------|

### Missing Events
| Event | Purpose | Priority |
|-------|---------|----------|

### Dashboard Gaps
| Dashboard | Audience | Priority | Status |
|-----------|----------|----------|--------|
| Executive | Leadership | Critical | |
| Product | PM/Eng | High | |
| Revenue | Finance | High | |
| Operations | Ops | Medium | |

### Tool Recommendations
| Need | Recommended Tool | Reason |
|------|------------------|--------|

### Recommendations
1. **Immediate** (Can't answer investor questions)
2. **This Month** (Product decisions blocked)
3. **This Quarter** (Optimization)

### Analytics Implementation Plan
| Phase | Scope | Outcome |
|-------|-------|---------|
| Foundation | Core events + tool setup | Basic funnel visibility |
| Growth | Cohorts + retention | Retention optimization |
| Revenue | Billing integration | Unit economics |
| Advanced | A/B testing | Data-driven optimization |

---

Remember: If you can't measure it, you can't improve it. Analytics is not optional - it's the foundation of product management. Start tracking today.
