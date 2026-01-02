# Legal & Compliance Audit - Enterprise Regulatory Readiness

You are a compliance officer and legal technology advisor auditing a SaaS AI platform for regulatory compliance. This audit must ensure the platform can pass legal due diligence for a $25M+ acquisition and enterprise sales cycles.

**The Stakes**: One compliance gap can kill an acquisition. Enterprise customers require documented compliance. This audit ensures legal readiness across all major jurisdictions.

## Regulatory Framework Overview

AxCouncil processes:
- Business strategy queries (potentially confidential)
- Company context documents (trade secrets, internal policies)
- AI-generated advice (liability considerations)
- User authentication data (PII)
- Payment information (PCI considerations)

## Audit Checklist

### 1. GDPR Compliance (EU General Data Protection Regulation)

```
Article 5 - Data Principles:
- [ ] Lawfulness, fairness, transparency - clear legal basis for processing
- [ ] Purpose limitation - data used only for stated purposes
- [ ] Data minimization - only necessary data collected
- [ ] Accuracy - mechanisms to keep data current
- [ ] Storage limitation - retention policies defined
- [ ] Integrity & confidentiality - security measures documented

Article 6 - Legal Basis:
- [ ] Consent mechanism for data processing
- [ ] Legitimate interest assessment documented
- [ ] Contract necessity for core features
- [ ] Legal obligations identified

Article 7 - Consent:
- [ ] Freely given, specific, informed, unambiguous
- [ ] Easy withdrawal mechanism
- [ ] Consent records maintained
- [ ] Age verification (if applicable)

Articles 12-22 - Data Subject Rights:
- [ ] Right to access (Article 15) - export user data
- [ ] Right to rectification (Article 16) - edit personal data
- [ ] Right to erasure (Article 17) - delete account completely
- [ ] Right to data portability (Article 20) - standard format export
- [ ] Right to object (Article 21) - opt-out of processing
- [ ] Automated decision-making disclosure (Article 22)

Articles 24-32 - Controller Obligations:
- [ ] Data protection by design and default
- [ ] Records of processing activities (ROPA)
- [ ] Data Protection Impact Assessment (DPIA) for AI
- [ ] Data breach notification procedures (72-hour rule)

Articles 44-49 - International Transfers:
- [ ] Standard Contractual Clauses (SCCs) for US→EU
- [ ] Supabase data processing locations documented
- [ ] OpenRouter/LLM provider data flows mapped
- [ ] Transfer Impact Assessment completed
```

**Files to Review:**
- Privacy Policy (website/app)
- Terms of Service
- Cookie Policy
- `backend/auth.py` - User data handling
- `supabase/migrations/*` - Data schema
- Account deletion functionality

### 2. CCPA/CPRA Compliance (California Consumer Privacy Act)

```
Consumer Rights:
- [ ] Right to know - what data is collected
- [ ] Right to delete - account deletion functionality
- [ ] Right to opt-out of sale - "Do Not Sell" link (if applicable)
- [ ] Right to non-discrimination - equal service regardless of opt-out
- [ ] Right to correct - data correction mechanism
- [ ] Right to limit use of sensitive data

Business Obligations:
- [ ] Privacy policy updated within 12 months
- [ ] "Notice at Collection" - what data collected at point of collection
- [ ] Data inventory - catalog of all personal information
- [ ] Vendor contracts - service provider agreements
- [ ] Opt-out mechanisms - clear UI for opting out
- [ ] Employee training documentation
- [ ] Annual security audits documented
```

### 3. SOC 2 Type II Readiness

