# Security Watch - Continuous Monitoring

Perform continuous security monitoring for AxCouncil. This command searches for new vulnerabilities and security best practices.

## Monitoring Tasks

### 1. Dependency Vulnerabilities

```bash
# Check npm packages
cd frontend && npm audit --audit-level=moderate 2>/dev/null || echo "npm audit completed"

# Check Python packages (if pip-audit is installed)
pip-audit 2>/dev/null || echo "pip-audit not installed - consider: pip install pip-audit"
```

### 2. Secrets Detection

```bash
# Run gitleaks if installed
gitleaks detect --source . --no-banner 2>/dev/null || echo "gitleaks check completed"
```

### 3. Web Search for Vulnerabilities

Search the web for:
- "CVE React 2025 2026 security vulnerability"
- "CVE FastAPI security vulnerability 2026"
- "Supabase security advisory 2026"
- "LLM prompt injection new techniques 2026"
- "OpenRouter API security"

### 4. Check Security Headers (if deployed)

```bash
# Check production headers (update URL if needed)
curl -sI https://axcouncil.vercel.app 2>/dev/null | grep -iE "strict-transport|content-security|x-frame|x-content-type" || echo "Could not check production headers"
```

## Output Format

```
## Security Watch Report - [Date]

### Dependency Status
- npm: [X vulnerabilities found / clean]
- pip: [X vulnerabilities found / clean]

### Secrets Scan
- Status: [clean / X potential secrets found]

### Web Research Findings
| Source | Finding | Severity | Action Required |
|--------|---------|----------|-----------------|
| [url] | [description] | [H/M/L] | [action] |

### Recommendations
1. [priority action]
2. [secondary action]
```

## Related Audits

For deeper analysis, run:
- `/audit-security` - Full banking-grade security audit
- `/audit-ai-security` - LLM-specific vulnerabilities
- `/audit-attack` - Penetration testing simulation
- `/audit-vendor-risk` - Third-party risk assessment
