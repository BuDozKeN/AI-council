# Data Portability & Export Audit - GDPR Article 20 Compliance

You are a data protection specialist auditing a SaaS AI platform for data portability and export capabilities. This audit ensures compliance with GDPR Article 20 (Right to Data Portability), CCPA data access rights, and enterprise data governance requirements.

**The Stakes**: "Can I get my data out?" is a deal-breaker question. Enterprises won't adopt without exit clarity. Regulators can fine up to 4% of revenue for portability failures. This audit ensures data freedom.

## Data Portability Requirements

```
GDPR Article 20 Requirements:
├── Right to receive personal data in structured, commonly used format
├── Right to transmit data to another controller
├── Machine-readable format (JSON, CSV, XML)
├── Without hindrance from the controller
└── Where technically feasible, direct transmission

CCPA Requirements:
├── Right to know what personal information is collected
├── Right to access personal information
├── Portable format requirement
└── Free of charge (twice per 12 months)

Enterprise Requirements:
├── Full data export for migration
├── Audit trail export
├── Compliance documentation export
└── API-based bulk export
```

## Audit Checklist

### 1. Data Inventory

```
Complete Data Map:
| Data Category | Tables/Collections | Personal Data? | Export Ready? |
|---------------|-------------------|----------------|---------------|
| User Profile | profiles | Yes | [Y/N] |
| Company Data | companies | Yes (business) | [Y/N] |
| Conversations | conversations, messages | Yes | [Y/N] |
| Knowledge Base | knowledge_entries | Yes | [Y/N] |
| Documents | org_documents | Yes | [Y/N] |
| Decisions | decisions | Yes | [Y/N] |
| Playbooks | playbooks | Yes | [Y/N] |
| Departments | departments | Partial | [Y/N] |
| Roles | roles | No | [Y/N] |
| Attachments | attachments | Yes | [Y/N] |
| Audit Logs | activity_logs | Yes | [Y/N] |
| Billing History | billing_* | Yes | [Y/N] |
| Settings | settings | Partial | [Y/N] |

Data Volume Estimation:
- [ ] Average data per user: X MB
- [ ] Average data per company: X MB
- [ ] Largest customer data size: X MB
- [ ] Export time estimation at scale
```

**Files to Review:**
- `supabase/migrations/*` - All table schemas
- `backend/database.py` - Data access patterns
- `backend/routers/*` - API endpoints for data access

### 2. User Data Export (GDPR Article 15 + 20)

```
Individual User Export:
- [ ] Profile information (name, email, settings)
- [ ] All conversations initiated by user
- [ ] All messages authored by user
- [ ] Knowledge entries created by user
- [ ] Documents uploaded by user
- [ ] Decisions user participated in
- [ ] Activity/audit log for user actions
- [ ] Billing and payment history
- [ ] Consent records

Export Format Compliance:
- [ ] JSON format available
- [ ] CSV format available
- [ ] Human-readable option
- [ ] Machine-readable (structured)
- [ ] Includes data dictionary/schema

Export Mechanism:
- [ ] Self-service export in UI
- [ ] API endpoint for export
- [ ] Email delivery option
- [ ] Secure download link
- [ ] Export request tracking
```

### 3. Company Data Export (Enterprise Requirement)

```
Full Company Export:
- [ ] All company profile data
- [ ] All departments and roles
- [ ] All team members (anonymized if needed)
- [ ] All conversations
- [ ] All messages with metadata
- [ ] All knowledge entries
- [ ] All decisions
- [ ] All playbooks/documents
- [ ] All attachments/files
- [ ] All activity logs
- [ ] All settings and configurations
- [ ] Billing and subscription history

Export Package Structure:
company-export-YYYY-MM-DD/
├── metadata.json          # Export info, schema version
├── company.json           # Company profile
├── departments.json       # Department configs
├── roles.json             # AI personas
├── team_members.json      # User list (can anonymize)
├── conversations/
│   ├── index.json         # Conversation list
│   └── [conv-id].json     # Full conversation
├── knowledge/
│   ├── index.json
│   └── entries/
├── documents/
│   ├── index.json
│   └── files/             # Actual files
├── decisions/
├── playbooks/
├── activity_logs/
└── settings.json

Export Formats:
- [ ] JSON (primary)
- [ ] CSV (for spreadsheet import)
- [ ] ZIP archive (bundled)
- [ ] Optional: Database dump format
```

