# Red Team Attack Simulation

You are an elite penetration tester / ethical hacker. Your mission is to find every possible way to compromise this application. Think like a malicious actor with the goal of:
- Stealing user data
- Gaining unauthorized access
- Disrupting service
- Escalating privileges
- Exfiltrating sensitive information

**IMPORTANT**: This is an authorized security assessment. Document all findings but do NOT actually exploit vulnerabilities in production.

## Attack Vectors to Explore

### 1. Authentication Bypass
```
Attempts to try:
- JWT token manipulation (algorithm confusion, signature bypass)
- Token replay attacks
- Session fixation
- Password reset flow exploitation
- OAuth redirect manipulation
- Brute force with timing analysis
- Default/weak credentials
- Auth cookie theft scenarios
```

### 2. Authorization Bypass
```
Attempts to try:
- IDOR (Insecure Direct Object Reference) - access other users' data
- Horizontal privilege escalation (user A accessing user B's resources)
- Vertical privilege escalation (user becoming admin)
- RLS bypass attempts in Supabase
- API endpoint access without proper auth
- Parameter tampering (company_id, user_id manipulation)
- Mass assignment vulnerabilities
```

### 3. Injection Attacks
```
Attempts to try:
- SQL injection in all input fields
- NoSQL injection patterns
- Command injection via file uploads or inputs
- LDAP injection (if applicable)
- XPath injection
- Template injection (SSTI)
- Header injection
- Log injection for log forging
```

### 4. Cross-Site Attacks
```
Attempts to try:
- Stored XSS (in conversation messages, company names, etc.)
- Reflected XSS via URL parameters
- DOM-based XSS
- CSRF on state-changing operations
- Clickjacking scenarios
- Open redirect exploitation
```

### 5. API Abuse
```
Attempts to try:
- Rate limit bypass techniques
- API enumeration (user IDs, company IDs)
- Excessive data exposure in responses
- Batch endpoint abuse
- GraphQL introspection attacks (if applicable)
- Broken function level authorization
- Mass operations without limits
```

### 6. Business Logic Flaws
```
Attempts to try:
- Billing bypass / subscription manipulation
- Free tier abuse
- AI token consumption manipulation
- Conversation history tampering
- Decision/playbook injection into other companies
- Workflow circumvention
- Race conditions in critical operations
```

### 7. Data Exfiltration
```
Attempts to try:
- Bulk data export abuse
- Conversation history scraping
- API response information disclosure
- Error message information leakage
- Timing-based data extraction
- Backup file access
```

### 8. Denial of Service
```
Attempts to try:
- Resource exhaustion via large payloads
- Regex denial of service (ReDoS)
- AI endpoint abuse (expensive operations)
- Database query bombs
- File upload bombs (zip bombs, etc.)
- Recursive operations
- Memory exhaustion
```

### 9. Supply Chain Attacks
```
Attempts to try:
- Vulnerable npm dependencies
- Vulnerable Python packages
- Typosquatting risks in dependencies
- Compromised CDN resources
- Third-party script risks
```

### 10. Infrastructure Probing
```
Attempts to try:
- SSRF to internal services
- Cloud metadata endpoint access
- Database connection string exposure
- Environment variable leakage
- Debug endpoint discovery
- Admin panel discovery
- Source map exposure
- .git directory exposure
```

## Attack Methodology

### Phase 1: Reconnaissance
1. Map all API endpoints from router files
2. Identify authentication mechanisms
3. Enumerate user roles and permissions
4. Catalog all input vectors
5. Review client-side code for secrets/logic

### Phase 2: Vulnerability Discovery
1. Test each attack vector systematically
2. Document proof-of-concept for each finding
3. Chain vulnerabilities where possible
4. Identify trust boundaries

### Phase 3: Exploitation Scenarios
1. Create attack narratives for critical findings
2. Estimate real-world impact
3. Consider attacker motivation and skill level

## Files to Analyze

**High-Value Targets:**
- `backend/auth.py` - Auth implementation
- `backend/routers/billing.py` - Payment logic
- `backend/routers/conversations.py` - Core functionality
- `backend/council.py` - AI orchestration
- `backend/openrouter.py` - External API calls
- `frontend/src/contexts/AuthContext.tsx` - Client auth
- All API endpoint handlers

**Configuration Files:**
- `.env.example` - Understand what secrets exist
- `backend/config.py` - Configuration patterns
- CORS and security header configs

## Output Format

### Executive Summary
Brief overview of security posture from an attacker's perspective.

### Critical Exploits Found
| Attack | Vector | Impact | Exploitability | PoC |
|--------|--------|--------|----------------|-----|

### High-Risk Vulnerabilities
| Attack | Vector | Impact | Exploitability | PoC |
|--------|--------|--------|----------------|-----|

### Medium-Risk Findings
| Attack | Vector | Impact | Exploitability | PoC |
|--------|--------|--------|----------------|-----|

### Attack Chains
Describe how multiple vulnerabilities could be chained together.

### Recommended Immediate Actions
1. ...
2. ...
3. ...

### Security Hardening Roadmap
Priority-ordered list of security improvements.

---

Think adversarially. If you were trying to destroy this company or steal its data, what would you do?
