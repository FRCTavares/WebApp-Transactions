# F - Transactions: Global Release Readiness TODO List
Last audited: 2026-07-11
Audit baseline: commit `96c3f0c`
Current deployment: Vercel frontend, Render backend, Supabase Postgres and Auth, Google OAuth
## 1. Executive Summary
F - Transactions has a solid personal-use foundation:
- FastAPI backend with repository and service layers.
- React and TypeScript frontend.
- SQLite support for local development.
- Supabase Postgres for production.
- Supabase Auth with Google OAuth.
- User-scoped queries across most financial features.
- Alembic migrations that successfully build a clean database.
- 275 passing backend tests.
- Successful frontend production build.
- Working production CORS, bearer-token enforcement, and security headers.
- Current local database passes the existing integrity audit.
The application is not ready for unrestricted global release.
The most urgent blockers are:
1. Market-price read and write endpoints are publicly accessible without authentication.
2. Legacy Excel transaction imports assign records to `local-default-user` instead of the authenticated user.
3. Financial operations that span multiple records are not consistently atomic.
4. Backup, export, restore, and SQLite-to-Postgres migration tooling omit current tables.
5. Production ownership uses email addresses instead of the stable Supabase user ID.
6. There are no relational foreign keys for linked financial records.
7. Upload endpoints have no size limits and load complete files into memory.
8. Frontend lint currently fails.
9. There is no CI workflow for tests, lint, builds, migrations, or recovery checks.
10. Render free hosting causes measured cold starts of approximately 53 seconds.
11. Accessibility and keyboard support are incomplete.
12. There is no production-grade monitoring, alerting, privacy process, or account-deletion workflow.
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
- JWT signature, expiration, and audience validation
- Email-based allowlist
- Application owner ID currently derived from normalized email
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
| Backend architecture | 3/5 | Good layering, but transaction boundaries and defaults need work |
| Data integrity | 2/5 | Constraints exist, but foreign keys and atomic workflows are missing |
| Authentication | 3/5 | Supabase auth works, but ownership and issuer validation need correction |
| Authorization | 2/5 | Most routes are scoped; market-price routes are publicly exposed |
| Import reliability | 2/5 | Modular importers exist, but commit atomicity and upload controls are weak |
| Recovery | 1/5 | Current export, restore, and migration helpers are incomplete |
| Security | 2/5 | Basic headers and auth exist; rate limiting, limits, monitoring, and privacy are absent |
| Frontend architecture | 3/5 | API separation exists, but several pages are oversized and workflow logic is duplicated |
| UI/UX | 3/5 | Functional and responsive, but navigation, loading, consistency, and personal defaults need work |
| Accessibility | 1/5 | Dialog, combobox, chart, zoom, focus, and motion issues remain |
| Internationalization | 1/5 | Hard-coded English, EUR, locales, and personal assumptions |
| Testing | 3/5 | Strong backend suite; frontend and end-to-end coverage are weak |
| CI/CD | 1/5 | No normal release validation workflow |
| Observability | 1/5 | No structured logging, metrics, monitoring, or alerting |
| Performance | 2/5 | Free-host cold starts, full-memory uploads, and repeated commits |
| Documentation | 2/5 | Deployment docs exist, but several documents are stale |
| Global release readiness | 2/5 | Suitable for controlled use, not public global shipment |
## 5. Critical Blockers
### CRIT-001: Protect every market-price endpoint
- Evidence:
  - `backend/app/routers/market_prices.py` contains no `Depends(get_current_user)`.
  - Unauthenticated production requests to `/api/market-prices` and `/api/market-prices/history` returned `200`.
  - Invalid unauthenticated writes reached validation or repository logic and returned `422` or `404`.
- Risk:
  - Public reads of shared market data.
  - Public create, update, delete, and provider-fetch access.
  - Possible corruption of valuation data.
  - Abuse of outbound market-data calls.
- Proposed fix:
  - Add `CurrentUser = Depends(get_current_user)` to every route.
  - Decide whether authenticated users may mutate global prices.
  - Require explicit privileged authorization for mutation and fetch endpoints.
  - Rate-limit provider-backed endpoints.
