# Secrets & Environment Management Audit - Runtime Security

You are a security engineer specializing in secrets management auditing a SaaS AI platform for secure handling of credentials, API keys, and sensitive configuration. This audit ensures no secrets are exposed and rotation/revocation procedures are enterprise-ready.

**The Stakes**: One leaked API key = security incident = breach notification = dead deal. Secrets management is the unsexy security that prevents catastrophic failures. This audit ensures bulletproof credential handling.

## Secrets Landscape

```
AxCouncil Secret Types:
├── API Keys
│   ├── OpenRouter API key (LLM access)
│   ├── Supabase service key (admin DB access)
│   ├── Supabase anon key (client DB access)
│   ├── Stripe API keys (payments)
│   ├── Sentry DSN (monitoring)
│   ├── Redis credentials
│   └── Qdrant API key
├── Database Credentials
│   ├── Supabase connection string
│   └── Redis connection string
├── Auth Secrets
│   ├── JWT signing keys
│   └── OAuth client secrets (if any)
├── Encryption Keys
│   └── Data encryption keys (if any)
└── Service Accounts
    └── GitHub tokens (CI/CD)
```

## Audit Checklist

### 1. Secret Storage

```
Storage Locations:
- [ ] Environment variables (primary)
- [ ] .env files (development only)
- [ ] Cloud provider secrets manager
- [ ] CI/CD secrets storage
- [ ] No secrets in code (verified)
- [ ] No secrets in git history (verified)

Storage Security:
- [ ] .env in .gitignore
- [ ] .env.example has placeholders only
- [ ] Production secrets in secure vault
- [ ] Secrets encrypted at rest
- [ ] Access logging enabled
```

**Files to Review:**
- `.env.example` - Ensure no real values
- `.gitignore` - Ensure .env excluded
- `backend/config.py` - How secrets are loaded
- `.github/workflows/*` - CI/CD secret usage

### 2. Secret Scanning

```
Pre-Commit Scanning:
- [ ] detect-secrets configured
- [ ] .secrets.baseline current
- [ ] Pre-commit hook active
- [ ] Blocks commits with secrets

CI/CD Scanning:
- [ ] Gitleaks or similar in pipeline
- [ ] Scans all branches
- [ ] Scans PR diffs
- [ ] Alerts on detection
- [ ] Blocks merge on detection

Historical Scan:
- [ ] Full git history scanned
- [ ] No secrets in past commits
- [ ] Remediation if found (rotate + history rewrite)
```

**Files to Review:**
- `.pre-commit-config.yaml` - Secret scanning config
- `.secrets.baseline` - Known false positives
- `.github/workflows/security.yml` - CI scanning

### 3. API Key Management

```
Per-Key Assessment:

OpenRouter API Key:
- [ ] Storage location: [env var name]
- [ ] Access scope: [what it can do]
- [ ] Rotation schedule: [frequency]
- [ ] Last rotated: [date]
- [ ] Revocation procedure: [documented Y/N]
- [ ] Usage monitoring: [Y/N]
- [ ] Rate limiting on key: [Y/N]

Supabase Service Key:
- [ ] Storage location: [env var name]
- [ ] Access scope: [bypasses RLS - CRITICAL]
- [ ] Usage restricted to: [specific operations]
- [ ] Exposure risk: [assessment]
- [ ] Alternative approach: [use auth client where possible]

[Repeat for each API key]

Key Inventory:
| Key Name | Env Var | Scope | Rotation | Last Rotated | Risk |
|----------|---------|-------|----------|--------------|------|
| OpenRouter | OPENROUTER_API_KEY | LLM API | 90 days | [Date] | High |
| Supabase Service | SUPABASE_SERVICE_KEY | Full DB | Manual | [Date] | Critical |
| Stripe Secret | STRIPE_SECRET_KEY | Payments | 90 days | [Date] | Critical |
| Sentry DSN | VITE_SENTRY_DSN | Monitoring | Never | N/A | Low |
| [Key] | [Var] | [Scope] | [Schedule] | [Date] | [Risk] |
```

### 4. Secret Rotation

