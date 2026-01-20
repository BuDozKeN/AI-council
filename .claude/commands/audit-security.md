# Security Audit - Banking-Grade Standards

You are a senior security engineer conducting a comprehensive security audit for a $25M+ enterprise application. This audit must meet banking and fintech standards (Stripe, Revolut level).

**Version**: 2.0 (January 2026)
**Last Updated**: Aligned with OWASP 2024, NIST CSF 2.0, and modern SaaS security practices

## Related Audits

This audit focuses on core application security. For specialized areas, cross-reference:
- **`/audit-ai-security`** - LLM prompt injection, AI attack surfaces
- **`/audit-secrets-management`** - Credential handling, rotation, vaults
- **`/audit-attack`** - Red team penetration testing simulation
- **`/audit-vendor-risk`** - Third-party and supply chain risks
- **`/audit-enterprise-sso`** - SSO/SAML/OIDC implementations
- **`/audit-data-architecture`** - RLS, multi-tenancy, data isolation

## Severity Classification (CVSS-Aligned)

Use this scoring when reporting findings:

| Severity | CVSS Score | Response Time | Examples |
|----------|------------|---------------|----------|
| **Critical** | 9.0-10.0 | Immediate (hours) | Auth bypass, RCE, data breach in progress |
| **High** | 7.0-8.9 | 24-48 hours | Privilege escalation, SQL injection, XSS with session theft |
| **Medium** | 4.0-6.9 | 1-2 weeks | CSRF, information disclosure, missing rate limits |
| **Low** | 0.1-3.9 | Next sprint | Missing headers, verbose errors, minor misconfigs |

---

## Audit Scope

### 1. Authentication & Authorization

#### 1.1 JWT Implementation
- [ ] Token expiration configured (access: 15-60min, refresh: 7-30 days)
- [ ] Refresh token rotation on use (prevents replay)
- [ ] Secure storage (httpOnly cookies or secure memory, NOT localStorage)
- [ ] Algorithm explicitly set (RS256/ES256 preferred, reject "none"/"HS256" from untrusted)
- [ ] Token revocation mechanism exists (blocklist or short expiry + refresh)
- [ ] JTI (JWT ID) for replay prevention on sensitive operations
- [ ] Audience (aud) and issuer (iss) claims validated

#### 1.2 Modern Authentication
- [ ] **Passkeys/WebAuthn** support evaluated or implemented
- [ ] **Device binding** for sensitive operations
- [ ] **Step-up authentication** for high-risk actions (billing, data export)
- [ ] **Continuous authentication** signals (impossible travel, device fingerprint)
- [ ] **MFA enforcement** available (TOTP, WebAuthn, SMS as fallback only)

#### 1.3 Session Management
- [ ] Session timeout configured (idle: 15-30min, absolute: 8-24hr)
- [ ] Session invalidation on password change
- [ ] Concurrent session limits (optional: single session enforcement)
- [ ] Session binding to device/IP (optional, with UX consideration)
- [ ] Logout actually invalidates server-side session

#### 1.4 Password Security (if applicable)
- [ ] Minimum 12 characters (NIST 800-63b)
- [ ] No composition rules (NIST 800-63b recommends against)
- [ ] Breach password checking (HaveIBeenPwned API or similar)
- [ ] Argon2id or bcrypt (cost factor 10+)
- [ ] No password hints or security questions

#### 1.5 OAuth/SSO Security
- [ ] State parameter with CSRF protection
- [ ] PKCE for public clients (authorization code flow)
- [ ] Redirect URI strictly validated (exact match, no wildcards)
- [ ] Token exchange on backend (not frontend)
- [ ] ID token validation (signature, aud, iss, exp, nonce)