- Acceptance criteria:
  - Every unauthenticated market-price route returns `401`.
  - Mutation endpoints require privileged authorization.
  - Tests cover all market-price routes.
  - Production smoke tests confirm the policy.
- Dependencies: Authorization-role decision
- Effort: Small
- Paid plan required: No
### CRIT-002: Fix legacy Excel transaction ownership
- Evidence:
  - `LegacyExcelImportService._build_transactions_to_insert()` sets `user_id=LOCAL_DEFAULT_USER_ID`.
- Paths:
  - `backend/app/services/legacy_excel_import_service.py`
  - `backend/app/routers/legacy_excel_imports.py`
  - `backend/tests/test_legacy_excel_import_commit.py`
- Risk:
  - Imported transactions can be assigned to the wrong owner.
  - Imported records may disappear for the authenticated user.
  - Cross-user contamination is possible.
- Proposed fix:
  - Pass the authenticated user ID into `_build_transactions_to_insert()`.
  - Remove the hard-coded owner.
  - Audit owed-item and wealth builders for the same pattern.
  - Add two-user ownership tests.
- Acceptance criteria:
  - Imported transactions belong to `current_user.id`.
  - No authenticated import writes `local-default-user`.
  - User A cannot see User B legacy imports.
- Dependencies: None
- Effort: Small
- Paid plan required: No
### CRIT-003: Make import commits atomic
- Evidence:
  - Import batches, transactions, and investment events commit through separate repository operations.
- Risk:
  - Partial imports.
  - Incorrect batch counts.
  - Difficult recovery after exceptions.
  - Race-condition failures during deduplication.
- Proposed fix:
  - Let the service own one database transaction.
  - Replace repository-level commits with `flush()` where composition is required.
  - Commit once after all records and counts are valid.
  - Roll back the complete import on failure.
  - Handle `IntegrityError` as a controlled conflict.
- Acceptance criteria:
  - Forced failure at any stage leaves no partial records.
  - Concurrent duplicate imports do not produce unhandled `500` responses.
  - Batch counts match committed records.
- Dependencies: Repository transaction-boundary cleanup
- Effort: Medium
- Paid plan required: No
### CRIT-004: Complete backup, export, restore, and migration coverage
- Evidence:
  - Current models include `transaction_categories` and `investment_funding_months`.
  - Export, validation, restore, and migration helper table lists omit them.
- Paths:
  - `backend/app/repositories/export_repository.py`
  - `backend/app/services/export_service.py`
  - `backend/scripts/migrate_sqlite_to_postgres.py`
  - `backend/scripts/validate_json_export.py`
  - `backend/scripts/restore_json_export_dry_run.py`
- Risk:
  - Backups can pass while incomplete.
  - Restores can silently lose configuration and investment metadata.
  - SQLite-to-Postgres migration is incomplete.
- Proposed fix:
  - Define one authoritative recovery table registry.
  - Include every current user-owned table.
  - Version the export format.
  - Add source-versus-restored row-count checks.
  - Add a full restore test to CI.
- Acceptance criteria:
  - Every current user-owned table is exported, validated, restored, and migration-covered.
  - A generated export restores into a clean database.
  - Restored counts and key relationships match the source.
- Dependencies: Reflect foreign-key and ownership decisions
- Effort: Medium
- Paid plan required: No
### CRIT-005: Correct investment sell cost-basis calculations
- Evidence:
  - Sell handling reduces cost basis using sale proceeds rather than the acquisition cost of units sold.
- Paths:
  - `backend/app/services/investment_event_service.py`
  - `backend/tests/test_investment_positions.py`
- Risk:
  - Remaining cost basis is wrong after partial sells.
  - Unrealized gain and performance values become unreliable.
- Proposed fix:
  - Choose and document average cost or FIFO.
  - Reduce cost basis using allocated acquisition cost.
  - Calculate realized gain separately.
- Acceptance criteria:
  - Partial and full sell examples match manual calculations.
  - Full liquidation leaves zero units and zero cost basis.
  - Tests cover multiple buys, partial sells, full sells, fees, and currencies.
- Dependencies: Accounting-method decision
- Effort: Medium
- Paid plan required: No
### CRIT-006: Remove look-ahead bias from historical investment valuations
- Evidence:
  - Historical portfolio values use the latest FX rate instead of an as-of-date rate.
