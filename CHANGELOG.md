# Changelog

All notable changes to AxCouncil are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Documentation audit with 7.5/10 score
- CONTRIBUTING.md with code style and PR guidelines
- This CHANGELOG.md file

---

## [0.9.0] - 2026-01-03

### Added
- **Audit Dashboard** - Comprehensive audit system with 28 categories
  - Security audit (10/10)
  - Attack simulation / Red Team pentest (10/10)
  - AI Security audit with prompt injection protection (10/10)
  - UX audit (7.5/10) with Mum Test evaluation
  - Documentation audit (7.5/10)
- **15 new enterprise-grade audit commands** for $25M readiness
- Pre-push git hook for lint and type-check
- New computer/terminal setup guide in CLAUDE.md

### Fixed
- Test failures in CI pipeline
- Project context not persisting after save
- Dropdown positioning in Stage 3 action bar
- WelcomeState flash when clicking conversation
- BottomSheet setState in effect warning
- Security workflow (Bandit SARIF fallback, pip-audit warnings, CodeQL v4)

### Security
- **AI-SEC-001 to AI-SEC-010**: Complete AI security hardening
  - Direct prompt injection protection with XML-style delimiters
  - Cascading prompt injection prevention in Stage 2/3
  - 45+ sanitization patterns for attack prevention
  - Output validation layer with PII redaction
  - Conversation history sanitization

---

## [0.8.0] - 2026-01-01

### Added
- **LLM Cost Optimization** - 3-phase implementation
  - Phase 1: Cheap models for Stage 2 peer review (Grok Fast, DeepSeek, GPT-4o-mini)
  - Phase 2: Prompt caching for Claude, GPT, DeepSeek
  - Phase 3: Performance indexes for RLS queries
- Model registry database table with runtime configuration
- Chairman model priority switch to GPT-5.1

### Changed
- Stage 2 now uses 3 cheap models instead of 5 premium models
- Improved token cost tracking in session_usage table

### Fixed
- Slow request alerts excluding LLM-heavy endpoints
- Activity logging field name (body.message → body.content)

---

## [0.7.0] - 2025-12-30

### Added
- **Dark Mode** - Full theme support with class-based switching
- **OmniBar** - Premium landing page input with context icons
- Unified department dropdown with DepartmentCheckboxItem
- Pulsing thinking indicator for collapsed AI expert pills

### Fixed
- Form field accessibility (id/name attributes)
- Context popover UX (dropdowns, tooltip portal, tap-to-dismiss)
- Session usage FK violation
- Merge-decision performance

### Changed
- Icon sizes standardized to 16/20/24px grid
- 100% design token compliance (no hardcoded colors)

---

## [0.6.0] - 2025-12-27

### Added
- **UI Excellence Audit** - Scored 9/10 (Stripe/Revolut level)
- Design system documentation in `docs/design/`
- Comprehensive accessibility improvements (WCAG 2.1 AA)

### Fixed
- Accessibility audit findings (FormField labels, ChatInput aria)
- Stale CSS/JS chunk preload errors after deployments

---

## [0.5.0] - 2025-12-24

### Added
- **Security Audit** - OWASP Top 10 protection
- Rate limiting on AI-heavy endpoints
- Webhook idempotency for Stripe
- BYOK (Bring Your Own Key) with per-user encryption
- Atomic query increment for billing

### Security
- Fixed unauthenticated admin endpoints
- Fixed RLS bypass vulnerabilities
- Fixed X-Forwarded-For spoofing
- Added UUID validation on all path parameters
- Production error handling (no stack trace leakage)

---

## [0.4.0] - 2025-12-20

### Added
- **Model Registry** - Database-driven model configuration
- User preferences table
- Company documents support
- Company members and usage tracking

### Changed
- Schema cleanup and consolidation
- Performance indexes for common queries

---

## [0.3.0] - 2025-12-16

### Added
- **Projects Enhancement** - Multi-department support
- Knowledge entries consolidation
- Council type selection
- Activity logs for audit trail

### Fixed
- Projects RLS policies
- Orphaned promoted decisions

---

## [0.2.0] - 2025-12-12

### Added
- **Organization Schema v2** - Complete rewrite
  - Companies, departments, roles tables
  - Playbooks (org_documents) with auto-inject
  - Knowledge entries for saved decisions
- Role-playbook junction table
- Context markdown columns

### Changed
- Migrated from file-based to database-driven context

---

## [0.1.0] - 2025-12-01

### Added
- Initial release
- **3-Stage Council Pipeline**
  - Stage 1: 5 AI models respond in parallel
  - Stage 2: Anonymized peer review and ranking
  - Stage 3: Chairman synthesis
- Multi-model support via OpenRouter (Claude, GPT, Gemini, Grok, DeepSeek)
- React frontend with Vite
- FastAPI backend
- Supabase authentication and database
- Real-time SSE streaming

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.9.0 | 2026-01-03 | Audit dashboard, AI security hardening |
| 0.8.0 | 2026-01-01 | LLM cost optimization, model registry |
| 0.7.0 | 2025-12-30 | Dark mode, OmniBar, UI polish |
| 0.6.0 | 2025-12-27 | UI excellence audit, design system |
| 0.5.0 | 2025-12-24 | Security audit, OWASP compliance |
| 0.4.0 | 2025-12-20 | Model registry, user preferences |
| 0.3.0 | 2025-12-16 | Projects enhancement, activity logs |
| 0.2.0 | 2025-12-12 | Organization schema v2 |
| 0.1.0 | 2025-12-01 | Initial release |

---

[Unreleased]: https://github.com/BuDozKeN/AI-council/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/BuDozKeN/AI-council/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/BuDozKeN/AI-council/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/BuDozKeN/AI-council/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/BuDozKeN/AI-council/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/BuDozKeN/AI-council/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/BuDozKeN/AI-council/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/BuDozKeN/AI-council/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/BuDozKeN/AI-council/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/BuDozKeN/AI-council/releases/tag/v0.1.0