```
Rotation Procedures:
- [ ] Rotation procedure documented for each secret
- [ ] Zero-downtime rotation possible
- [ ] Dual-key support during rotation
- [ ] Automated rotation (where supported)
- [ ] Rotation tracking/audit log

Rotation Schedule:
| Secret Type | Rotation Frequency | Last Rotation | Next Due | Automated |
|-------------|-------------------|---------------|----------|-----------|
| API Keys | 90 days | [Date] | [Date] | Y/N |
| DB Passwords | 90 days | [Date] | [Date] | Y/N |
| JWT Keys | 180 days | [Date] | [Date] | Y/N |
| Service Accounts | 365 days | [Date] | [Date] | Y/N |

Rotation Runbook:
- [ ] Step-by-step for each secret type
- [ ] Rollback procedure
- [ ] Verification steps
- [ ] Communication plan
```

### 5. Secret Revocation

```
Revocation Procedures:
- [ ] Emergency revocation procedure documented
- [ ] Revocation can be done in < 15 minutes
- [ ] No service dependency on revoked key during transition
- [ ] Revocation audit trail
- [ ] Post-revocation verification

Incident Response:
- [ ] Secret exposure playbook exists
- [ ] Notification list defined
- [ ] Containment steps documented
- [ ] Recovery steps documented
- [ ] Post-incident review process
```

### 6. Environment Separation

```
Environment Isolation:
| Environment | Secret Source | Isolation | Access Control |
|-------------|---------------|-----------|----------------|
| Development | .env file | Local only | Developer |
| Staging | CI/CD secrets | Separate keys | Team |
| Production | Cloud vault | Separate keys | Limited |

Verification:
- [ ] Dev secrets cannot access prod data
- [ ] Staging secrets cannot access prod data
- [ ] Prod secrets not in dev environments
- [ ] Environment-specific API keys
- [ ] No shared secrets across environments
```

### 7. CI/CD Secrets

```
GitHub Actions Secrets:
| Secret Name | Purpose | Scope | Last Updated |
|-------------|---------|-------|--------------|
| RENDER_DEPLOY_HOOK | Backend deploy | Production | [Date] |
| [Secret] | [Purpose] | [Scope] | [Date] |

CI/CD Security:
- [ ] Secrets not logged in CI output
- [ ] Secrets masked in logs
- [ ] Secrets not in artifacts
- [ ] Secrets not exposed in PR builds from forks
- [ ] Secret access limited to specific workflows
- [ ] Audit log of secret access
```

**Files to Review:**
- `.github/workflows/*.yml` - All workflow files
- GitHub repo Settings → Secrets

### 8. Runtime Secret Access

```
Backend Secret Loading:
- [ ] Secrets loaded from environment only
- [ ] No hardcoded fallbacks
- [ ] Startup fails if required secret missing
- [ ] Secrets not logged
- [ ] Secrets not in error messages
- [ ] Secrets not in API responses

Frontend Secret Handling:
- [ ] Only public keys in frontend (anon key, not service key)
- [ ] VITE_ prefix for exposed vars only
- [ ] No secrets in client bundle
- [ ] Source maps don't expose secrets
```

**Files to Review:**
- `backend/config.py` - Secret loading
- `backend/database.py` - Credential usage
- `frontend/vite.config.ts` - Env var exposure
- `frontend/src/lib/supabase.ts` - Client credentials

### 9. Secret Exposure Prevention

```
Code Patterns:
- [ ] Secrets never in URL parameters
- [ ] Secrets never in GET request query strings
- [ ] Secrets in headers (Authorization) not URL
- [ ] Secrets redacted in logs
- [ ] Error messages sanitized

Log Sanitization:
- [ ] Log library configured to redact patterns
- [ ] API keys pattern matched and redacted
- [ ] Connection strings redacted
- [ ] Manual review of log statements
```

### 10. Third-Party Secret Sharing