- Risk:
  - Historical values change when current rates change.
  - Monthly charts do not represent actual historical values.
- Proposed fix:
  - Use market and FX values effective on or before each valuation date.
  - Define fallback behavior for missing historical FX data.
  - Mark estimated values.
- Acceptance criteria:
  - Historical values remain stable when only current rates change.
  - Exact-date, prior-date, and missing-rate cases are tested.
- Dependencies: Historical FX storage strategy
- Effort: Medium
- Paid plan required: No
## 6. High Priority
### HIGH-001: Use Supabase `sub` as the stable user ID
- Evidence:
  - JWTs contain `sub`.
  - `CurrentUser.id` currently uses normalized email.
- Risk:
  - Email changes create a new logical owner or strand existing records.
- Proposed fix:
  - Use JWT `sub` for ownership.
  - Keep email as profile metadata and allowlist input.
  - Migrate email-owned production rows to stable IDs.
- Acceptance criteria:
  - New records use Supabase user IDs.
  - Existing data is migrated without loss.
  - Email changes do not affect ownership.
- Effort: Medium
- Paid plan required: No
### HIGH-002: Validate JWT issuer explicitly
- Evidence:
  - Signature, audience, and expiry are checked.
  - Explicit issuer validation was not found.
- Proposed fix:
  - Derive the expected issuer from the Supabase project.
  - Pass `issuer=` during JWT decoding.
  - Validate `sub`, `email`, `aud`, `exp`, and issuer.
- Acceptance criteria:
  - Wrong-issuer tokens are rejected.
  - Valid Supabase tokens remain accepted.
- Effort: Small
- Paid plan required: No
### HIGH-003: Remove silent production fallbacks to `local-default-user`
- Evidence:
  - Repositories and services widely default to local ownership.
- Risk:
  - Missed ownership arguments silently read or write the wrong user.
- Proposed fix:
  - Require explicit `user_id` in user-owned repositories.
  - Require `CurrentUser` in production services.
  - Keep local behavior in a deliberate adapter or test fixture.
- Acceptance criteria:
  - Production code cannot call user-owned operations without an owner.
  - Static checks or tests fail when ownership is omitted.
- Effort: Large
- Paid plan required: No
### HIGH-004: Add relational foreign keys and ownership-safe relationships
- Relationships needing review:
  - `transactions.import_batch_id`
  - `investment_events.transaction_id`
  - `investment_events.matched_transaction_id`
  - `investment_events.import_batch_id`
  - `owed_items.linked_transaction_id`
  - `owed_items.import_batch_id`
  - `owed_payments.linked_transaction_id`
  - `owed_payment_allocations.owed_payment_id`
  - `owed_payment_allocations.owed_item_id`
  - `wealth_snapshots.account_id`
  - `wealth_snapshots.import_batch_id`
- Risk:
  - Orphans, invalid links, missing cascades, and cross-user references.
- Proposed fix:
  - Add foreign keys through Alembic.
  - Define deletion behavior.
  - Reject cross-user relationships.
- Acceptance criteria:
  - Invalid relationships fail at database level.
  - Cascades are documented and tested.
  - Cross-user linking is rejected.
- Effort: Large
- Paid plan required: No
### HIGH-005: Add upload limits and safe file handling
- Evidence:
  - Upload endpoints call `await file.read()` without size checks.
- Paths:
  - `backend/app/routers/imports.py`
  - `backend/app/routers/legacy_excel_imports.py`
- Risk:
  - Memory exhaustion and parsing abuse.
- Proposed fix:
  - Define per-import size limits.
  - Reject oversized files early.
  - Read in bounded chunks.
  - Validate extension and expected format.
  - Add request timeouts.
- Acceptance criteria:
  - Oversized files return `413`.
  - Invalid files return controlled client errors.
  - Boundaries are tested.
- Effort: Medium
- Paid plan required: No
### HIGH-006: Bind import confirmation to the exact previewed file
- Evidence:
  - Preview and commit upload and parse the file separately.
- Risk:
  - Committed content can differ from previewed content.
