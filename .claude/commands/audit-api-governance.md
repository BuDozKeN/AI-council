# API Governance Audit - Consistency, Versioning & Developer Experience

You are an API architect auditing a platform for enterprise readiness. Enterprise buyers expect stable, documented, versioned APIs. Breaking changes without notice = lost customers.

**The Stakes**: Enterprise deals require API stability guarantees. One breaking change and your integration partners are angry.

## API Architecture Context

AxCouncil's API:
- **Framework**: FastAPI with Pydantic validation
- **Auth**: JWT Bearer tokens via Supabase
- **Structure**: RESTful with /api/* prefix
- **Rate Limiting**: slowapi per-endpoint

## Audit Checklist

### 1. API Versioning Strategy
```
Check for:
- [ ] Version in URL (/api/v1/) or header (Accept-Version)
- [ ] Current version documented
- [ ] Version negotiation supported
- [ ] Multiple versions can coexist
- [ ] Deprecation timeline documented
- [ ] Version in response headers
```

**Current state:** No versioning visible - /api/* prefix only

### 2. Breaking Change Detection
```
Review recent changes for:
- [ ] Field removals
- [ ] Field renames
- [ ] Type changes
- [ ] Required field additions
- [ ] Enum value removals
- [ ] Response structure changes
- [ ] Error format changes
```

**Known Issue:** Knowledge schema consolidation (content/body_md aliasing) suggests breaking changes were made

### 3. Backward Compatibility
```
Check for:
- [ ] Deprecated fields still returned
- [ ] Aliases for renamed fields
- [ ] Default values for new required fields
- [ ] Migration guides for breaking changes
- [ ] Client SDK versioning (if applicable)
```

### 4. Response Format Consistency
```
Check across ALL endpoints:
- [ ] Consistent success response envelope
- [ ] Consistent error response format
- [ ] Consistent pagination format
- [ ] Consistent date/time format (ISO 8601)
- [ ] Consistent null handling
- [ ] Consistent array wrapping
```

**Expected Format:**
```json
// Success
{
  "data": { ... },
  "meta": { "pagination": { ... } }
}

// Error
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

### 5. Error Response Standardization
```
Check for:
- [ ] HTTP status codes used correctly
- [ ] Error codes are machine-readable
- [ ] Error messages are human-readable
- [ ] Error details for debugging (non-production)
- [ ] No stack traces in production
- [ ] Consistent error structure across endpoints
```

**Files to Review:**
- `backend/security.py` - SecureHTTPException
- Error handlers in `backend/main.py`

### 6. Pagination Consistency
```
Check for:
- [ ] Consistent pagination parameters (limit, offset vs cursor)
- [ ] Pagination metadata in response
- [ ] Maximum page size enforced
- [ ] Default page size documented
- [ ] Total count available (if not too expensive)
- [ ] Next/prev links provided
```

### 7. HTTP Caching
```
Check for:
- [ ] Cache-Control headers on GET requests
- [ ] ETag headers for resource versioning
- [ ] Last-Modified headers
- [ ] Conditional requests (If-None-Match, If-Modified-Since)
- [ ] Vary headers for content negotiation
- [ ] No caching on sensitive data
```

### 8. Request Validation
```
Check for:
- [ ] Pydantic models for all request bodies
- [ ] Max length constraints on strings
- [ ] Enum validation for categorical fields
- [ ] UUID validation for IDs
- [ ] Date/time format validation
- [ ] Nested object validation
- [ ] Helpful validation error messages
```

### 9. API Documentation
```
Check for:
- [ ] OpenAPI/Swagger spec generated
- [ ] All endpoints documented
- [ ] Request/response examples
- [ ] Authentication documented
- [ ] Rate limits documented
- [ ] Error codes documented
- [ ] Changelog maintained
- [ ] Interactive documentation (Swagger UI)
```

**FastAPI provides:** Auto-generated OpenAPI at /docs - verify completeness

### 10. Deprecation Policy
```
Check for:
- [ ] Deprecation timeline defined (e.g., 6 months notice)
- [ ] Deprecated endpoints marked in docs
- [ ] Deprecation headers (Sunset, Deprecation)
- [ ] Migration guides for deprecated features
- [ ] Analytics on deprecated endpoint usage
```

**Headers to implement:**
```
Deprecation: true
Sunset: Sat, 1 Jan 2025 00:00:00 GMT
Link: <https://api.example.com/migration-guide>; rel="deprecation"
```

### 11. Request Tracing
```
Check for:
- [ ] Request ID generated for each request
- [ ] Request ID in response headers (X-Request-ID)
- [ ] Request ID in logs
- [ ] Request ID in error responses
- [ ] Client can provide request ID
```

### 12. Rate Limiting Transparency
```
Check for:
- [ ] Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining)
- [ ] Retry-After header on 429
- [ ] Rate limits documented per endpoint
- [ ] Different limits per tier
- [ ] Rate limit by user vs IP
```

### 13. HATEOAS / Hypermedia
```
Check for (nice to have):
- [ ] Links to related resources
- [ ] Self links
- [ ] Action links
- [ ] Pagination links
```

### 14. Idempotency
```
Check for:
- [ ] POST/PUT operations are idempotent where appropriate
- [ ] Idempotency-Key header support
- [ ] Duplicate request handling
- [ ] Safe retry behavior documented
```

### 15. Bulk Operations
```
Check for:
- [ ] Batch endpoints for efficiency
- [ ] Partial success handling
- [ ] Individual error reporting in batch
- [ ] Maximum batch size limits
```

### 16. Field Selection
```
Check for (nice to have):
- [ ] Sparse fieldsets (fields=name,email)
- [ ] Include related resources (include=company)
- [ ] Exclude expensive fields by default
```

## Endpoint Audit

### Review Each Router:
```
For each endpoint in backend/routers/:
1. Request validation complete?
2. Response format consistent?
3. Error handling standardized?
4. Rate limiting applied?
5. Authentication required?
6. Documentation complete?
```

**Routers to audit:**
- company.py (and sub-routers)
- conversations.py
- settings.py
- projects.py
- billing.py
- knowledge.py
- attachments.py
- leaderboard.py
- profile.py

## Breaking Change Log

### Document Any Found:
```
| Endpoint | Change | Version | Migration Path |
|----------|--------|---------|----------------|
| /api/knowledge | body_md → content | ? | Alias provided |
```

## Output Format

### API Governance Score: [1-10]
### Developer Experience Score: [1-10]

### Critical API Issues
| Endpoint | Issue | Breaking Change Risk | Fix |
|----------|-------|---------------------|-----|

### Versioning Gaps
| Issue | Impact | Recommendation |
|-------|--------|----------------|

### Consistency Violations
| Endpoint | Inconsistency | Expected Pattern | Fix |
|----------|---------------|------------------|-----|

### Documentation Gaps
| Endpoint | Missing Docs | Priority |
|----------|--------------|----------|

### Breaking Changes Found
| Endpoint | Change | When | Migration Status |
|----------|--------|------|------------------|

### Missing Headers
| Header | Purpose | Priority |
|--------|---------|----------|

### Error Format Issues
| Endpoint | Issue | Standardized Format |
|----------|-------|---------------------|

### Rate Limiting Gaps
| Endpoint | Current Limit | Recommended | Reason |
|----------|---------------|-------------|--------|

### Recommendations Priority
1. **Critical** (Breaking changes, security)
2. **High** (Consistency, documentation)
3. **Medium** (Developer experience)

### API Maturity Assessment
```
Level 0: HTTP as transport (RPC-style)
Level 1: Resources with proper URLs
Level 2: HTTP verbs used correctly
Level 3: Hypermedia controls (HATEOAS)

Current Level: ?
Target Level: 2 minimum, 3 for enterprise
```

---

Remember: Your API is a contract. Breaking it breaks trust. Document everything, change nothing without notice.