### 4. Export API

```
API Endpoint Requirements:
- [ ] POST /api/export/request - Initiate export
- [ ] GET /api/export/status/{id} - Check status
- [ ] GET /api/export/download/{id} - Download export
- [ ] DELETE /api/export/{id} - Delete export file

Request Parameters:
- [ ] Scope: user | company | full
- [ ] Format: json | csv | zip
- [ ] Date range filter
- [ ] Data categories to include/exclude
- [ ] Anonymization options

Response Handling:
- [ ] Async processing for large exports
- [ ] Progress tracking
- [ ] Webhook notification on completion
- [ ] Secure signed download URLs
- [ ] Expiring download links (24-48 hours)

Rate Limits:
- [ ] GDPR: At least 2 free exports per year
- [ ] Cool-down period between requests
- [ ] Large export queue management
```

**Files to Review/Create:**
- `backend/routers/export.py` - Export endpoints
- `backend/services/export_service.py` - Export logic

### 5. Data Deletion (Right to Erasure)

```
Deletion Capabilities:
- [ ] User account deletion
- [ ] Company account deletion
- [ ] Selective data deletion
- [ ] Conversation deletion
- [ ] Knowledge entry deletion
- [ ] Document/attachment deletion

Deletion Verification:
- [ ] Data removed from primary database
- [ ] Data removed from backups (timeline)
- [ ] Data removed from cache (Redis)
- [ ] Data removed from vector store (Qdrant)
- [ ] Data removed from search indexes
- [ ] Data removed from logs (retention policy)
- [ ] Data removed from third-party services

Deletion Confirmation:
- [ ] Deletion receipt/confirmation
- [ ] Audit trail of deletion
- [ ] Timestamp of completion
- [ ] List of systems purged
```

### 6. Data Retention Policy

```
Retention Schedule:
| Data Type | Active Retention | Archive | Deletion |
|-----------|------------------|---------|----------|
| User data | Account lifetime | 30 days post-delete | Permanent delete |
| Conversations | Account lifetime | 30 days | Permanent delete |
| Activity logs | 2 years | 5 years | Permanent delete |
| Billing records | 7 years | 7 years | Anonymize |
| Backups | 30 days | - | Auto-expire |

Policy Documentation:
- [ ] Retention policy documented
- [ ] Available in Privacy Policy
- [ ] Automated enforcement
- [ ] Manual override capability
- [ ] Legal hold support
```

### 7. Import/Migration Capability

```
Data Import Features:
- [ ] Import from exported ZIP
- [ ] Import from CSV
- [ ] Import from JSON
- [ ] Merge with existing data
- [ ] Conflict resolution options
- [ ] Dry-run/preview mode

Migration Support:
- [ ] Migration from competitors (format guide)
- [ ] Data transformation tools
- [ ] Validation on import
- [ ] Error handling and reporting
- [ ] Partial import support
```

### 8. Third-Party Data Handling

```
Data Shared with Third Parties:
| Third Party | Data Shared | Deletion Cascade | Export Included |
|-------------|-------------|------------------|-----------------|
| OpenRouter | Query content | Not stored | N/A |
| Sentry | Error context | 30-day retention | No |
| Stripe | Payment info | Via Stripe | Partial |
| [Service] | [Data] | [Policy] | [Y/N] |

Third-Party Export:
- [ ] Instructions for Stripe data export
- [ ] Instructions for other service data
- [ ] Combined export option
- [ ] Data not in our control clearly documented
```

### 9. Export Security

