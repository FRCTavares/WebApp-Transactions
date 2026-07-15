# F - Transactions: Global Release Readiness TODO List

Last audited: 2026-07-12
Original audit baseline: commit `96c3f0c`
Current verification: 327 backend tests pass; frontend build passes; frontend lint still fails
Current deployment: Vercel frontend, Render backend, Supabase Postgres and Auth, Google OAuth

## 1. Executive Summary

F - Transactions has a solid personal-use foundation:

- FastAPI backend with repository and service layers.
- React and TypeScript frontend.
- SQLite support for local development.
- Supabase Postgres for production.
- Supabase Auth with Google OAuth.
- Explicit user ownership is enforced across repositories, services, and ORM constructors.
- Alembic migrations that successfully build a clean database through revision `d9e4f6a2b731`.
- 327 passing backend tests.
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
The most urgent remaining blockers are:

1. Linked financial records do not yet have relational foreign keys.
2. Upload endpoints have no size limits and load complete files into memory.
3. Import confirmation is not bound to the exact previewed file.
4. Pending FX handling is not consistent across transactions and investments.
5. There is no complete CI workflow.
6. Render free hosting causes measured cold starts of approximately 53 seconds.
7. Accessibility and keyboard support remain incomplete.
8. Monitoring, alerting, privacy, retention, and account deletion remain incomplete.

The correct strategy is not a large rewrite. Fix the security and data-integrity blockers first, establish reliable recovery and CI, then improve accessibility, navigation, internationalization, observability, and release operations.

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
- No SQLAlchemy foreign keys were found for linked records

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
- GitHub Actions workflow only for keeping the backend warm
- No normal continuous integration workflow

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

The following work does not require a paid plan:

- Protect market-price routes
- Fix legacy import ownership
- Add CI
- Pin dependencies
- Add upload limits
- Add transaction boundaries
- Add issuer validation
- Add request IDs and structured logs
- Fix accessibility defects
- Fix lint
- Add foreign keys through migrations
- Update exports and recovery tools
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
| Data integrity | 3/5 | Atomic imports and investment accounting are corrected; foreign keys remain missing |
| Authentication | 5/5 | Stable `sub` ownership is deployed, production data is migrated, and JWT issuer validation is enforced |
| Authorization | 4/5 | Market routes are protected and user-owned operations require explicit ownership |
| Import reliability | 3/5 | Atomic commits pass; upload controls and preview binding remain |
| Recovery | 3/5 | Complete registry-based recovery passes local tests; production PostgreSQL restoration also passes |
| Security | 2/5 | Basic headers and auth exist; rate limiting, limits, monitoring, and privacy are absent |
| Frontend architecture | 3/5 | API separation exists, but several pages are oversized and workflow logic is duplicated |
| UI/UX | 3/5 | Functional and responsive, but navigation, loading, consistency, and personal defaults need work |
| Accessibility | 1/5 | Dialog, combobox, chart, zoom, focus, and motion issues remain |
| Internationalization | 1/5 | Hard-coded English, EUR, locales, and personal assumptions |
| Testing | 4/5 | 327 backend tests pass; frontend lint, frontend tests, and end-to-end coverage remain weak |
| CI/CD | 1/5 | No normal release validation workflow |
| Observability | 1/5 | No structured logging, metrics, monitoring, or alerting |
| Performance | 2/5 | Free-host cold starts, full-memory uploads, and repeated commits |
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

The combined working tree must not be deployed before the remaining high-priority integrity and release checks are completed.

## 6. High Priority

## 7. Medium Priority

### MED-001: Fix all frontend lint errors

- Evidence:
  - Build passes.
  - Lint reports 13 errors and 4 warnings.

- Acceptance criteria:
  - `npm run lint` exits zero.
  - CI enforces it.
- Effort: Small

### MED-002: Split oversized frontend files

- Evidence:
  - `TransactionsPage.tsx`: 999 lines.
  - `dashboard.css`: 922 lines.
  - `wealth.css`: 915 lines.

- Proposed fix:
  - Extract focused hooks, modals, sections, and CSS files.

- Acceptance criteria:
  - No production source file exceeds 900 lines.
- Effort: Medium

### MED-003: Replace frontend multi-request financial workflows with backend commands

- Risk:
  - Partial success can leave inconsistent records.

- Proposed fix:
  - Add atomic backend command endpoints.

- Acceptance criteria:
  - One request performs the complete operation.
  - Failure rolls back all changes.
- Effort: Medium

### MED-004: Add URL routing

- Evidence:
  - Navigation uses state and localStorage.

- Risk:
  - No deep links, browser history, or refresh-safe routes.

- Proposed fix:
  - Add minimal React routing.

- Acceptance criteria:
  - Every major screen has a stable URL.
  - Back, forward, and not-found behavior work.
- Effort: Medium

### MED-005: Add request cancellation, timeouts, and auth recovery

- Evidence:
  - Frontend client lacks bounded timeouts, abort support, and centralized `401` handling.

- Proposed fix:
  - Use `AbortController`.
  - Normalize errors.
  - Handle expired sessions centrally.
  - Never automatically retry financial writes.
- Effort: Medium

### MED-006: Improve loading and partial-failure states

- Evidence:
  - Some screens show empty states while loading.
  - Some optional request failures blank whole screens.
  - Some failures are swallowed.

- Proposed fix:
  - Separate loading, empty, error, and partial-data states.
  - Use independent optional widget failures.
- Effort: Medium

### MED-007: Remove personal hard-coded frontend defaults

- Evidence:
  - Investment flows contain personal dates, amounts, sources, and notes.
  - App fallback name includes `Francisco`.

