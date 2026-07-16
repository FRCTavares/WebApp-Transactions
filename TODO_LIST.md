# F - Transactions: Global Release Readiness TODO List

Last audited: 2026-07-16
Original audit baseline: commit `96c3f0c`
Current verification: 427 backend tests pass; frontend lint and build pass; required CI checks pass
Current deployment: Vercel frontend, Render backend, Supabase Postgres and Auth, Google OAuth

## 1. Executive Summary

F - Transactions has a solid personal-use foundation:

- FastAPI backend with repository and service layers.
- React and TypeScript frontend.
- SQLite support for local development.
- Supabase Postgres for production.
- Supabase Auth with Google OAuth.
- Explicit user ownership is enforced across repositories, services, and ORM constructors.
- Alembic migrations successfully build a clean database through revision `f7a3c9e2d814`.
- 427 passing backend tests.
- Successful frontend production build.
- Working production CORS, bearer-token enforcement, and security headers.
- Current local database passes the existing integrity audit.
- Market-price routes require authentication and privileged mutations require admin authorization.
- Legacy imports use authenticated ownership.
- Import commits are atomic.
- Recovery tooling covers every current user-owned table.
- Investment sells use moving weighted-average acquisition cost.
- Historical investment valuations avoid future FX look-ahead.

The application is not ready for unrestricted global release.
All critical and high-priority tasks in this audit are complete. The most important remaining work is:

1. Replace composed frontend financial workflows with atomic backend commands.
2. Add readiness checks, structured logging, rate limits, and request timeouts.
3. Resolve accessibility and keyboard-support defects.
4. Improve navigation, loading, error, and partial-failure behavior.
5. Complete privacy, account deletion, internationalization, monitoring, and incident response.
6. Accept or remove the approximately 53-second Render free-tier cold-start limitation.

The correct strategy remains incremental: complete the medium-priority operational and UX work before public release.

## 2. Current Production Architecture

### Frontend

- React 19
- TypeScript
- Vite
- Minimal custom CSS
- Hosted on Vercel
- Supabase JavaScript client
- Google OAuth through Supabase Auth
- API access isolated in frontend API modules

### Backend

- FastAPI
- SQLAlchemy
- Pydantic
- Alembic
- Hosted on Render
- Repository and service layers
- Supabase JWT verification through JWKS or legacy secret
- Email allowlist
- Application-level user isolation

### Database

- SQLite for local development
- Supabase Postgres for production
- Alembic migrations in production
- Legacy SQLite startup migrations remain active for local databases
- No database Row Level Security policies were found
- Relational foreign keys and deliberate delete behavior protect linked financial records

### Authentication

- Supabase Auth
- Google OAuth
- Bearer tokens sent from frontend to backend
- JWT signature, expiration, audience, and issuer validation
- Email-based allowlist
- Application owner ID derived from validated Supabase `sub`
- Production rows were migrated atomically from the legacy normalized-email owner to the Supabase `sub`

### Deployment

- Vercel Hobby frontend
- Render free backend
- Supabase free project
- Render pre-deploy Alembic migration
- Manual Render deployment
- GitHub Actions keep-warm workflow
- Required GitHub Actions CI covering backend, recovery, frontend, dependencies, and repository hygiene

## 3. Free-Tier Viability

### Viable today

The current free-tier architecture is viable for:

- Personal use
- A small invited group
- Low request volume
- Small database size
- Non-critical availability
- Manual operational oversight
- Occasional cold starts

### Not viable for a dependable global release

The current free-tier architecture is not suitable for:

- Reliable low-latency access
- Strong uptime expectations
- Large or unpredictable traffic
- Business-critical financial access
- Guaranteed recovery objectives
- High-volume file imports
- Publicly advertised availability

### Free-compatible fixes

The following remaining work does not require a paid plan:

- Add atomic backend commands for composed financial workflows
- Add readiness checks
- Add request IDs and structured logs
- Add rate limits and request timeouts
- Fix accessibility defects
- Add privacy documentation
- Add account-deletion logic
- Add frontend URL routing
- Add locale-aware formatting

### Likely eventual paid requirements

A paid plan will eventually be justified by:

- Removing Render cold starts
- Production support expectations
- Higher availability
- Point-in-time recovery
- Longer backup retention
- Higher database, egress, or authentication quotas
- Higher frontend bandwidth or build usage
- More reliable scheduled jobs
- More extensive logs and monitoring

## 4. Readiness Scorecard

| Area | Score | Summary |
|---|---:|---|
| Core functionality | 4/5 | Broad feature coverage and working production deployment |
| Backend architecture | 4/5 | Good layering and explicit ownership; broader transaction boundaries still need work |
| Data integrity | 4/5 | Atomic imports, investment accounting, ownership checks, and relational foreign keys are implemented |
| Authentication | 5/5 | Stable `sub` ownership is deployed, production data is migrated, and JWT issuer validation is enforced |
| Authorization | 4/5 | Market routes are protected and user-owned operations require explicit ownership |
| Import reliability | 4/5 | Atomic commits, bounded uploads, deduplication, and preview-to-commit binding are implemented |
| Recovery | 4/5 | PostgreSQL and JSON restore drills pass; RPO, RTO, retention, encryption, and ownership are documented |
| Security | 3/5 | Auth, ownership, upload limits, dependency checks, and secure backups exist; rate limiting, monitoring, and privacy remain |
| Frontend architecture | 3/5 | API separation exists, but several pages are oversized and workflow logic is duplicated |
| UI/UX | 3/5 | Functional and responsive, but navigation, loading, consistency, and personal defaults need work |
| Accessibility | 1/5 | Dialog, combobox, chart, zoom, focus, and motion issues remain |
| Internationalization | 1/5 | Hard-coded English, EUR, locales, and personal assumptions |
| Testing | 4/5 | 427 backend tests, frontend lint and build, migrations, and recovery checks pass; broader frontend and end-to-end coverage remains limited |
| CI/CD | 4/5 | Required CI checks cover backend, recovery, frontend, dependencies, and repository hygiene |
| Observability | 1/5 | No structured logging, metrics, monitoring, or alerting |
| Performance | 2/5 | Free-host cold starts, remaining composed workflows, and limited production observability |
| Documentation | 2/5 | Deployment docs exist, but several documents are stale |
| Global release readiness | 2/5 | Suitable for controlled use, not public global shipment |

## 5. Critical Blockers

No open `CRIT` items remain in the root task list.

Completed and validated:

- `CRIT-001`: Protected market-price reads and privileged mutations.
- `CRIT-002`: Corrected legacy import ownership.
- `CRIT-003`: Made import commits atomic.
- `CRIT-004`: Added complete registry-based export, validation, restore, and migration coverage.
- `CRIT-005`: Corrected investment sell cost basis using moving weighted-average cost.
- `CRIT-006`: Removed look-ahead bias from historical investment valuations.

Critical security, ownership, financial-correctness, atomic-import, recovery, and high-priority release-engineering tasks are complete.

## 6. High Priority

No open `HIGH` items remain in the root task list.

## 7. Medium Priority

Completed and validated through `MED-005`.

Open work is tracked in GitHub Issues and must be completed in this order:

1. [MED-006: Improve loading and partial-failure states](https://github.com/FRCTavares/WebApp-Transactions/issues/6)
2. [MED-007: Remove personal hard-coded frontend defaults](https://github.com/FRCTavares/WebApp-Transactions/issues/7)
3. [MED-008: Replace the hard-coded FX match rate](https://github.com/FRCTavares/WebApp-Transactions/issues/8)
4. [MED-009: Make rule application atomic and efficient](https://github.com/FRCTavares/WebApp-Transactions/issues/9)
5. [MED-010: Add production readiness health checks](https://github.com/FRCTavares/WebApp-Transactions/issues/10)
6. [MED-011: Add structured application logging](https://github.com/FRCTavares/WebApp-Transactions/issues/11)
7. [MED-012: Add rate limiting and abuse controls](https://github.com/FRCTavares/WebApp-Transactions/issues/12)
8. [MED-013: Decide production API documentation policy](https://github.com/FRCTavares/WebApp-Transactions/issues/13)

Close an issue only after implementation, focused and broader verification, full diff review, and repository-status review succeed.
## 8. Low Priority

- Remove dead local-auth compatibility code after the ownership migration.
- Normalize formatting and naming.
- Add a supported-browser matrix.
- Decide whether the PWA is installable-only or truly offline-capable.
- Add build version and release notes.

## 9. UI/UX Screen Plan

### Dashboard

- Add explicit loading and error states.
- Show data freshness.
- Explain estimated investment values.
- Ensure KPI cards are keyboard accessible.

### Money In and Money Out

- Use active categories only.
- Add URL-based filters.
- Preserve context after edits.
- Confirm destructive actions.
- Show import provenance clearly.

### Money Owed To Me

- Move split and linked operations to atomic backend commands.
- Clarify active, partial, paid, and overdue states.
- Make allocation errors actionable.

### Import CSV

- Show accepted formats and maximum size.
- Display valid, duplicate, skipped, invalid, and pending-FX rows separately.
- Bind commit to the exact preview.
- Require explicit confirmation.

### Categories and Rules

- Show usage before deletion.
- Keep migration preview and replacement workflows.
- Make selectors keyboard operable.
- Clarify active versus inactive categories.

### Investments

- Remove personal defaults.
- Correct accounting before adding analytics.
- Separate realized and unrealized gain.
- Show valuation and FX sources.

### Wealth

- Replace fuzzy name-based exclusion logic with explicit account metadata.
- Mark derived versus manually entered values.

### Settings

Add:

- default currency
- locale
- time zone
- date format
- system theme
- data export
- account deletion
- privacy information
- build version

## 10. Backend and Data Plan

### Transaction boundaries

- Services own transactions.
- Repositories avoid autonomous commits in composed workflows.
- Use `flush()` for generated IDs.
- Commit once and roll back consistently.

### Ownership

- Require explicit owners.
- Use Supabase `sub`.
- Verify ownership of related records.
- Keep shared market data explicitly separate.

### Relationships

- Foreign keys and deliberate delete behavior are implemented.
- Same-user validation protects related records.
- Orphan and cross-user checks are included in the integrity audit.

### Monetary values

- Keep decimal values in backend and API contracts.
- Avoid JavaScript floating-point calculations for financial writes.
- Prefer decimal strings or integer minor units.

### Cashflow vocabulary

Standardize supported values across:

- schemas
- migrations
- integrity audit
- routes
- categories
- frontend filters

## 11. Auth and Authorization

- Use Supabase `sub`.
- Validate issuer and required claims.
- Keep email only for metadata and allowlisting.
- Protect all market-price routes.
- Add privileged authorization for global mutations.
- Add route-policy tests.
- Add `VITE_SUPABASE_AUTH_ENABLED` to documentation and examples.
- Validate production auth configuration on startup.
- Evaluate RLS as defense in depth after the backend role strategy is defined.

## 12. Security and Privacy

### Security

- Add rate limits.
- Add request and database timeouts.
- Add a Content Security Policy where practical.
- Restore browser zoom.
- Decide API documentation exposure.
- Add structured logs with sensitive-data redaction.

### Privacy

Document:

- data collected
- processing purpose
- retention
- backup retention
- export process
- account deletion
- privacy request contact
- third-party processors
- hosting regions
- telemetry and analytics policy

## 13. Internationalization

- Remove presentation-level EUR assumptions.
- Add default currency.
- Preserve original transaction currency.
- Use locale-aware number and currency formatting.
- Centralize date formatting.
- Add time-zone handling.
- Move user-facing strings into a translation structure.
- Start with English and Portuguese if those are the launch languages.
- Keep source-specific CSV parsing.

## 14. Testing

### Backend additions

- Market-price auth and privileged mutation
- Legacy import ownership
- Atomic import rollback
- Concurrent duplicate import
- Upload-size rejection
- Preview-to-commit hash binding
- JWT issuer validation
- Supabase `sub` ownership
- Email-change behavior
- Foreign-key enforcement
- Cross-user relationship rejection
- Complete export and restore
- Investment cost basis
- Historical FX valuation
- Rule rollback
- Readiness endpoint

### Frontend additions

- Auth enabled, disabled, and misconfigured
- Expired-session handling
- Transaction create and edit
- Import preview and commit
- Pending FX
- Active-category selection
- Owed split and payment
- Keyboard dialog and combobox operation
- Loading, empty, error, and partial-data states

### End-to-end additions

- Authenticated app entry
- Manual transaction creation
- CSV preview and commit
- Duplicate re-import
- Category replacement
- Export download
- Mobile navigation

## 15. Performance and Scalability

Current constraints:

- Approximately 53-second Render cold start
- Commits in some remaining composed workflows
- Multiple dependent frontend requests
- Offset pagination
- Up to 5,000 market-history rows
- No dependable free-tier uptime

Improvements:

- Batch writes
- Query timing
- Indexes based on measurements
- Cursor pagination when needed
- Controlled market-data caching
- Request cancellation
- Compression where useful
- Request and database timeouts

## 16. Deployment and Operations

### Immediate

- Add readiness
- Add structured logs
- Add rate limits and request timeouts
- Document all environment variables
- Verify Supabase redirects
- Verify Google authorized domains

### Render

- Treat cold starts as a known limitation.
- Reconsider keep-warm because it does not provide an uptime guarantee.
- Upgrade when consistent availability matters.
- Confirm migration failure blocks deployment.

### Vercel

- Keep static frontend deployment.
- Test preview deployments.
- Verify environment-variable scoping.
- Add frontend security headers where required.

### Supabase

Monitor:

- database size
- egress
- active users
- connection count
- backup availability

Test recovery rather than assuming backups are sufficient.

### Google OAuth

Before public release:

- accurate app branding
- authorized domains
- exact redirect URLs
- minimum scopes
- privacy disclosures
- verification when required

## 17. Documentation

Update:

- `README.md`
- `frontend/README.md`
- `docs/deployment.md`
- `docs/backups-supabase.md`
- `docs/production-roadmap.md`
- `docs/auth-options.md`
- `docs/multi-user-data-model.md`
- `docs/README.md`

Document:

- current architecture
- local and production setup
- all environment variables
- auth and ownership
- migrations
- backup and restore
- release and rollback
- incidents
- free-tier limitations
- privacy and deletion

## 18. Phases

### Phase 0: Emergency security fixes

- [x] Protect market-price endpoints.
- [x] Fix legacy import ownership.
- [x] Add regression tests.
- [x] Deploy and smoke-test the combined production changes.

### Phase 1: Financial correctness and atomicity

- [x] Make import commits atomic.
- [x] Correct investment cost basis.
- [x] Correct historical FX valuation.
- [x] Convert multi-request financial workflows.
- [ ] Make rules atomic.

### Phase 2: Recovery and ownership

- [x] Complete registry-based export and local restore tooling.
- [x] Complete a production PostgreSQL backup and restore drill.
- [x] Migrate production ownership to Supabase `sub`.
- [x] Add foreign keys.

### Phase 3: Release engineering

- [x] Fix lint.
- [x] Pin dependencies.
- [x] Add CI.
- [x] Define and test backup recovery objectives.
- [ ] Add readiness.
- [ ] Add logging.
- [ ] Add rate limits and timeouts.
- [ ] Define release and rollback.

### Phase 4: Accessibility and UX

- Restore browser zoom.
- Add focus management.
- Fix combobox keyboard behavior.
- Add live regions.
- Make charts keyboard accessible.
- Add reduced-motion support.
- [x] Add URL routing.
- Improve loading and errors.

### Phase 5: Public release preparation

- Add locale, currency, date, and time-zone settings.
- Add privacy and deletion.
- Complete OAuth production requirements.
- Establish monitoring and incident response.
- Reassess hosting plans.

## 19. Quick Wins

1. [x] Protect market-price routes.
2. [x] Fix the legacy transaction owner.
3. [ ] Document `VITE_SUPABASE_AUTH_ENABLED`.
4. [ ] Restore browser zoom.
5. [x] Fix lint.
6. [x] Pin backend dependencies.
7. [ ] Protect production API docs.
8. [ ] Add readiness.
9. [x] Add upload limits.
10. [x] Update export, validation, restore, and migration table coverage.
11. [ ] Add request logs.
12. [x] Add CI.
13. [ ] Remove personal defaults.
14. [ ] Remove hard-coded FX ranking.
15. [ ] Add reduced-motion support.

## 20. Upgrade Triggers

### Render

Upgrade when:

- cold starts are unacceptable
- users expect reliable access
- the app is publicly promoted
- support commitments exist
- free hours are exhausted

### Supabase

Upgrade when:

- database or egress approaches quotas
- stronger backup retention is needed
- point-in-time recovery is needed
- inactivity behavior is unacceptable
- production support is required

### Vercel

Upgrade when:

- Hobby limits are approached
- commercial usage requires it
- team governance, logs, bandwidth, or builds require it

## 21. Deferred

Do not prioritize before blockers:

- complex charts
- budget prediction
- expanded investment analytics
- automatic bank synchronization
- Open Banking
- OCR
- PDF imports
- advanced animations
- complex mobile polish
- multi-region deployment
- microservices
- event-driven architecture
- Kubernetes
- premature caching
- stack replacement without evidence

## 22. Open Questions

1. Invite-only or open registration?
2. Should market data be shared, user-specific, or admin-maintained?
3. Is moving weighted-average cost suitable for every intended tax jurisdiction?
4. Which base currencies are required?
5. Which languages are required?
6. Must the app work during backend cold starts?
7. Is local SQLite a first-class deployment?
8. How long are deleted accounts retained outside the documented backup schedule?
9. Should transaction categories become foreign-key references?
10. Is offline use real or only installability?
11. When does availability justify paid Render?
12. Are users outside Portugal targeted immediately?
13. Are market-data terms compatible with public release?

## 23. Definition of Global Release Ready

Global release readiness requires:

- no unauthenticated protected routes
- ownership-safe financial writes
- atomic multi-record operations
- verified investment calculations
- no look-ahead bias
- complete backup and restore coverage
- a successful restore drill
- stable user IDs
- foreign-key integrity
- upload and abuse controls
- passing tests, lint, build, migrations, and recovery checks in CI
- CI-gated deployment
- resolved accessibility blockers
- browser zoom enabled
- keyboard-only usability
- defined locale, currency, date, and time-zone behavior
- documented privacy, retention, export, and deletion
- monitoring and incident response
- accepted or upgraded hosting limitations
- completed OAuth production requirements
- current documentation
- tested release and rollback procedures

## 24. Verification Evidence

Current repository evidence on 2026-07-16:

- Branch: `main`.
- Verified code baseline before this documentation refresh: `fb56cb5`.
- Original audit baseline: commit `96c3f0c`.
- Full backend suite: 427 tests passed with 4 short test-key warnings.
- Frontend lint passed.
- Frontend production build passed.
- Required GitHub Actions checks passed.
- CI covers backend tests, clean database migration, recovery, frontend lint and build, dependency audits, and repository hygiene.
- Backend dependencies are exactly pinned.
- Explicit ownership is required throughout authenticated user-owned workflows.
- Supabase `sub` ownership and atomic ownership migration are implemented.
- Relational foreign keys and deliberate delete behavior protect linked records.
- Same-user and orphan integrity checks pass.
- Alembic has one head: `f7a3c9e2d814`.
- Upload request and file limits use bounded reads.
- Import commits require the matching preview identifier, uploaded file digest, and resolved-preview digest.
- Import commits remain atomic and duplicate-safe.
- Complete recovery registry and export format version 3 are implemented.
- JSON exports restore into clean SQLite with matching counts and relationship validation.
- The production PostgreSQL backup restored successfully with matching application-table counts.
- The restored production backup revision was `c4d2e6f8a130`.
- Backup RPO is 24 hours and target RTO is 4 hours during owner availability.
- Retention, encryption, off-device storage, recovery ownership, and restore-drill cadence are documented.
- Local SQLite backup uses the SQLite online backup API and validates `PRAGMA integrity_check`.
- SQLite backup output uses owner-only permissions and CLI failures are written to stderr.
- Owed-item system event dates consistently use the UTC calendar date.
- No production source file exceeds 1,000 lines.
- No open `CRIT` or `HIGH` items remain in this task list.

---

Critical and high-priority audit items are complete. Medium-priority operational, accessibility, privacy, and release-readiness work remains before public launch.
