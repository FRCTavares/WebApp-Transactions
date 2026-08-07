# Production Roadmap and Release Readiness

Last audited: 2026-08-07
Current audit baseline: commit `8066189`
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
| Frontend architecture | 4/5 | API separation exists; all previously oversized pages were split into components/hooks/utils 2026-07-20 (see Known Risks below) |
| UI/UX | 4/5 | Screen-level workflow clarity, loading/error states, and personal-default removal are implemented |
| Accessibility | 4/5 | Dialog focus management, keyboard support, live regions, reduced motion, and browser zoom are implemented |
| Internationalization | 4/5 | Locale, currency, date/time-zone preferences, and an English/Portuguese translation layer are implemented |
| Testing | 4/5 | 553 backend tests pass; frontend lint, unit tests, production build, and the sharded Playwright Chromium/Firefox/WebKit desktop+mobile suite are CI-gated and passing |
| CI/CD | 4/5 | The required CI aggregate gates backend, recovery, frontend lint/unit/build, all four Playwright e2e shards, dependency audit, and repository hygiene |
| Observability | 4/5 | Structured logging, readiness checks, monitoring, and the incident runbook exist; the dashboard-side GitHub, Supabase, Render, Vercel, and OAuth checks from #33 were completed 2026-07-20 and are documented in `docs/oauth-and-hosting-checklist.md` |
| Performance | 3/5 | Free-host cold starts remain (accepted, see Upgrade Triggers); request/database timeouts are enforced |
| Documentation | 4/5 | Privacy, i18n, security/timeouts, deployment, browser-support, offline, incident-response, release/rollback, ownership, and recovery documentation exists; #34's broader documentation refresh is completed, with ongoing accuracy maintained as the code evolves |
| Global release readiness | 3/5 | Suitable for controlled personal/invited use; wider public or commercial release remains blocked by the unresolved Yahoo/yfinance market-data licensing risk in decision #13 |

## 2. Verification Evidence

Current repository evidence on 2026-08-07 (`main`, commit `8066189`):

- Full backend suite: 553 tests passed (6 short test-key warnings, pre-existing and non-blocking).
- Frontend lint, CSS guardrails, unit tests, production build, and the complete
  Playwright browser matrix pass in required CI.
- Playwright runs as four independent shards across Chromium, Firefox, and
  WebKit desktop/mobile projects; the `Required checks` job fails if any shard
  fails.
- Alembic has a single head: `5e9a2c7f1b40`.
- The Alembic/legacy-SQLite migration-drift gate passes.
- Backend dependencies remain pinned and dependency auditing is CI-gated.
- No production source file exceeds the project's 1,000-line hard limit.
- GitHub reports no open issues and no open pull requests.
- `TODO_LIST.md` contains no active implementation tasks.

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
- At the end of that historical merge session, Dependabot PR #3 was still
  open. That is no longer current state; the 2026-08-07 audit reports no open
  pull requests.

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

**Resolved 2026-07-20**: the seven files previously approaching the
project's 1,000-line hard limit / 900-line soft limit were split into focused
modules. The associated pull-request and commit history retains the detailed
breakdown. No production source file exceeds the 1,000-line hard limit.

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
2. Shared, user-specific, or admin-maintained market data? **Shared/admin-maintained** (corrected 2026-07-20 to match the actual implementation — `market_prices`/`market_price_history` are shared, global tables with admin-only writes via `ADMIN_USER_EMAILS`). The original recorded decision said "user-specific"; that was the documentation error, not the code. See `docs/multi-user-data-model.md`.
3. Is moving weighted-average cost suitable for every tax jurisdiction? **No** — jurisdiction-specific cost-basis rules are out of scope for now.
4. Required base currencies? **USD, EUR.**
5. Required launch languages? **Portuguese, English.**
6. Must the app work during backend cold starts? **Yes.**
7. Is local SQLite a first-class deployment? **No** (confirmed 2026-07-20) — dev convenience only; Postgres/Supabase is the only real deployment target. The legacy SQLite startup migrations exist solely to keep local dev databases working, not as a supported deployment path.
8. Deleted-account retention outside the backup schedule? **1 week.**
9. Should transaction categories become foreign-key references? **No** (confirmed 2026-07-20) — freeform strings are fine for personal use at this scale; not worth the migration complexity/risk right now. Revisit if that changes.
10. Is offline use real or only installability? **Real offline use is required, not just installability** — not expected to be exercised often, but must work when it is. **Implemented**: see `docs/pwa-offline.md`.
11. When does availability justify paid Render? **Never, by owner preference** (confirmed 2026-07-20) — the owner does not want to pay for hosting regardless of cold-start/availability tradeoffs. The Upgrade Triggers above remain documented for reference but are not something the owner intends to act on.
12. Are users outside Portugal targeted immediately? **No.**
13. Are market-data terms compatible with public release? **No — real, unresolved legal risk if released beyond personal/small-invited-group use.** Researched 2026-07-20: Yahoo's Terms of Service explicitly prohibit automated access/scraping without express written permission, and separately prohibit commercial use of Yahoo API data without permission. `yfinance` (used here) wraps Yahoo's unofficial endpoints — acceptable risk for personal/small-scale use like this project's current "controlled personal and invited-user deployment" (`docs/privacy.md`), but this must be resolved (switch to a licensed market-data provider) before any wider or genuinely public release. Do not treat the Global release readiness scorecard as met until this is addressed.

## 7. Deferred product ideas

These are not current TODO items. Reassess them only when product needs justify
the added complexity.

Complex charts, budget prediction, expanded investment analytics, automatic
bank synchronization, Open Banking, OCR, PDF imports, advanced animations,
complex mobile polish, multi-region deployment, microservices, event-driven
architecture, Kubernetes, premature caching, stack replacement without evidence,
offline write queuing/sync (writes fail naturally offline instead; see
`docs/pwa-offline.md`).