- Proposed fix:
  - Return a preview ID and SHA-256 hash.
  - Persist a short-lived preview or signed payload.
  - Require commit to match the preview hash.
- Acceptance criteria:
  - A different file cannot be committed under an existing preview.
  - Expired previews are rejected.
  - Commit counts match preview counts.
- Effort: Medium
- Paid plan required: No
### HIGH-007: Resolve pending FX consistently
- Evidence:
  - Pending-FX enforcement focuses on transactions.
  - Trading 212 investment events can retain unresolved non-EUR values.
- Proposed fix:
  - Apply one pending-FX contract to transactions and investment events.
  - Block commit or persist a clearly unresolved state.
- Acceptance criteria:
  - No unresolved event is treated as final.
  - Preview clearly reports pending FX.
- Effort: Medium
- Paid plan required: No
### HIGH-008: Add a complete CI workflow
- Evidence:
  - Only the keep-warm workflow exists.
  - Frontend lint fails.
- Required checks:
  - backend tests
  - frontend lint
  - frontend build
  - clean Alembic upgrade
  - integrity audit
  - export and restore test
  - dependency checks
  - `git diff --check`
- Acceptance criteria:
  - Merges require all checks.
  - Deployment is blocked when CI fails.
- Effort: Medium
- Paid plan required: No
### HIGH-009: Pin backend dependencies
- Evidence:
  - `backend/requirements.txt` contains unversioned packages.
- Risk:
  - Non-reproducible and unstable builds.
- Proposed fix:
  - Use exact tested versions or a lock workflow.
  - Add scheduled dependency updates.
- Acceptance criteria:
  - Clean installs use deterministic versions.
  - CI runs `pip check`.
- Effort: Small
- Paid plan required: No
### HIGH-010: Establish tested backup and recovery objectives
- Evidence:
  - SQLite backup uses direct file copy.
  - Recovery scripts are incomplete.
  - No RPO or RTO is defined.
- Proposed fix:
  - Use SQLite backup API or `VACUUM INTO`.
  - Define RPO and RTO.
  - Encrypt retained local backups.
  - Perform restore drills.
- Acceptance criteria:
  - A recent backup restores into a clean environment.
  - Retention and encryption are documented.
- Effort: Medium
- Paid plan required:
  - No for manual tested exports.
  - Possibly yes for stronger managed recovery.
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
- Protect market-price endpoints.
- Fix legacy import ownership.
- Add regression tests.
- Deploy and smoke-test production.
### Phase 1: Financial correctness and atomicity
- Atomic imports.
- Correct investment cost basis.
- Correct historical FX.
- Convert multi-request financial workflows.
- Make rules atomic.
### Phase 2: Recovery and ownership
- Complete recovery tooling.
- Migrate to Supabase `sub`.
- Remove silent local defaults.
- Add foreign keys.
- Run a restore drill.
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
1. Protect market-price routes.
2. Fix the legacy transaction owner.
3. Document `VITE_SUPABASE_AUTH_ENABLED`.
4. Restore browser zoom.
5. Fix lint.
6. Pin backend dependencies.
7. Protect production API docs.
8. Add readiness.
9. Add upload limits.
10. Update export table lists.
11. Add request logs.
12. Add CI.
13. Remove personal defaults.
14. Remove hard-coded FX ranking.
15. Add reduced-motion support.
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
3. Average cost or FIFO?
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
Audit evidence: branch `main`; commit `96c3f0c`; clean working tree; 275 backend tests passed; `pip check` passed; clean Alembic upgrade reached `c4d2e6f8a130`; local and temporary integrity audits passed; frontend build passed; frontend lint failed with 13 errors and 4 warnings; npm audits found no known vulnerabilities; backend requirements are unpinned; production health returned `200`; unauthenticated `/api/me` returned `401`; CORS and security headers were correct; a cold request took about 53.4 seconds; production API docs were public; unauthenticated market-price reads returned `200`; unauthenticated writes reached validation and repository logic; recovery registries omit current tables; browser zoom is disabled; accessibility gaps remain; and several source files are near the 1,000-line limit.
---
Critical security, ownership, financial correctness, atomicity, and recovery issues must be completed before public launch.
