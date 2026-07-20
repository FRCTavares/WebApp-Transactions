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
- [ ] Known accepted gap: GitHub Actions' 90-day artifact retention ceiling
      means the twelve-monthly retention tier isn't really satisfied yet —
      revisit if that ever matters at this project's scale (see
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

- [ ] Walk through `docs/oauth-and-hosting-checklist.md` and close #33 once done.

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

- [ ] Promote the "Frontend e2e" CI job to a required check once it has proven stable across a few more runs.

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

## 11. Open Decisions (#35)

Most of #35 is answered in `docs/production-roadmap.md`. These remain undecided:

- [ ] Decide whether local SQLite is a first-class deployment target, not just a development convenience.
- [ ] Decide whether transaction categories should become foreign-key references.
- [ ] Decide when availability requirements justify upgrading off Render's free tier (beyond the general triggers already listed).
- [ ] Confirm market-data provider terms are compatible with the intended public release.
- [ ] Resolve the market-data ownership discrepancy found during #34: the recorded decision says "user-specific" but the implementation is shared/admin-maintained (`docs/multi-user-data-model.md`) — decide whether to implement per-user market data or correct the recorded decision.
- [ ] Once all of the above are decided, close #35 and link any resulting implementation tasks here.
