# F - Transactions: Open Tasks

Project overview, stack, and free-tier context: [`README.md`](README.md).
Readiness scorecard, verification evidence, and resolved decisions:
[`docs/production-roadmap.md`](docs/production-roadmap.md).

This file lists only open, actionable work, ordered by the project's stated
priority: security, ownership, financial correctness, atomicity, backup and
recovery, data integrity, CI/deployment reliability, accessibility, UI.

Remaining work is CI/deployment reliability, documentation, accessibility
follow-through verification, and UI/codebase maintainability.

## Data Integrity — real gap found and fixed (2026-07-20)

While walking through the Render section of
`docs/oauth-and-hosting-checklist.md`, found `SUPABASE_SERVICE_ROLE_KEY` was
completely absent from production. Account deletion
(`app/services/account_deletion_service.py`) was silently broken as a
result — it fails with a controlled 503 rather than a crash, so this had no
visible symptom unless someone actually tried to delete their account.
Fixed: added the legacy `service_role` JWT key (not the newer
`sb_secret_...` format — the code was written and tested against the JWT
style) to Render, redeployed, confirmed live.

## Reliability — real gap found and fixed (2026-07-20)

While confirming the keep-warm policy in `docs/oauth-and-hosting-checklist.md`,
found `.github/workflows/keep-backend-warm.yml` was written for a 10-minute
cron schedule but its actual run history showed ~hourly execution — every
run succeeded, GitHub Actions was just silently throttling the frequent
schedule (a documented platform limitation, not a workflow bug). Since real
10-minute pinging was wanted to actually counter Render's sleep timer,
added **cron-job.org** (free, external) hitting `GET /api/health` every 10
minutes as the real keep-warm mechanism. The GitHub Actions workflow stays
for what it's actually good at (failure-alert monitoring), documented at
its real ~hourly cadence in `docs/incident-response.md`.

## CI/Deployment — real gap found and fixed (2026-07-20)

While walking through the Render section of
`docs/oauth-and-hosting-checklist.md`, found the dashboard's Health Check
Path was set to `/api/health` (a trivial liveness check with no DB
connectivity check) instead of `render.yaml`'s committed `/api/ready`
(actually checks the database via `app/services/health_service.py`). This
meant Render's zero-downtime deploy gate could have routed traffic to a new
instance that couldn't reach the database. Fixed by updating the dashboard
setting to `/api/ready`; confirmed live.

## Backup and Recovery — real gap found and fixed (2026-07-20)

While walking through `docs/oauth-and-hosting-checklist.md`, found that
Supabase's Free plan includes **zero built-in backups** (contrary to what
the checklist's own wording assumed), and that this project's own manual
`pg_dump` backup procedure (`docs/backups-supabase.md`) was documented but
not actually being run consistently — meaning production had no real,
current recoverable backup. Fixed by automating it via
`.github/workflows/backup-database.yml` (daily cron + `workflow_dispatch`).

Confirmed working end to end 2026-07-20: both secrets
(`BACKUP_DATABASE_URL` using the session pooler connection — direct/IPv6
connections aren't reachable from GitHub-hosted runners — and
`BACKUP_ENCRYPTION_PASSPHRASE`) are set, and a manual
`workflow_dispatch` run succeeded (run `29737009857`, artifact
`postgres-backup-29737009857`), after fixing an initial `pg_dump`
major-version mismatch (runner ships v16; Supabase runs Postgres 17 — the
workflow now installs and PATH-prioritizes the matching PGDG v17 client).
Accepted gap, not tracked as open work: GitHub Actions' 90-day artifact
retention ceiling means the twelve-monthly retention tier isn't really
satisfied yet. Given the owner does not want to pay for hosting/storage
(confirmed 2026-07-20), a paid off-device storage provider isn't on the
table — this stays as a known, accepted limitation (see
`docs/backups-supabase.md`'s Retention section).

## 7. CI and Deployment Reliability

PR #3 (`pydantic-core` 2.46.4 → 2.47.0) was closed, not merged:
`pydantic-core==2.47.0` conflicts with the pinned `pydantic==2.13.4` in
`requirements.txt`, so `pip install -r requirements.txt` fails to resolve —
that's why backend-tests, database-validation, and dependency-audit all
failed on it. Revisit when a coordinated `pydantic`/`pydantic-core` bump is
available.

A CI check now fails if any Alembic migration adds/renames a column or
table without an equivalent update to the legacy SQLite startup migrations
in `backend/app/database_migrations.py` — this exact gap caused two real
local-only 500 errors found via #32's e2e work (see the Testing section
below). Implemented as `backend/scripts/check_migration_drift.py`, wired
into the normal test run via `backend/tests/test_migration_drift.py`.
Intentional exceptions (new tables `create_all()` handles for free, with no
backfill needed) are documented in
`backend/scripts/legacy_migration_exemptions.py`.

#33 is complete: production monitoring (documented `keep-backend-warm.yml`'s
dual role — cold-start mitigation and the primary automated alert path via
GitHub's default failed-scheduled-workflow email), an incident runbook
(`docs/incident-response.md`), a documented release/rollback procedure
(`docs/release-and-rollback.md` — the migration-failure-blocks-deploy claim
has a real regression test,
`backend/tests/test_migration_failure_blocks_deploy.py`; the dashboard
rollback steps themselves are documented, not automatable from here), the
Render cold-start/keep-warm policy explicitly reaffirmed, and a
dashboard-only checklist for the parts that need real Google Cloud
Console/Supabase/Render/Vercel access to verify
(`docs/oauth-and-hosting-checklist.md`) — walk through and tick that off
when convenient; nothing in this repo can verify those items for you.

