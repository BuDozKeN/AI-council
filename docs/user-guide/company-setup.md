# Company Setup Guide

This guide explains how to configure your company context for personalized AI council responses.

---

## Why Add Company Context?

Without context, the AI council gives generic advice. With your company context:

| Without Context | With Context |
|-----------------|--------------|
| "You should consider A/B testing" | "Given your 12-month runway, prioritize quick wins over complex experiments" |
| "Hire a marketing team" | "With your 5-person team, focus on founder-led sales first" |
| "Build a mobile app" | "Your SMB customers primarily use desktop - invest there first" |

---

## Creating Your Company

### Step 1: Access My Company

1. Click **My Company** in the top navigation
2. Or click the **building icon** in the input bar → **+ Add Company**

### Step 2: Basic Information

Fill in the essentials:

| Field | Description | Example |
|-------|-------------|---------|
| Name | Your company name | "TechStart Inc" |
| Slug | URL-friendly identifier | "techstart" |
| Industry | Your sector | "B2B SaaS" |

### Step 3: Company Context

This is the most important part. Write a comprehensive description that includes:

```markdown
## Company Overview
[What you do, who you serve, your mission]

## Stage & Metrics
[Funding stage, revenue, team size, key numbers]

## Target Market
[Who you sell to, ICP, segments]

## Competitive Landscape
[Key competitors, your differentiation]

## Current Challenges
[What you're trying to solve]

## Constraints
[Budget, time, resources, limitations]

## Goals
[What success looks like]
```

---

## Writing Great Context

### Example: Early-Stage Startup

```markdown
## Company Overview
CloudSync is a B2B SaaS platform that helps remote teams sync files
across multiple cloud storage providers (Google Drive, Dropbox, OneDrive).
Founded in 2024, we're solving the "files everywhere" problem for
distributed teams.

## Stage & Metrics
- Pre-seed: $750K raised from angels
- MRR: $8,000 (80 paying customers)
- Team: 6 people (3 eng, 1 design, 1 sales, 1 founder/CEO)
- Runway: 14 months at current burn

## Target Market
- Primary: Remote-first companies, 20-200 employees
- Secondary: Agencies and consulting firms
- ICP: IT managers or Ops leads frustrated with file sprawl

## Competitive Landscape
- Direct: MultCloud, CloudHQ (older, enterprise-focused)
- Indirect: Native sync solutions from Google/Microsoft
- Our edge: Better UX, faster sync, team collaboration features

## Current Challenges
1. Converting free trial users to paid (currently 12%)
2. Reducing churn (8% monthly)
3. Finding scalable acquisition channels

## Constraints
- Can't outspend competitors on ads
- Limited engineering bandwidth for new features
- Must maintain SOC 2 compliance for enterprise deals

## Goals (Next 6 Months)
- Hit $25K MRR
- Reduce churn to 5%
- Close 3 enterprise pilots
```

### Example: Established Company

```markdown
## Company Overview
DataFlow Analytics is a mid-market business intelligence platform.
We help companies turn raw data into actionable dashboards without
needing a data team. 8 years in business, profitable since year 3.

## Stage & Metrics
- Series B: $40M raised, $15M ARR
- 150 employees across US and EU
- 500+ enterprise customers
- Net revenue retention: 115%

## Target Market
- Mid-market companies ($10M-$500M revenue)
- Industries: Manufacturing, Healthcare, Retail
- Buyer: VP of Operations or CFO

## Competitive Landscape
- Enterprise: Tableau, Power BI, Looker
- SMB: Metabase, Mode
- Our position: Best for mid-market (enterprise features, SMB pricing)

## Current Challenges
1. Breaking into enterprise segment
2. International expansion (EMEA)
3. Product differentiation as competitors add AI features

## Strategic Priorities
1. Launch AI-powered insights feature Q2
2. Open London office Q3
3. Achieve SOC 2 Type II certification
```

---

## Departments

Departments let you segment your council for specialized contexts.

### Default Departments

| Department | Best For |
|------------|----------|
| Executive | Strategy, board prep, M&A, leadership |
| Marketing | Campaigns, messaging, positioning, content |
| Sales | Deal strategy, proposals, objection handling |
| Legal | Contracts, compliance, risk assessment |
| Product | Roadmap, prioritization, user research |
| Engineering | Architecture, technical decisions, tooling |

### Creating a Department

1. Go to **My Company** → **Team** tab
2. Click **+ Add Department**
3. Fill in:
   - **Name**: Department name
   - **Context**: Department-specific information

### Department Context Example

```markdown
## Marketing Department

### Team
- CMO: Sarah Chen
- Content Lead: Mike Rodriguez
- Demand Gen: Jennifer Park

### Current Focus
- Q1: Product launch campaign
- Q2: Partner marketing program

### Brand Guidelines
- Voice: Professional but approachable
- Tone: Confident, not arrogant
- No: Jargon, buzzwords, "synergy"

### Active Campaigns
- Product Hunt launch (March 15)
- Webinar series (ongoing)
- Case study initiative

### Metrics We Track
- MQLs per month (target: 500)
- Content engagement rate (target: 5%)
- Webinar attendance (target: 100/session)
```

---

## Roles

Roles define AI personas within departments.

### How Roles Work

Each role has a **system prompt** that shapes how that AI expert responds:

| Role | Perspective |
|------|-------------|
| CEO | Strategic, long-term, resource allocation |
| CFO | Financial impact, ROI, risk |
| CMO | Brand, market position, customer perception |
| CTO | Technical feasibility, scalability, security |
| Legal Counsel | Risk, compliance, liability |

### Customizing Role Prompts

1. Go to **My Company** → **Team** tab
2. Select a department
3. Click on a role to edit
4. Modify the **System Prompt**

### Example Role Prompt

```markdown
You are the Chief Marketing Officer of {{company_name}}.

Your perspective focuses on:
- Brand positioning and market perception
- Customer acquisition and retention strategies
- Competitive differentiation
- Marketing ROI and attribution

When analyzing decisions, consider:
- How will this affect our brand?
- What's the customer perception impact?
- How do we communicate this to the market?
- What's the marketing investment required?

Your communication style:
- Data-informed but not data-paralyzed
- Customer-centric language
- Focus on market opportunity
- Clear, jargon-free explanations
```

---

## Best Practices

### Keep Context Current

- Update metrics monthly
- Add new challenges as they arise
- Remove outdated information
- Mark seasonal priorities

### Be Honest About Constraints

The council gives better advice when it knows your real limitations:

```markdown
## Constraints (Be Honest)
- Budget: $10K/month for marketing
- Team: No dedicated designer
- Time: Need results in 30 days
- Technical: Legacy codebase limits changes
```

### Layer Your Context

1. **Company**: Universal context (always included)
2. **Department**: Added when department selected
3. **Project**: Specific initiative context
4. **Playbooks**: Reusable frameworks and processes

---

## Troubleshooting

### Context Not Applied

1. Check that you've **saved** the context (not just typed)
2. Verify the company is **selected** in the input bar
3. Refresh the page if changes don't appear

### Context Too Long

If you hit length limits:
1. Move detailed info to **playbooks** (auto-injected as needed)
2. Keep company context high-level
3. Use department context for specifics

### Multiple Companies

You can create multiple companies for:
- Different business units
- Client work (agencies)
- Side projects
- Testing/sandbox

Switch between them using the company selector.

---

## Next Steps

- [Create Playbooks](./playbooks.md) for reusable frameworks
- [Save Decisions](./decisions.md) to build knowledge
- [Best Practices](./best-practices.md) for power users