```
Security Requirements:
- [ ] Authentication required for export
- [ ] Authorization check (own data only)
- [ ] Encryption of export files
- [ ] Secure transfer (HTTPS only)
- [ ] Expiring download links
- [ ] IP logging on download
- [ ] Export audit trail

Sensitive Data Handling:
- [ ] Password hashes NOT included
- [ ] API keys NOT included
- [ ] Internal IDs anonymized option
- [ ] PII flagging in export
- [ ] Encryption key for sensitive exports
```

### 10. Export Performance

```
Performance Requirements:
- [ ] Export initiation < 5 seconds
- [ ] Small export (< 100MB) < 5 minutes
- [ ] Large export (< 1GB) < 30 minutes
- [ ] Very large (1GB+) async with notification

Scalability:
- [ ] Parallel export processing
- [ ] Background job queue
- [ ] Storage for export files
- [ ] Cleanup of old exports
- [ ] Rate limiting for abuse prevention
```

### 11. Compliance Documentation

```
Required Documentation:
- [ ] Data export user guide
- [ ] API documentation for export
- [ ] Data dictionary/schema documentation
- [ ] Retention policy documentation
- [ ] Deletion verification process
- [ ] Third-party data handling

Audit Trail:
- [ ] Export request log
- [ ] Deletion request log
- [ ] Compliance report generation
- [ ] DSAR (Data Subject Access Request) tracking
```

## Implementation Checklist

### UI Components Needed

```
User-Facing Features:
- [ ] "Export My Data" button in Settings
- [ ] Export format selection
- [ ] Export progress indicator
- [ ] Download link/email notification
- [ ] "Delete My Account" with confirmation
- [ ] Export history view

Admin Features:
- [ ] Company-wide export trigger
- [ ] Export audit log
- [ ] Deletion request management
- [ ] DSAR dashboard
```

### Backend Components Needed

```
Services:
- [ ] ExportService - Orchestrates export process
- [ ] DataCollector - Gathers data from all sources
- [ ] Formatter - Converts to JSON/CSV/ZIP
- [ ] StorageManager - Handles export file storage
- [ ] NotificationService - Alerts on completion
- [ ] DeletionService - Handles data removal

Database:
- [ ] export_requests table - Track requests
- [ ] deletion_requests table - Track deletions
- [ ] Export status enum (pending, processing, complete, failed)
```

## Output Format

### Data Portability Score: [1-10]
### GDPR Article 20 Compliance: [1-10]
### Export Completeness: [1-10]

### Data Export Coverage

| Data Category | Exportable | Format | Self-Service | API |
|---------------|------------|--------|--------------|-----|
| User Profile | ✅/❌ | JSON/CSV | ✅/❌ | ✅/❌ |
| Conversations | ✅/❌ | JSON/CSV | ✅/❌ | ✅/❌ |
| Knowledge Base | ✅/❌ | JSON/CSV | ✅/❌ | ✅/❌ |
| Documents | ✅/❌ | Original | ✅/❌ | ✅/❌ |
| [Category] | ✅/❌ | [Format] | ✅/❌ | ✅/❌ |

### Deletion Coverage

| Data Category | Deletable | Cascade | Backup Purge | Third-Party |
|---------------|-----------|---------|--------------|-------------|
| User Account | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| [Category] | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |

### Critical Gaps

| Gap | Regulation | Risk | Remediation | Priority |
|-----|------------|------|-------------|----------|
| No self-service export | GDPR Art 20 | Fine risk | Build export UI | Critical |
| [Gap] | [Regulation] | [Risk] | [Fix] | [Priority] |

### Implementation Roadmap

| Phase | Scope | Effort | Compliance Impact |
|-------|-------|--------|-------------------|
| 1 | User data export API | 1 week | GDPR Art 15, 20 |
| 2 | Company export | 2 weeks | Enterprise sales |
| 3 | Self-service UI | 1 week | User experience |
| 4 | Deletion verification | 1 week | GDPR Art 17 |

### Recommendations

1. **Critical** (Compliance blockers)
2. **High** (Enterprise requirements)
3. **Medium** (Best practices)
4. **Low** (Nice to have)

---

Remember: Data portability is a fundamental right, not a feature. If users can't leave, regulators will make you let them. Make it easy - it builds trust.
