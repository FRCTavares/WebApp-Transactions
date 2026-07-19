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
  documentation: the keep-warm ping now also checks backend readiness and
  frontend availability, a real test proves a bad database migration
  blocks deployment, and `docs/incident-response.md` /
  `docs/release-and-rollback.md` / `docs/production-operations-checklist.md`
  cover detection, triage, tested rollback procedures, and the
  dashboard-only items (OAuth, notification settings, Supabase capacity)
  that need periodic manual confirmation. (#33)

### Fixed

- A dialog focus-trap bug that stole focus away from whatever the user was
  typing into on every re-render, affecting every dialog in the app.
- Two local-SQLite schema-drift bugs: columns added only via Alembic
  migrations were missing from the separate legacy SQLite startup migration
  path, breaking CSV/XLSX import and export/wealth reads on any local
  database created before those migrations existed.
- A CI-only unhandled rejection caused by a missing unmount cleanup guard in
  `usePresentationPreferences`.

## How to maintain this file

Add an entry under `## Unreleased` for any user-facing change (feature,
fix, or breaking change) in the same pull request that makes the change.
When cutting a production deployment, rename `## Unreleased` to that
deployment's date and short commit hash, and start a fresh, empty
`## Unreleased` section above it.
