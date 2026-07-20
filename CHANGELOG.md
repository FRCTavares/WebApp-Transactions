# Changelog

All notable, user-facing changes are documented here.

Deployments are identified by short git commit hashes rather than semantic
version numbers — see the "Build versioning" section in `README.md` for how
that's generated. The current running build's commit is shown in
**Settings → Build** in the app, and in the `version` field of
`GET /api/health`.

## Unreleased

### Added

- Real offline support: a service worker caches the app shell and API GET
  responses so the last-loaded data stays visible offline, with a visible
  "You're offline" notice. Writes still fail naturally offline; there is no
  offline write queue/sync. (#25)
- A documented, CI-verified supported browser matrix (Chrome/Edge 111+,
  Firefox 114+, Safari 16.4+), backed by running the e2e suite across
  Chromium, Firefox, and WebKit, desktop and mobile. (#24)
- Build version visibility: the running commit is shown in Settings and in
  `GET /api/health`. (#26)
- Expanded frontend and end-to-end test coverage: 11 unit test files / 31
  tests, plus a Playwright e2e suite with real (locally-minted) Supabase
  session authentication against a live backend. (#32)
- Production monitoring, incident response, and release/rollback
  documentation: `keep-backend-warm.yml`'s existing health/readiness/
  frontend checks are now documented as the primary automated monitoring
  path, a real regression test proves a broken database migration blocks
  deployment, and `docs/incident-response.md`, `docs/release-and-rollback.md`,
  and `docs/oauth-and-hosting-checklist.md` cover detection, triage,
  documented rollback procedures, and the dashboard-only items (OAuth,
  Supabase capacity, deploy notifications) that need the owner's own
  periodic manual confirmation. (#33)
- Documentation refresh: `frontend/README.md` (previously unedited Vite
  boilerplate), `docs/deployment.md` (now a complete environment variable
  reference plus local/production setup steps), and both `.env.example`
  files were brought up to date; new `docs/auth-options.md` and
  `docs/multi-user-data-model.md` document how auth and per-user ownership
  actually work, including that disabling `VITE_SUPABASE_AUTH_ENABLED`
  only hides the login screen — the backend requires a real Supabase JWT
  regardless. (#34)
- A public, unauthenticated `/privacy` page (`frontend/src/pages/PrivacyPage.tsx`)
  mirroring `docs/privacy.md`, so Google's OAuth consent screen (and anyone
  else) has a real public link instead of one behind the login wall. (#33
  follow-up)
- A CI safeguard (`scripts/check_migration_drift.py`, run as
  `tests/test_migration_drift.py`) that fails the build if an Alembic
  migration adds or renames a column or table with no matching reference in
  the legacy SQLite startup migrations (`app/database_migrations.py`) —
  closing the exact gap that caused two real local-only 500 errors found
  during #32's e2e work.

- Automated production database backups
  (`.github/workflows/backup-database.yml`): daily `pg_dump`, `pg_restore
  --list` validation, SHA-256 checksum, GPG (AES-256) encryption, uploaded
  as a GitHub Actions artifact. Replaces a manual procedure
  (`docs/backups-supabase.md`) that turned out not to be consistently
  run — discovered while walking through
  `docs/oauth-and-hosting-checklist.md` that Supabase's Free plan includes
  no built-in backups at all, so this had been the only backup mechanism
  all along.
- Promoted the "Frontend e2e" CI job to a required check, after confirming
  it has succeeded on every run since being introduced in #32.

### Fixed

- Corrected the recorded market-data ownership decision
  (`docs/production-roadmap.md`) to match the actual shared/admin-maintained
  implementation, instead of the stale "user-specific" recorded decision
  that never matched the code.

### Security

- Real, unresolved risk identified: Yahoo Finance's Terms of Service
  prohibit automated scraping and commercial use without written
  permission. `yfinance` (this project's market-data source) wraps Yahoo's
  unofficial endpoints. Acceptable at the current personal/small-invited-
  group scale; must be resolved (licensed provider) before any wider public
  release. See `docs/production-roadmap.md` decision 13.

- `.github/workflows/keep-backend-warm.yml` was written to ping every 10
  minutes but GitHub Actions silently throttled it to roughly hourly
  (every run succeeded — it just wasn't running as often as intended).
  Added cron-job.org (free, external) for reliable 10-minute pinging;
  the GitHub Actions workflow now documented for what it actually
  provides, failure-alert monitoring at its real cadence.
- Render's Health Check Path was set to `/api/health` (trivial, no DB
  check) instead of `render.yaml`'s committed `/api/ready` (checks
  database connectivity) — meaning the zero-downtime deploy gate could
  route traffic to an instance that couldn't reach the database. Found
  and fixed while walking through `docs/oauth-and-hosting-checklist.md`.
- Account deletion was silently broken in production: `render.yaml` lists
  `SUPABASE_SERVICE_ROLE_KEY` as required, but it was never actually set on
  Render, so every deletion request failed with a controlled 503. Found
  while walking through `docs/oauth-and-hosting-checklist.md`; fixed by
  adding the key and redeploying.

- A dialog focus-trap bug that stole focus away from whatever the user was
  typing into on every re-render, affecting every dialog in the app.
- Two local-SQLite schema-drift bugs: columns added only via Alembic
  migrations were missing from the separate legacy SQLite startup migration
  path, breaking CSV/XLSX import and export/wealth reads on any local
  database created before those migrations existed.
- A CI-only unhandled rejection caused by a missing unmount cleanup guard in
  `usePresentationPreferences`.
- A duplicate dashboard-checklist file created under two different names
  across two separate pieces of work; consolidated into one.

## How to maintain this file

Add an entry under `## Unreleased` for any user-facing change (feature,
fix, or breaking change) in the same pull request that makes the change.
When cutting a production deployment, rename `## Unreleased` to that
deployment's date and short commit hash, and start a fresh, empty
`## Unreleased` section above it.