#### 1.6 Role-Based Access Control (RBAC)
- [ ] Principle of least privilege enforced
- [ ] Role checks on EVERY endpoint (not just UI hiding)
- [ ] Horizontal access control (user A can't access user B's data)
- [ ] Vertical access control (user can't access admin functions)
- [ ] Role assignment audit trail

#### 1.7 Supabase RLS Policies
- [ ] ALL tables have RLS enabled
- [ ] Policies use `auth.uid()` not client-provided values
- [ ] Service key usage minimized and audited
- [ ] No RLS bypass in application code without explicit justification
- [ ] Test RLS with multiple user contexts

**Files to Review:**
- `backend/auth.py` - Authentication logic
- `backend/security.py` - Security utilities
- `supabase/migrations/*_rls*.sql` - RLS policies
- `frontend/src/contexts/AuthContext.tsx` - Client auth handling

---

### 2. OWASP Top 10 (2021) + API Security Top 10 (2023)

#### OWASP Web Top 10
| ID | Vulnerability | Check |
|----|--------------|-------|
| **A01** | Broken Access Control | [ ] Horizontal/vertical privilege escalation tested |
| **A02** | Cryptographic Failures | [ ] Sensitive data encrypted at rest and in transit |
| **A03** | Injection | [ ] SQL, NoSQL, command, LDAP injection vectors tested |
| **A04** | Insecure Design | [ ] Threat modeling performed, security controls in design |
| **A05** | Security Misconfiguration | [ ] Default configs changed, unnecessary features disabled |
| **A06** | Vulnerable Components | [ ] Dependencies scanned, CVEs addressed |
| **A07** | Auth Failures | [ ] Credential stuffing, brute force protection in place |
| **A08** | Data Integrity Failures | [ ] Deserialization safe, CI/CD pipeline secured |
| **A09** | Logging Failures | [ ] Security events logged, no sensitive data in logs |
| **A10** | SSRF | [ ] Server-side request forgery prevented |

#### OWASP API Security Top 10 (2023)
| ID | Vulnerability | Check |
|----|--------------|-------|
| **API1** | Broken Object Level Authorization (BOLA) | [ ] Every endpoint checks object ownership |
| **API2** | Broken Authentication | [ ] Token validation on all endpoints |
| **API3** | Broken Object Property Level Authorization | [ ] Mass assignment prevented, response filtering |
| **API4** | Unrestricted Resource Consumption | [ ] Rate limits, pagination, query depth limits |
| **API5** | Broken Function Level Authorization (BFLA) | [ ] Admin functions protected |
| **API6** | Unrestricted Access to Sensitive Flows | [ ] Critical flows rate-limited (signup, password reset) |
| **API7** | Server-Side Request Forgery | [ ] URL validation, allowlists for external calls |
| **API8** | Security Misconfiguration | [ ] Proper CORS, error handling, TLS |
| **API9** | Improper Inventory Management | [ ] API versioning, deprecated endpoints removed |
| **API10** | Unsafe Consumption of APIs | [ ] Third-party API responses validated |

---

### 3. API Security

#### 3.1 Rate Limiting
- [ ] Global rate limit (e.g., 1000 req/min per IP)
- [ ] Per-endpoint limits (auth: stricter, read: relaxed)
- [ ] Per-user limits for authenticated requests
- [ ] Cost-based limits for expensive operations (AI endpoints)
- [ ] Rate limit headers in responses (X-RateLimit-*)
- [ ] Graceful degradation, not hard blocks

#### 3.2 Input Validation
- [ ] All inputs validated server-side (never trust client)
- [ ] Type coercion explicit (no implicit string→int)
- [ ] Length limits on all string inputs
- [ ] Allowlist validation where possible
- [ ] File upload validation (type, size, magic bytes, antivirus)
- [ ] JSON schema validation on complex inputs

#### 3.3 Output Encoding
- [ ] HTML encoding for user content in responses
- [ ] JSON responses use proper content-type
- [ ] No sensitive data in API responses beyond necessity
- [ ] Pagination prevents data enumeration
- [ ] Error messages don't leak internal details

#### 3.4 CORS Configuration
- [ ] Explicit origin allowlist (no wildcard in production)
- [ ] Credentials mode only with specific origins
- [ ] Preflight caching appropriate (max 24hr)
- [ ] No CORS on sensitive endpoints (authentication)

#### 3.5 Request Security
- [ ] Maximum request body size enforced
- [ ] Request timeout enforced
- [ ] Content-Type validation (reject unexpected types)
- [ ] No HTTP verb tunneling (X-HTTP-Method-Override disabled)

**Files to Review:**
- `backend/routers/*.py` - All API endpoints
- `backend/main.py` - Middleware configuration
- Rate limiting configuration (if separate)

---

### 4. Data Protection

#### 4.1 Encryption
- [ ] TLS 1.3 (or 1.2 minimum) everywhere
- [ ] Strong cipher suites only (no RC4, DES, export ciphers)
- [ ] Certificate pinning for mobile (if applicable)
- [ ] Data encrypted at rest (database, backups, logs)
- [ ] PII encrypted with separate keys (key per tenant ideal)

#### 4.2 PII Handling
- [ ] PII inventory documented
- [ ] PII masked in logs (email: `j***@***.com`)
- [ ] PII access logged and auditable
- [ ] PII deletion capability (GDPR right to erasure)
- [ ] PII export capability (GDPR data portability)

#### 4.3 Data Retention
- [ ] Retention policies defined per data type
- [ ] Automated deletion of expired data
- [ ] Soft delete with hard delete after grace period
- [ ] Audit logs retained separately (longer retention)

#### 4.4 Database Security
- [ ] Connection over SSL/TLS required
- [ ] Separate read/write credentials where possible
- [ ] No database credentials in code
- [ ] Parameterized queries everywhere (no string concatenation)
- [ ] Database user has minimal privileges

**Files to Review:**
- `backend/database.py` - Database access patterns
- `backend/config.py` - Configuration and secrets loading
- Database migration files for encryption

---

### 5. Infrastructure Security

#### 5.1 Transport Security
- [ ] HTTPS everywhere (no HTTP, even for redirects)
- [ ] HSTS enabled (max-age 31536000, includeSubDomains)
- [ ] No mixed content
- [ ] Certificate validity monitoring

#### 5.2 Security Headers
```
Required Headers:
- [ ] Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY (or SAMEORIGIN if needed)
- [ ] Content-Security-Policy: [see CSP section]
- [ ] X-XSS-Protection: 0 (deprecated, CSP preferred)
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy: camera=(), microphone=(), geolocation=()

Cross-Origin Headers (if needed):
- [ ] Cross-Origin-Opener-Policy: same-origin
- [ ] Cross-Origin-Embedder-Policy: require-corp
- [ ] Cross-Origin-Resource-Policy: same-origin
```

#### 5.3 Content Security Policy
```
Recommended CSP:
default-src 'self';
script-src 'self' [trusted-cdn];
style-src 'self' 'unsafe-inline'; /* Tailwind needs this */
img-src 'self' data: https:;
font-src 'self';
connect-src 'self' [api-domain] [supabase-domain];
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```
- [ ] CSP deployed and tested
- [ ] Report-URI or report-to configured
- [ ] No unsafe-eval in production
- [ ] Nonce-based script loading (if inline scripts needed)

#### 5.4 Cookie Security
- [ ] HttpOnly flag on session cookies
- [ ] Secure flag on all cookies
- [ ] SameSite=Strict (or Lax with CSRF tokens)
- [ ] __Host- prefix for sensitive cookies
- [ ] Reasonable expiration times

#### 5.5 Error Handling
- [ ] Stack traces hidden in production
- [ ] Generic error messages to users
- [ ] Detailed errors logged server-side
- [ ] Error IDs for correlation (user can report ID)

**Files to Review:**
- `backend/main.py` - Middleware, headers
- `frontend/vite.config.ts` - Build configuration
- Deployment configuration (Vercel, Render)

---

### 6. Frontend Security

#### 6.1 XSS Prevention
- [ ] React's built-in escaping used (no dangerouslySetInnerHTML)
- [ ] User content sanitized before rendering
- [ ] URL schemes validated (no javascript:)
- [ ] SVG uploads sanitized or converted

#### 6.2 CSRF Protection
- [ ] State-changing operations use POST/PUT/DELETE
- [ ] CSRF tokens for non-API forms (if any)
- [ ] SameSite cookies provide protection
- [ ] Origin header validated on backend

#### 6.3 Sensitive Data Handling
- [ ] No sensitive data in localStorage (tokens OK in memory)
- [ ] SessionStorage cleared on window close
- [ ] No sensitive data in URL parameters
- [ ] Form inputs use autocomplete="off" for sensitive fields

#### 6.4 Third-Party Security
- [ ] Third-party scripts minimized
- [ ] Subresource Integrity (SRI) for CDN scripts
- [ ] Third-party scripts loaded async/defer
- [ ] No tracking scripts with full DOM access

#### 6.5 Build Security
- [ ] Source maps disabled in production (or secured)
- [ ] No secrets in client bundle (verify VITE_ prefix)
- [ ] Bundle analyzed for unexpected inclusions
- [ ] Dead code eliminated

**Files to Review:**
- `frontend/src/lib/supabase.ts` - Client configuration
- `frontend/index.html` - Third-party scripts
- `frontend/vite.config.ts` - Build settings

---

### 7. Supply Chain Security

#### 7.1 Dependency Management
- [ ] Lock files committed (package-lock.json, requirements.txt)
- [ ] Dependencies pinned to exact versions
- [ ] Automated dependency updates (Dependabot)
- [ ] Security advisories monitored

#### 7.2 Vulnerability Scanning
```bash
# Run these scans:
cd frontend && npm audit --audit-level=high
pip-audit  # or safety check for Python
```
- [ ] No critical/high vulnerabilities in dependencies
- [ ] Vulnerability scan in CI pipeline
- [ ] Regular (weekly) dependency audits

#### 7.3 Supply Chain Attacks
- [ ] Typosquatting risk assessed (package names verified)
- [ ] No unnecessary dependencies
- [ ] Dependency provenance verified (npm provenance, sigstore)
- [ ] Private registry for internal packages (if applicable)

#### 7.4 CI/CD Security
- [ ] Secrets not exposed in CI logs
- [ ] PR builds from forks don't access secrets
- [ ] Pipeline actions pinned to SHA (not tags)
- [ ] Required reviews before merge
- [ ] Branch protection on main/master

#### 7.5 SBOM (Software Bill of Materials)
- [ ] SBOM generated for releases
- [ ] SBOM includes all direct and transitive dependencies
- [ ] SBOM format standardized (SPDX or CycloneDX)

**Files to Review:**
- `package.json` / `package-lock.json`
- `pyproject.toml` / `requirements.txt`
- `.github/workflows/*.yml` - CI/CD pipelines
- `.github/dependabot.yml` - Dependency updates

---

### 8. Zero Trust Principles

Modern security assumes breach. Verify these principles:

#### 8.1 Never Trust, Always Verify
- [ ] Every request authenticated (no "internal" exceptions)
- [ ] Every request authorized (check permissions, not just identity)
- [ ] Tokens validated on every request (not cached trust)

#### 8.2 Least Privilege
- [ ] Service accounts have minimal permissions
- [ ] Database users have minimal privileges
- [ ] API keys scoped to specific operations
- [ ] Users get minimal roles by default

#### 8.3 Assume Breach
- [ ] Lateral movement limited (network segmentation)
- [ ] Secrets rotation possible without downtime
- [ ] Audit logs for forensics
- [ ] Incident response plan exists

#### 8.4 Explicit Verification
- [ ] Context-aware access (device, location, time)
- [ ] Anomaly detection for unusual patterns
- [ ] Step-up auth for sensitive operations

---

### 9. Security Monitoring & Observability

#### 9.1 Security Logging
- [ ] Authentication events (login, logout, failed attempts)
- [ ] Authorization failures (access denied)
- [ ] Admin actions (role changes, data exports)
- [ ] Security-relevant errors
- [ ] Sensitive data access

#### 9.2 Log Security
- [ ] No sensitive data in logs (passwords, tokens, PII)
- [ ] Logs tamper-evident (centralized, append-only)
- [ ] Log retention meets compliance (90 days minimum)
- [ ] Log access restricted and audited

#### 9.3 Alerting
- [ ] Alert on multiple failed logins
- [ ] Alert on privilege escalation
- [ ] Alert on unusual data access patterns
- [ ] Alert on security header changes
- [ ] Incident response runbook exists

#### 9.4 Security Metrics
- [ ] Failed authentication rate tracked
- [ ] Rate limit trigger frequency tracked
- [ ] Vulnerability scan results tracked
- [ ] Time to patch critical vulnerabilities tracked

---

### 10. Cloud/SaaS-Specific Security

#### 10.1 Supabase Security
- [ ] RLS enabled on ALL tables
- [ ] Service key only used in backend
- [ ] Anon key permissions minimized
- [ ] Realtime subscriptions authorized
- [ ] Edge functions secured (if used)
- [ ] Storage buckets have proper policies

#### 10.2 Deployment Platform Security
- [ ] Environment variables encrypted at rest
- [ ] Deployment logs don't contain secrets
- [ ] Preview deployments don't access production data
- [ ] Rollback capability exists
- [ ] Infrastructure as Code version controlled

#### 10.3 Third-Party SaaS
- [ ] OpenRouter API key properly secured
- [ ] Sentry doesn't receive sensitive data
- [ ] Redis/Qdrant connections encrypted
- [ ] Third-party access reviewed quarterly

---

## Audit Process

### Phase 1: Automated Scanning
```bash
# 1. Dependency vulnerabilities
cd frontend && npm audit
pip-audit

# 2. Secret scanning
gitleaks detect --source . --verbose

# 3. Static analysis (if configured)
npm run lint
python -m bandit -r backend/

# 4. Check security headers
curl -I https://your-domain.com | grep -E "Strict|Content-Security|X-Frame"
```

### Phase 2: Manual Code Review
1. Review authentication flow end-to-end
2. Review authorization checks on each endpoint
3. Verify RLS policies match business requirements
4. Check error handling for information leakage
5. Review input validation patterns

### Phase 3: Testing
1. Test BOLA (try to access another user's data)
2. Test BFLA (try to access admin functions as user)
3. Test rate limiting (verify limits enforced)
4. Test JWT handling (expired, malformed, tampered)
5. Test XSS vectors in all input fields

### Phase 4: Configuration Review
1. Verify security headers in production
2. Verify CORS configuration
3. Verify CSP policy
4. Verify cookie attributes
5. Verify error handling in production mode

---

## Output Format

### Executive Summary
Brief overview of security posture, key risks, and recommended priorities.

### Critical (Fix Immediately - Within Hours)
| Issue | Location | CVSS | Risk | Remediation |
|-------|----------|------|------|-------------|
| | | | | |

### High Priority (Fix Within 24-48 Hours)
| Issue | Location | CVSS | Risk | Remediation |
|-------|----------|------|------|-------------|
| | | | | |

### Medium Priority (Fix Within 1-2 Weeks)
| Issue | Location | CVSS | Risk | Remediation |
|-------|----------|------|------|-------------|
| | | | | |

### Low Priority / Improvements
| Issue | Location | CVSS | Risk | Remediation |
|-------|----------|------|------|-------------|
| | | | | |

### Compliance Checklist
| Requirement | Status | Notes |
|-------------|--------|-------|
| OWASP Top 10 | | |
| OWASP API Top 10 | | |
| GDPR Basics | | |
| SOC 2 Readiness | | |

### Security Posture Summary
- **Overall Rating**: [Critical/Poor/Fair/Good/Excellent]
- **Authentication Security**: [1-10]
- **Authorization Security**: [1-10]
- **Data Protection**: [1-10]
- **Infrastructure Security**: [1-10]
- **Monitoring & Detection**: [1-10]

### Key Strengths
- ...

### Top 3 Priorities
1. ...
2. ...
3. ...

### Recommended Next Steps
1. Run `/audit-ai-security` for LLM-specific vulnerabilities
2. Run `/audit-secrets-management` for credential handling
3. Run `/audit-attack` for penetration testing simulation

---

## Quick Reference: Key Files

| Area | Files |
|------|-------|
| Authentication | `backend/auth.py`, `frontend/src/contexts/AuthContext.tsx` |
| Authorization | `backend/routers/*.py`, `supabase/migrations/*_rls*.sql` |
| API Security | `backend/main.py`, `backend/routers/*.py` |
| Database | `backend/database.py`, `backend/config.py` |
| Frontend | `frontend/src/lib/supabase.ts`, `frontend/vite.config.ts` |
| CI/CD | `.github/workflows/*.yml`, `.pre-commit-config.yaml` |
| Configuration | `.env.example`, `backend/config.py` |

---

Remember: This codebase handles business-critical AI council decisions with multi-tenant data. Security must be enterprise-grade. A single vulnerability could expose multiple companies' strategic information.
