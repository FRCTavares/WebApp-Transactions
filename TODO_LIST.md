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

## 8. Documentation

- [ ] #34 — Review and refresh `README.md`, `frontend/README.md`, `docs/deployment.md`, `docs/backups-supabase.md`, `docs/production-roadmap.md`, and add `docs/auth-options.md` and `docs/multi-user-data-model.md` (currently missing).
- [ ] #34 — Document `VITE_SUPABASE_AUTH_ENABLED` and all other environment variables, including local and production setup steps.
- [ ] #34 — Verify documentation matches the deployed architecture and current code paths after the 2026-07-19 merges (#36–#40).
- [ ] #24 — Define and document a supported desktop/mobile browser matrix with minimum versions and a lightweight verification approach.
- [ ] #25 — Decide and document whether the PWA is installable-only or genuinely offline-capable; the resolved decision in `docs/production-roadmap.md` says real offline use is required — audit the current manifest/service worker/caching against that and implement or correct as needed.

## 9. Testing

- [ ] #32 — Fix the `React.act is not a function` failure in `frontend/tests/ImportPage.test.tsx` (React 19 / `@testing-library/react` version mismatch) on the in-progress `agent/issue-32` branch before opening its PR.
- [ ] #32 — Add remaining frontend coverage: auth enabled/disabled/misconfigured, expired-session handling, transaction create/edit, import preview/commit, pending FX, active-category selection, owed split/payment, keyboard dialog/combobox operation, loading/empty/error/partial-data states.
- [ ] #32 — Add end-to-end coverage: authenticated entry, manual transaction creation, CSV preview/commit and duplicate import, category replacement, export download, mobile navigation.

## 10. UI and Codebase Maintainability

- [ ] Split `backend/app/services/investment_event_service.py` (991 lines) before it breaches the 1,000-line hard limit.
- [ ] Split `frontend/src/pages/ImportPage.tsx` (915 lines) into smaller components/hooks.
- [ ] Split `frontend/src/pages/WealthPage.tsx` (898 lines) into smaller components/hooks.
- [ ] Split `frontend/src/pages/OwedPage.tsx` (882 lines) into smaller components/hooks.
- [ ] Split `frontend/src/pages/InvestmentsPage.tsx` (879 lines) into smaller components/hooks.
- [ ] Split `frontend/src/pages/TransactionsPage.tsx` (868 lines) into smaller components/hooks.
- [ ] Split `frontend/src/components/categories/TransactionCategoriesPanel.tsx` (807 lines) into smaller, focused components.
- [ ] Normalize remaining formatting and naming inconsistencies flagged in earlier audits.

## 11. Open Decisions (#35)

Most of #35 is answered in `docs/production-roadmap.md`. These remain undecided:

- [ ] Decide whether local SQLite is a first-class deployment target, not just a development convenience.
- [ ] Decide whether transaction categories should become foreign-key references.
- [ ] Decide when availability requirements justify upgrading off Render's free tier (beyond the general triggers already listed).
- [ ] Confirm market-data provider terms are compatible with the intended public release.
- [ ] Once all of the above are decided, close #35 and link any resulting implementation tasks here.