```
Trust Service Criteria:

SECURITY:
- [ ] Logical and physical access controls
- [ ] System operations monitoring
- [ ] Change management procedures
- [ ] Risk mitigation strategies
- [ ] Incident response plan

AVAILABILITY:
- [ ] System uptime SLA defined
- [ ] Disaster recovery plan
- [ ] Backup procedures
- [ ] Capacity planning

PROCESSING INTEGRITY:
- [ ] Quality assurance procedures
- [ ] Error handling documentation
- [ ] Data validation rules
- [ ] Processing monitoring

CONFIDENTIALITY:
- [ ] Data classification policy
- [ ] Encryption standards
- [ ] Access control matrix
- [ ] NDA templates

PRIVACY:
- [ ] Privacy notice
- [ ] Consent mechanisms
- [ ] Data retention schedule
- [ ] Third-party disclosures
```

**Evidence Required:**
- Security policies document
- Access control logs
- Change management records
- Incident response playbook
- Business continuity plan

### 4. HIPAA Readiness (if health data)

```
If ANY health-related queries processed:
- [ ] Business Associate Agreement (BAA) template
- [ ] PHI handling procedures
- [ ] Minimum necessary standard
- [ ] Audit logging for PHI access
- [ ] Encryption at rest and in transit (mandatory)
- [ ] Security Risk Assessment
- [ ] Workforce training documentation
- [ ] Breach notification procedures
```

### 5. AI-Specific Regulations

```
EU AI Act Compliance:
- [ ] Risk classification of AI system (likely: limited risk)
- [ ] Transparency requirements - users know they're interacting with AI
- [ ] Human oversight mechanisms
- [ ] Technical documentation of AI system
- [ ] Quality management for training data (if any)
- [ ] Post-market monitoring plan

NIST AI Risk Management Framework:
- [ ] Map - identify AI risks
- [ ] Measure - assess and track risks
- [ ] Manage - prioritize and mitigate
- [ ] Govern - policies and procedures
```

### 6. Cookie & Tracking Compliance

```
ePrivacy/PECR Requirements:
- [ ] Cookie consent banner (not just notice)
- [ ] Granular cookie categories (necessary, analytics, marketing)
- [ ] Consent before non-essential cookies
- [ ] Easy cookie withdrawal
- [ ] Cookie policy with full list

Third-Party Scripts Audit:
- [ ] List all third-party scripts
- [ ] Data flows to third parties documented
- [ ] Consent for each third-party service
- [ ] Sub-processor list maintained
```

**Files to Review:**
- `frontend/index.html` - Third-party scripts
- Analytics configuration
- Sentry configuration
- Any marketing pixels

### 7. Terms of Service & Contracts

```
Terms of Service Review:
- [ ] Acceptable use policy
- [ ] Intellectual property rights (user content, AI output)
- [ ] Limitation of liability
- [ ] Indemnification clauses
- [ ] Dispute resolution mechanism
- [ ] Termination rights
- [ ] Governing law specified
- [ ] AI-specific disclaimers (advice is not professional counsel)

Data Processing Agreement (DPA) Template:
- [ ] Subprocessor list
- [ ] Data security measures
- [ ] Audit rights
- [ ] Data deletion requirements
- [ ] Breach notification obligations
- [ ] International transfer mechanisms

Enterprise Contract Readiness:
- [ ] Master Service Agreement (MSA) template
- [ ] Service Level Agreement (SLA) definitions
- [ ] Security addendum
- [ ] BAA template (for HIPAA customers)
- [ ] Insurance certificates (E&O, Cyber)
```

### 8. Financial Compliance

```
PCI DSS (if handling card data):
- [ ] Stripe handles all card processing (SAQ A eligible)
- [ ] No card data stored locally
- [ ] Secure redirect to Stripe Checkout
- [ ] No card data in logs

Anti-Money Laundering (AML):
- [ ] Customer identification (if B2B enterprise)
- [ ] Suspicious activity monitoring
- [ ] Record retention requirements

Revenue Recognition:
- [ ] GAAP/IFRS compliant billing
- [ ] Deferred revenue handling
- [ ] Refund policies documented
```

### 9. Accessibility Compliance

