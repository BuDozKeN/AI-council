# Security Audit - Banking-Grade Standards

You are a senior security engineer conducting a comprehensive security audit for a $25M+ enterprise application. This audit must meet banking and fintech standards (Stripe, Revolut level).

## Audit Scope

Perform a thorough security review covering:

### 1. Authentication & Authorization
- [ ] JWT implementation - token expiration, refresh flow, secure storage
- [ ] Session management - timeout, invalidation, concurrent sessions
- [ ] Password policies (if applicable) - complexity, hashing (bcrypt/argon2)
- [ ] OAuth/SSO implementation security
- [ ] Role-based access control (RBAC) enforcement
- [ ] API authentication on ALL endpoints
- [ ] Supabase RLS policies - verify ALL tables have proper policies
- [ ] Auth bypass attempts - test edge cases

### 2. OWASP Top 10 (2021)
- [ ] **A01 Broken Access Control** - Horizontal/vertical privilege escalation
- [ ] **A02 Cryptographic Failures** - Sensitive data exposure, weak encryption
- [ ] **A03 Injection** - SQL, NoSQL, command, LDAP injection vectors
- [ ] **A04 Insecure Design** - Business logic flaws, missing security controls
- [ ] **A05 Security Misconfiguration** - Default configs, unnecessary features
- [ ] **A06 Vulnerable Components** - Outdated dependencies with known CVEs
- [ ] **A07 Auth Failures** - Credential stuffing, brute force protection
- [ ] **A08 Data Integrity Failures** - Insecure deserialization, CI/CD security
- [ ] **A09 Logging Failures** - Insufficient logging, log injection
- [ ] **A10 SSRF** - Server-side request forgery vulnerabilities

### 3. API Security
- [ ] Rate limiting on all endpoints (especially auth, AI, billing)
- [ ] Input validation - all user inputs sanitized
- [ ] Output encoding - XSS prevention
- [ ] CORS configuration - restrictive origins only
- [ ] API versioning security
- [ ] GraphQL/REST security best practices
- [ ] File upload validation (type, size, content inspection)
- [ ] Request size limits

### 4. Data Protection
- [ ] PII handling - encryption at rest and in transit
- [ ] Sensitive data in logs - ensure PII is masked
- [ ] Data retention policies
- [ ] GDPR/CCPA compliance considerations
- [ ] Backup security
- [ ] Database connection security (SSL/TLS)

### 5. Infrastructure Security
- [ ] HTTPS everywhere - no mixed content
- [ ] Security headers (CSP, HSTS, X-Frame-Options, etc.)
- [ ] Cookie security (HttpOnly, Secure, SameSite)
- [ ] Environment variable management - no secrets in code
- [ ] Dependency vulnerability scanning
- [ ] Error handling - no stack traces exposed

### 6. Frontend Security
- [ ] XSS prevention - React's built-in + additional measures
- [ ] CSRF protection
- [ ] Sensitive data in localStorage/sessionStorage
- [ ] Third-party script security
- [ ] Subresource integrity (SRI)
- [ ] Content Security Policy effectiveness

### 7. Secrets Management
- [ ] No hardcoded secrets in codebase
- [ ] .env files properly gitignored
- [ ] API keys rotation capability
- [ ] Secrets in CI/CD pipelines

## Audit Process

1. **Scan dependencies** for known vulnerabilities:
   ```bash
   cd frontend && npm audit
   cd backend && pip-audit  # or safety check
   ```

2. **Review critical files**:
   - `backend/auth.py` - Authentication logic
   - `backend/security.py` - Security utilities
   - `backend/database.py` - Database access patterns
   - `backend/routers/*.py` - All API endpoints
   - `frontend/src/contexts/AuthContext.tsx` - Client auth
   - `frontend/src/lib/supabase.ts` - Supabase client config

3. **Check Supabase RLS policies** in migrations

4. **Review security headers** in backend middleware

5. **Test rate limiting** configuration

## Output Format

Provide a detailed report with:

### Critical (Fix Immediately)
| Issue | Location | Risk | Remediation |
|-------|----------|------|-------------|

### High Priority
| Issue | Location | Risk | Remediation |
|-------|----------|------|-------------|

### Medium Priority
| Issue | Location | Risk | Remediation |
|-------|----------|------|-------------|

### Low Priority / Improvements
| Issue | Location | Risk | Remediation |
|-------|----------|------|-------------|

### Security Posture Summary
- Overall rating: [Critical/Poor/Fair/Good/Excellent]
- Key strengths
- Top 3 priorities to address

Remember: This codebase handles business-critical AI council decisions. Security must be enterprise-grade.
