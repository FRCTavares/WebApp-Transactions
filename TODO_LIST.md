# F - Transactions: Open Tasks

Project overview, stack, and free-tier context: [`README.md`](README.md).
Readiness scorecard, verification evidence, and resolved decisions:
[`docs/production-roadmap.md`](docs/production-roadmap.md).

This file lists only open, actionable work, ordered by the project's stated
priority: security, ownership, financial correctness, atomicity, backup and
recovery, data integrity, CI/deployment reliability, accessibility, UI.

No open items remain in categories 1–6 (security, ownership, financial
correctness, atomic workflows, backup/recovery, data integrity). Remaining
work is CI/deployment reliability, documentation, accessibility follow-through
verification, and UI/codebase maintainability.

## 7. CI and Deployment Reliability

- [ ] Merge or close dependabot PR #3 (`pydantic-core` 2.46.4 → 2.47.0) and rerun CI.
- [ ] #33 — Establish production monitoring and alerting for application health and critical failures.
- [ ] #33 — Monitor relevant Supabase capacity and backup signals.
- [ ] #33 — Document incident ownership, triage, communication, and recovery steps.
- [ ] #33 — Define and test release and rollback procedures; confirm migration failures block deployment.
- [ ] #33 — Verify Supabase redirects, Google authorized domains, app branding, exact redirect URLs, and minimum OAuth scopes; complete Google OAuth verification if required.
- [ ] #33 — Reassess Render keep-warm/cold-start policy against the upgrade triggers in `docs/production-roadmap.md`.
- [ ] #26 — Define a build/version identifier and expose it in an appropriate diagnostic or user-facing location.
- [ ] #26 — Establish a maintainable release-notes format and update workflow.
- [ ] Add a CI check that fails if any Alembic migration adds/renames a
  column or table without an equivalent update to the legacy SQLite startup
  migrations in `backend/app/database_migrations.py` — this exact gap caused
  two real local-only 500 errors found via #32's e2e work (see #9).

## 8. Documentation

- [ ] #34 — Review and refresh `README.md`, `frontend/README.md`, `docs/deployment.md`, `docs/backups-supabase.md`, `docs/production-roadmap.md`, and add `docs/auth-options.md` and `docs/multi-user-data-model.md` (currently missing).
- [ ] #34 — Document `VITE_SUPABASE_AUTH_ENABLED` and all other environment variables, including local and production setup steps.
- [ ] #34 — Verify documentation matches the deployed architecture and current code paths after the 2026-07-19 merges (#36–#40).
- [ ] #24 — Define and document a supported desktop/mobile browser matrix with minimum versions and a lightweight verification approach.
- [ ] #25 — Decide and document whether the PWA is installable-only or genuinely offline-capable; the resolved decision in `docs/production-roadmap.md` says real offline use is required — audit the current manifest/service worker/caching against that and implement or correct as needed.

## 9. Testing

`agent/issue-32` (PR #42, draft, fully green in CI): 11 unit test files / 31
tests covering auth enabled/disabled/misconfigured, expired sessions,
transaction create/edit, import preview/commit/pending-FX, category combobox
keyboard behavior, owed payments, dashboard loading/empty/error/partial-data
states, and Escape-to-close for every `useDialogAccessibility` consumer
(transaction edit/delete/owed-split, category replacement/migration, wealth
account details). A working Playwright e2e suite (10 tests) runs with genuine
locally-minted Supabase session authentication against a live backend:
authenticated dashboard load, desktop/mobile navigation, CSV import-and-commit,
category replacement, and JSON export download.

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
  confirmed no other instances remain today (see #7 for a CI safeguard against
  this recurring).
- `usePresentationPreferences` had no unmount cleanup guard, causing a
  CI-only (not locally reproducible) unhandled rejection after test teardown.

- [ ] #32 — Review and merge PR #42.
- [ ] #32 — Promote the "Frontend e2e" CI job to a required check once it has proven stable across a few more runs.

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
- [ ] Once all of the above are decided, close #35 and link any resulting implementation tasks here.