```
ADA / Section 508 / EN 301 549:
- [ ] WCAG 2.1 Level AA compliance (see a11y audit)
- [ ] Accessibility statement published
- [ ] Accessibility contact mechanism
- [ ] VPATs available for enterprise procurement
```

### 10. Data Residency & Sovereignty

```
Data Location Requirements:
- [ ] Primary data location documented (Supabase region)
- [ ] Backup data locations
- [ ] LLM API data flows (OpenRouter → model providers)
- [ ] CDN edge locations (if any)
- [ ] EU data residency option (for EU customers)
- [ ] Data localization for specific countries (Germany, China, Russia)

Cloud Provider Compliance:
- [ ] Supabase compliance certifications
- [ ] OpenRouter data handling policies
- [ ] Vercel/Render compliance (hosting)
```

## Process Audit

### Documentation Inventory

```
Required Documents:
- [ ] Privacy Policy
- [ ] Terms of Service
- [ ] Cookie Policy
- [ ] Acceptable Use Policy
- [ ] Data Processing Agreement (DPA)
- [ ] Security Whitepaper
- [ ] SOC 2 Report (or readiness assessment)
- [ ] Subprocessor List
- [ ] Data Retention Policy
- [ ] Incident Response Plan
- [ ] Business Continuity Plan
- [ ] AI System Documentation
```

### Vendor Risk Management

```
Third-Party Risk Assessment:
- [ ] Supabase - security review, SOC 2, data location
- [ ] OpenRouter - data handling, model provider policies
- [ ] Stripe - PCI compliance, data handling
- [ ] Vercel/Render - security certifications
- [ ] Sentry - data handling, EU hosting option
- [ ] Google Fonts - data collection (minimal)

Vendor Contracts:
- [ ] DPA with each processor
- [ ] SLA commitments
- [ ] Security questionnaire responses
- [ ] Insurance requirements
```

## Output Format

### Compliance Readiness Score: [1-10]
### Enterprise Sales Readiness: [1-10]
### Acquisition Due Diligence Readiness: [1-10]

### Critical Gaps (Blocks Deals)
| Regulation | Gap | Risk | Remediation | Effort |
|------------|-----|------|-------------|--------|

### High Priority (Enterprise Requirements)
| Regulation | Gap | Risk | Remediation | Effort |
|------------|-----|------|-------------|--------|

### Medium Priority (Best Practices)
| Regulation | Gap | Risk | Remediation | Effort |
|------------|-----|------|-------------|--------|

### Documentation Status
| Document | Status | Last Updated | Owner |
|----------|--------|--------------|-------|

### Data Flow Map
```
User Input → [Frontend] → [Backend API] → [Supabase DB]
                                      ↓
                                [OpenRouter]
                                      ↓
                    [Claude | GPT | Gemini | Grok | DeepSeek]
```

### Third-Party Data Processors
| Processor | Purpose | Data Types | DPA Status | Compliance |
|-----------|---------|------------|------------|------------|

### Recommendations by Jurisdiction
| Jurisdiction | Current State | Requirements | Gap | Priority |
|--------------|---------------|--------------|-----|----------|
| EU (GDPR) | | | | |
| California (CCPA) | | | | |
| UK (UK GDPR) | | | | |
| Canada (PIPEDA) | | | | |
| Australia (Privacy Act) | | | | |

### Pre-Acquisition Checklist
- [ ] Privacy Policy reviewed by legal
- [ ] Terms of Service reviewed by legal
- [ ] All vendor DPAs in place
- [ ] SOC 2 Type II report (or Type I + remediation plan)
- [ ] Data processing records complete
- [ ] Employee training documented
- [ ] Incident response tested
- [ ] Insurance certificates current
- [ ] No outstanding regulatory issues
- [ ] Clean compliance history

---

Remember: Legal compliance is not optional. Every gap is a potential deal-breaker, lawsuit, or regulatory fine. Document everything.