- Acceptance criteria:
  - New users see only neutral defaults.
- Effort: Small

### MED-008: Replace the hard-coded FX match rate

- Evidence:
  - FX ranking contains a fixed USD-to-EUR rate of `0.92`.

- Proposed fix:
  - Use a supplied or stored date-appropriate rate.
- Effort: Small

### MED-009: Make rule application atomic and efficient

- Evidence:
  - Rule services update and commit transactions individually.

- Proposed fix:
  - Apply changes in one transaction and batch where safe.
- Effort: Medium

### MED-010: Add production readiness health checks

- Evidence:
  - `/api/health` only returns `{"status":"ok"}`.

- Proposed fix:
  - Keep liveness.
  - Add readiness for database connectivity and migration revision.
- Effort: Small

### MED-011: Add structured application logging

- Proposed fix:
  - Log request ID, route, method, status, duration, and safe user identifier.
  - Never log tokens or uploaded finance contents.
- Effort: Medium

### MED-012: Add rate limiting and abuse controls

- Apply to:
  - market-data fetches
  - uploads
  - exports
  - expensive rule operations

- Acceptance criteria:
  - Excess requests receive `429`.
- Effort: Medium

### MED-013: Decide production API documentation policy

- Evidence:
  - `/docs`, `/redoc`, and `/openapi.json` are public.

- Proposed fix:
  - Disable or protect them in production.
- Effort: Small

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

- Add foreign keys.
- Add cascade policies.
- Add same-user validation.
- Add orphan checks to the audit.

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

- Protect public market endpoints.
- Add upload limits.
- Add rate limits.
- Add request and database timeouts.
- Pin dependencies.
- Add security checks in CI.
- Add a Content Security Policy where practical.
- Restore browser zoom.
- Decide API documentation exposure.
- Redact sensitive logs.

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
- Full-memory uploads
- Commits in loops
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

- Add CI
- Fix lint
- Pin dependencies
- Protect market endpoints
- Add readiness
- Add structured logs
- Document all environment variables
- Verify Supabase redirects
- Verify Google authorized domains
- Test recovery

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
- [ ] Convert multi-request financial workflows.
- [ ] Make rules atomic.

### Phase 2: Recovery and ownership

- [x] Complete registry-based export and local restore tooling.
- [x] Complete a production PostgreSQL backup and restore drill.
- [x] Migrate production ownership to Supabase `sub`.
- [x] Add foreign keys.

### Phase 3: Release engineering

- Fix lint.
- Pin dependencies.
- Add CI.
- Add readiness.
- Add logging.
- Add rate limits and timeouts.
- Define release and rollback.

### Phase 4: Accessibility and UX

- Restore browser zoom.
- Add focus management.
- Fix combobox keyboard behavior.
- Add live regions.
- Make charts keyboard accessible.
- Add reduced-motion support.
- Add URL routing.
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
5. [ ] Fix lint.
6. [ ] Pin backend dependencies.
7. [ ] Protect production API docs.
8. [ ] Add readiness.
9. [ ] Add upload limits.
10. [x] Update export, validation, restore, and migration table coverage.
11. [ ] Add request logs.
12. [ ] Add CI.
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
6. What RPO is acceptable?
7. What RTO is acceptable?
8. Must the app work during backend cold starts?
9. Is local SQLite a first-class deployment?
10. How long are deleted accounts and backups retained?
11. Should transaction categories become foreign-key references?
12. Is offline use real or only installability?
13. When does availability justify paid Render?
14. Are users outside Portugal targeted immediately?
15. Are market-data terms compatible with public release?

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

Current working-tree evidence on 2026-07-12:

- Branch: `main`.
- Original audit baseline: commit `96c3f0c`.
- Full backend suite: 327 tests passed with 4 short test-key warnings.
- Python compilation passed.
- Explicit ownership is required across user-owned repositories, services, routers, and ORM constructors.
- All 12 user-owned model fields have no Python-side or server-side ownership default.
- Permanent source-level ownership guardrails reject omitted owners and unapproved local fallback references.
- Alembic has one head: `d9e4f6a2b731`.
- Clean temporary Alembic upgrade passed through `d9e4f6a2b731`.
- Frontend production build passed.
- Frontend lint still fails with 13 errors and 4 warnings.
- `git diff --check` passed.
- No changed production source file reaches 1,000 lines.
- Complete recovery registry and export format version 2 are implemented.
- Generated JSON exports restore into clean SQLite with row-count and relationship verification.
- Moving weighted-average investment cost basis is implemented.
- Matching-currency sell validation is implemented.
- Historical investment valuations avoid future FX look-ahead.
- Supabase `sub` ownership and atomic ownership-migration tooling are implemented.
- Production ownership preflight found 1,029 legacy-owned rows and zero target-owned rows.
- The production PostgreSQL dump passed checksum and archive validation.
- PostgreSQL restore drill passed: true.
- Restored Alembic revision: `c4d2e6f8a130`.
- Restore evidence is retained outside the repository in the secured local backup directory.
- Production ownership migration completed atomically: the legacy owner now has zero rows and the Supabase subject owns all 1,029 rows with unchanged per-table counts.
- Authenticated production smoke testing passed for dashboard, transactions, wealth, investments, owed records, settings, and categories.
- Supabase JWT issuer validation is enforced for both legacy-secret and JWKS decoding paths.
- Wrong-issuer regression tests pass and valid Supabase issuer tokens remain accepted.
- Commit `27a93f7` deployed successfully; fresh production sign-in and authenticated dashboard data loading passed.

---

Critical security, ownership, financial correctness, atomicity, and recovery issues must be completed before public launch.
