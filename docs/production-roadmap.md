# Production Roadmap and Release Readiness

Last audited: 2026-07-19
Original audit baseline: commit `96c3f0c`

This document tracks project status, evidence, and standing decisions.
Actionable, open work lives in [`TODO_LIST.md`](../TODO_LIST.md) instead.

## 1. Readiness Scorecard

| Area | Score | Summary |
|---|---:|---|
| Core functionality | 4/5 | Broad feature coverage and working production deployment |
| Backend architecture | 4/5 | Good layering and explicit ownership; broader transaction boundaries still need work |
| Data integrity | 4/5 | Atomic imports, investment accounting, ownership checks, and relational foreign keys are implemented |
| Authentication | 5/5 | Stable `sub` ownership is deployed, production data is migrated, and JWT issuer validation is enforced |
| Authorization | 4/5 | Market routes are protected and user-owned operations require explicit ownership |
| Import reliability | 4/5 | Atomic commits, bounded uploads, deduplication, and preview-to-commit binding are implemented |
| Recovery | 4/5 | PostgreSQL and JSON restore drills pass; RPO, RTO, retention, encryption, and ownership are documented |
| Security | 4/5 | Auth, ownership, upload limits, dependency checks, rate limiting, secure backups, request/database timeouts, and a Content Security Policy are implemented |
| Frontend architecture | 3/5 | API separation exists, but several pages remain oversized (see Known Risks below) |
| UI/UX | 4/5 | Screen-level workflow clarity, loading/error states, and personal-default removal are implemented |
| Accessibility | 4/5 | Dialog focus management, keyboard support, live regions, reduced motion, and browser zoom are implemented |
| Internationalization | 4/5 | Locale, currency, date/time-zone preferences, and an English/Portuguese translation layer are implemented |
| Testing | 4/5 | 470 backend tests, 11 frontend unit test files (31 tests), and a Playwright e2e suite (Chromium/Firefox/WebKit, desktop+mobile) all pass; lint, build, and migrations pass (#32, #24 merged) |
| CI/CD | 4/5 | Required CI checks cover backend, recovery, frontend, dependencies, and repository hygiene; a non-required e2e job runs the full browser matrix |
| Observability | 4/5 | Structured logging, readiness checks, a monitoring ping covering liveness/readiness/frontend, and a documented incident runbook exist (#33). Dashboard-side alert configuration (Render/Vercel/GitHub notification settings) still needs manual confirmation — see `docs/oauth-and-hosting-checklist.md`. |
| Performance | 3/5 | Free-host cold starts remain (accepted, see Upgrade Triggers); request/database timeouts are enforced |
| Documentation | 4/5 | Privacy, i18n, security/timeouts, deployment, browser-support, offline, incident-response, and release/rollback docs exist; a broader accuracy refresh is still open (#34) |
| Global release readiness | 3/5 | Suitable for controlled use; OAuth/Supabase/Render dashboard verification (checklist ready) and #34's documentation refresh still block public launch |

## 2. Verification Evidence

Current repository evidence on 2026-07-19 (`main`, commit `5c3c18f` and later):

- Full backend suite: 470 tests passed (6 short test-key warnings, pre-existing and non-blocking).
- Frontend lint and production build passed.
- Alembic has a single head: `913e77ab658e` (merges `1a3d5e7f9b20` and `2b4d6f8a0c31`).
- Required GitHub Actions CI checks passed on `main` after each merge below.
- Backend dependencies are exactly pinned.
- No production source file exceeds 1,000 lines (see Known Risks for files close to the limit).
- No open `CRIT`, `HIGH`, or `MED` items remain in the task list.

### 2026-07-19 merge session

Issues #27–#31 had been closed as completed, but their implementations lived only
in open, unmerged PRs (#36–#40). This was reconciled today:

- PR #36 (accessibility/formatting), #37 (privacy/account deletion), #38
  (internationalization), #39 (timeouts/security), #40 (screen workflow clarity)
  were reviewed for CI status, updated against `main`, and merged via squash, in
  that order.
- Merging #38 and #40 required resolving real conflicts (`App.tsx`,
  `SettingsPage.tsx`, `main.py`, `DashboardPage.tsx`) because both branches had
  diverged from an earlier `main`.
- Merging #40 surfaced two competing Alembic heads (`1a3d5e7f9b20` from #38 and
  `2b4d6f8a0c31` from #40). Resolved with an Alembic merge migration
  (`913e77ab658e`) before merging.
- Full backend suite (465 tests), frontend lint, and frontend build were run
  after each merge; CI was confirmed green on `main` before proceeding to the
  next PR.
- Dependabot PR #3 (`pydantic-core` 2.46.4 → 2.47.0) remains open and was not
  merged in this session — tracked in `TODO_LIST.md`.

## 3. Definition of Global Release Ready

- No unauthenticated protected routes.
- Ownership-safe financial writes.
- Atomic multi-record operations.
- Verified investment calculations, no look-ahead bias.
- Complete backup and restore coverage, with a successful restore drill.
- Stable user IDs, foreign-key integrity.
- Upload and abuse controls.
- Passing tests, lint, build, migrations, and recovery checks in CI, CI-gated deployment.
- Resolved accessibility blockers, browser zoom enabled, keyboard-only usability.
- Defined locale, currency, date, and time-zone behavior.
- Documented privacy, retention, export, and deletion.
- Monitoring and incident response.
- Accepted or upgraded hosting limitations.
- Completed OAuth production requirements.
- Current documentation.
- Tested release and rollback procedures.

## 4. Known Risks

Files approaching the project's 1,000-line hard limit / 900-line soft limit
(see `TODO_LIST.md` for the corresponding refactor tasks):

- `backend/app/services/investment_event_service.py` — 991 lines (hard limit is 1,000).
- `frontend/src/pages/ImportPage.tsx` — 915 lines.
- `frontend/src/pages/WealthPage.tsx` — 898 lines.
- `frontend/src/pages/OwedPage.tsx` — 882 lines.
- `frontend/src/pages/InvestmentsPage.tsx` — 879 lines.
- `frontend/src/pages/TransactionsPage.tsx` — 868 lines.
- `frontend/src/components/categories/TransactionCategoriesPanel.tsx` — 807 lines.

## 5. Upgrade Triggers

### Render

Upgrade when: cold starts are unacceptable; users expect reliable access; the
app is publicly promoted; support commitments exist; free hours are exhausted.

**Policy decision (2026-07-19, resolving #33's cold-start reassessment):**
accepted for now. The ~53-second cold start is a known, documented
limitation (`docs/production-roadmap.md` free-tier viability section) that
the resolved decisions above explicitly accept the app must tolerate
(decision #6: "must work during backend cold starts? Yes" — meaning the
frontend's own loading states handle it, not that the cold start itself is
eliminated). The keep-warm ping in
`.github/workflows/keep-backend-warm.yml` reduces how often a cold start is
actually hit, but Render's own docs are explicit that this doesn't
guarantee uptime the way a paid always-on instance would. Revisit this
decision, not the ping, when any of the triggers above are met.

### Supabase

Upgrade when: database or egress approaches quotas; stronger backup retention
is needed; point-in-time recovery is needed; inactivity behavior is
unacceptable; production support is required.

### Vercel

Upgrade when: Hobby limits are approached; commercial usage requires it; team
governance, logs, bandwidth, or builds require it.

## 6. Resolved Product and Architecture Decisions

Tracked in issue #35. Answers recorded 2026-07-19; each still needs any
consequential implementation work tracked as its own task.

1. Invite-only or open registration? **Open registration.**
2. Shared, user-specific, or admin-maintained market data? **User-specific.**
3. Is moving weighted-average cost suitable for every tax jurisdiction? **No** — jurisdiction-specific cost-basis rules are out of scope for now.
4. Required base currencies? **USD, EUR.**
5. Required launch languages? **Portuguese, English.**
6. Must the app work during backend cold starts? **Yes.**
7. Is local SQLite a first-class deployment? **Undecided.**
8. Deleted-account retention outside the backup schedule? **1 week.**
9. Should transaction categories become foreign-key references? **Undecided.**
10. Is offline use real or only installability? **Real offline use is required, not just installability** — not expected to be exercised often, but must work when it is. **Implemented**: see `docs/pwa-offline.md`.
11. When does availability justify paid Render? **Undecided** — see Upgrade Triggers above.
12. Are users outside Portugal targeted immediately? **No.**
13. Are market-data terms compatible with public release? **Undecided.**

## 7. Deferred (do not prioritize before open work above)

Complex charts, budget prediction, expanded investment analytics, automatic
bank synchronization, Open Banking, OCR, PDF imports, advanced animations,
complex mobile polish, multi-region deployment, microservices, event-driven
architecture, Kubernetes, premature caching, stack replacement without evidence,
offline write queuing/sync (writes fail naturally offline instead; see
`docs/pwa-offline.md`).