`docs/oauth-and-hosting-checklist.md` was fully walked through and closed
2026-07-20 — every section confirmed, with three real production bugs
found and fixed along the way (see the dated sections above). #33 is
closed.

## 8. Documentation

#34 is complete: `README.md`, `frontend/README.md` (was unedited Vite
boilerplate), `docs/deployment.md` (now has a full environment variable
reference table plus local/production setup steps), and
`docs/production-roadmap.md` (stale test counts and commit references
refreshed) were all reviewed and refreshed. `docs/auth-options.md` and
`docs/multi-user-data-model.md` were added (previously missing).
`VITE_SUPABASE_AUTH_ENABLED` and every other environment variable are now
documented in `docs/deployment.md`, including the important correction that
disabling it only hides the login screen — the backend's local-auth bypass
was removed, so every request still needs a real Supabase JWT regardless
(`docs/auth-options.md`). Both `.env.example` files were incomplete and are
now accurate. Also found and fixed a real duplicate-file bug from #33's
work (two overlapping dashboard checklists under different names) and a
genuine product-decision-vs-implementation discrepancy on market data
ownership, tracked in section 11 below rather than silently resolved.

## 9. Testing

#32 is complete and merged (PR #42): 11 unit test files / 31 tests covering
auth enabled/disabled/misconfigured, expired sessions, transaction
create/edit, import preview/commit/pending-FX, category combobox keyboard
behavior, owed payments, dashboard loading/empty/error/partial-data states,
and Escape-to-close for every `useDialogAccessibility` consumer. A Playwright
e2e suite (7 specs across 5 browser projects: Chromium, Firefox, and WebKit,
desktop and mobile) — 28 passing, 7 skipped by device or driver limitation —
see `docs/browser-support.md`. Also implemented real offline support
(service worker, cache-on-visit, offline notice) per the resolved #35
decision — see `docs/pwa-offline.md`.

Four real bugs were found and fixed along the way:
- `useDialogAccessibility`'s focus-trap effect re-ran on every parent
  re-render, stealing focus away from whatever the user was typing into —
  affected 6+ dialogs app-wide.
- `import_previews.resolved_payload_sha256` and
  `wealth_accounts.value_source`/`value_reference` were added only via
  Alembic migrations, which never run against local SQLite — the separate
  legacy startup migration system in `database_migrations.py` never got the
  equivalent `ALTER TABLE`. Any local SQLite database predating those
  migrations 500'd on every CSV/XLSX import and on export/wealth reads. Fixed
  for both; a full audit of every `add_column` in `migrations/versions/`
  confirmed no other instances remain today (see the CI safeguard task above).
- `usePresentationPreferences` had no unmount cleanup guard, causing a
  CI-only (not locally reproducible) unhandled rejection after test teardown.

"Frontend e2e" was promoted to a required check 2026-07-20, after
confirming it succeeded on every CI run since #32 introduced it (checked
recent run history via `gh run view --json jobs`). `.github/workflows/ci.yml`
updated: renamed the job, removed `continue-on-error`, and added it to
`required-checks`'s `needs` list.

## 10. UI and Codebase Maintainability

- [ ] Split `backend/app/services/investment_event_service.py` (991 lines) before it breaches the 1,000-line hard limit.
- [ ] Split `frontend/src/pages/ImportPage.tsx` (915 lines) into smaller components/hooks.
- [ ] Split `frontend/src/pages/WealthPage.tsx` (898 lines) into smaller components/hooks.
- [ ] Split `frontend/src/pages/OwedPage.tsx` (882 lines) into smaller components/hooks.
- [ ] Split `frontend/src/pages/InvestmentsPage.tsx` (879 lines) into smaller components/hooks.
- [ ] Split `frontend/src/pages/TransactionsPage.tsx` (868 lines) into smaller components/hooks.
- [ ] Split `frontend/src/components/categories/TransactionCategoriesPanel.tsx` (807 lines) into smaller, focused components.
- [ ] Add a distinguishing `aria-label` (e.g. `Mark ${description} as owed`) to the mobile "Owed" row action in `TransactionTable.tsx`, matching the pattern already used for its Edit/Delete siblings — currently both desktop and mobile buttons share the plain accessible name "Owed".
- [ ] Normalize remaining formatting and naming inconsistencies flagged in earlier audits.

## 11. Open Decisions (#35) — all resolved 2026-07-20

All of #35's remaining items are now decided; see `docs/production-roadmap.md`
section 6 for the authoritative record of each. Summary:

- Local SQLite: **dev convenience only**, not a deployment target.
- Transaction categories: **stay freeform strings**, not FK references.
- Render free tier: **owner will never pay for hosting** — the documented
  Upgrade Triggers stay as reference only, not something to act on.
- Market-data ownership: **corrected the docs to shared/admin-maintained**
  (matching the actual implementation), rather than building per-user
  market data. `docs/multi-user-data-model.md` updated to match.
- **Real, unresolved legal risk found**: Yahoo's Terms of Service prohibit
  automated access/scraping and commercial use of Yahoo data without
  written permission. `yfinance` (this project's market-data source) wraps
  Yahoo's unofficial endpoints. Acceptable risk at the current
  personal/small-invited-group scale, but **must be resolved (switch to a
  licensed market-data provider) before any wider or genuinely public
  release** — do not treat "Global release readiness" in
  `docs/production-roadmap.md` as met while this stands.

#35 is closed.