```
Secrets Shared with Third Parties:
| Secret | Shared With | Purpose | Security |
|--------|-------------|---------|----------|
| Supabase anon key | Client browsers | Auth | Public by design |
| OpenRouter key | OpenRouter | API auth | TLS only |
| [Secret] | [Party] | [Purpose] | [Security] |

Third-Party Security:
- [ ] All third parties use TLS
- [ ] Secrets not logged by third parties (verify ToS)
- [ ] Third-party breach notification process
- [ ] Alternative providers identified
```

### 11. Secrets Documentation

```
Documentation Requirements:
- [ ] Secret inventory maintained
- [ ] Access matrix documented
- [ ] Rotation procedures documented
- [ ] Revocation procedures documented
- [ ] Onboarding procedure (how new devs get access)
- [ ] Offboarding procedure (revoke on departure)

Access Control:
| Secret | Who Has Access | Access Method | Audit |
|--------|----------------|---------------|-------|
| Production API keys | Ops team | Cloud vault | Yes |
| Staging secrets | Dev team | CI/CD | Yes |
| Dev secrets | Individual | Local .env | No |
```

### 12. Compliance Requirements

```
SOC 2 Secret Requirements:
- [ ] Secrets encrypted at rest
- [ ] Secrets encrypted in transit
- [ ] Access logging enabled
- [ ] Regular rotation enforced
- [ ] Separation of duties

GDPR/Data Protection:
- [ ] Encryption keys for personal data documented
- [ ] Key custodian identified
- [ ] Key recovery procedure
- [ ] Key destruction procedure
```

## Implementation Checklist

### Immediate Actions

```
If any of these are missing, fix immediately:
- [ ] .env in .gitignore
- [ ] detect-secrets in pre-commit
- [ ] Gitleaks in CI
- [ ] No secrets in git history
- [ ] Production secrets in secure vault
```

### Secret Management Tools

```
Recommended Stack:
- Local dev: .env files (gitignored)
- CI/CD: GitHub Actions secrets
- Production: Cloud provider secrets manager
  - Render: Environment Groups
  - Vercel: Environment Variables (encrypted)
  - AWS: Secrets Manager / Parameter Store
  - GCP: Secret Manager

Migration Path:
1. Audit current secret locations
2. Move production secrets to vault
3. Update deployment to pull from vault
4. Remove secrets from other locations
5. Verify rotation capability
```

## Output Format

### Secrets Management Score: [1-10]
### Rotation Readiness: [1-10]
### Exposure Risk: [1-10]

### Secret Inventory

| Secret | Location | Rotation | Last Rotated | Risk Level |
|--------|----------|----------|--------------|------------|
| OpenRouter API | Render env | 90 days | [Date] | High |
| Supabase Service | Render env | Manual | [Date] | Critical |
| [Secret] | [Location] | [Schedule] | [Date] | [Level] |

### Security Controls

| Control | Status | Gap |
|---------|--------|-----|
| Pre-commit scanning | ✅/❌ | [Gap if any] |
| CI/CD scanning | ✅/❌ | [Gap if any] |
| Production vault | ✅/❌ | [Gap if any] |
| Rotation procedures | ✅/❌ | [Gap if any] |
| Access logging | ✅/❌ | [Gap if any] |

### Critical Issues

| Issue | Risk | Impact | Remediation | Priority |
|-------|------|--------|-------------|----------|
| [Issue] | [Risk] | [Impact] | [Fix] | Critical/High/Med |

### Exposure Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Secret in logs | Low/Med/High | [Impact] | [Mitigation] |
| CI/CD exposure | Low/Med/High | [Impact] | [Mitigation] |
| [Risk] | [Likelihood] | [Impact] | [Mitigation] |

### Recommendations

1. **Critical** (Immediate security risk)
2. **High** (Compliance requirement)
3. **Medium** (Best practice)
4. **Low** (Optimization)

### Rotation Runbook Summary

| Secret | Steps | Downtime | Rollback |
|--------|-------|----------|----------|
| OpenRouter | 1. Generate new 2. Update env 3. Verify 4. Revoke old | Zero | Keep old active |
| [Secret] | [Steps] | [Downtime] | [Rollback] |

---

Remember: Secrets are the keys to the kingdom. One exposure undoes all other security work. Treat every secret as if its exposure would make headlines - because it might.
