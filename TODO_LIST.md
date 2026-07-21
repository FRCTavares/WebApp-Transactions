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

## 10. UI and Codebase Maintainability — closed 2026-07-20

All seven oversized files were split, each into a CRUD/state layer plus
presentational components or pure-helper utils modules, following the
pattern already used elsewhere in the codebase (e.g. `wealthPageUtils.ts`):

- `backend/app/services/investment_event_service.py` (was 991 lines) — now
  249 lines. Valuation/cost-basis/FX-rate analytics moved to a new
  `InvestmentValuationMixin` in `investment_valuation_service.py` (769
  lines); `InvestmentEventService` keeps only CRUD/mutation logic and
  inherits the mixin, so callers are unaffected.
- `frontend/src/pages/ImportPage.tsx` (was 915) — now 658 lines. Preview
  and batch-history tables moved to
  `components/import/ImportPreviewTables.tsx`; `formatFxStatus` moved to
  `utils/importPreview.ts`.
- `frontend/src/pages/WealthPage.tsx` (was 898) — now 646 lines. Account
  form, snapshot form, and snapshots table moved to
  `components/wealth/WealthAccountFormPanel.tsx`,
  `WealthSnapshotFormPanel.tsx`, and `WealthSnapshotsTablePanel.tsx`.
- `frontend/src/pages/OwedPage.tsx` (was 882) — now 585 lines. The
  "Record payment" modal and its pure helpers moved to
  `components/owed/RecordPaymentModal.tsx` and
  `utils/owedPaymentUtils.ts`.
- `frontend/src/pages/InvestmentsPage.tsx` (was 879) — now 555 lines. Pure
  helpers/form-state types moved to `utils/investmentsPageUtils.ts`; the
  funding-split card and investment-events card moved to
  `components/investments/FundingSplitPanel.tsx` and
  `InvestmentEventsPanel.tsx`.
- `frontend/src/pages/TransactionsPage.tsx` (was 868) — now 443 lines.
  The owed-split dialog's state/handlers and the create-form's
  owed-row/repayment state/handlers moved into two new hooks,
  `hooks/useOwedSplitDialog.ts` and `hooks/useCreateOwedAndRepayment.ts`.
- `frontend/src/components/categories/TransactionCategoriesPanel.tsx`
  (was 807) — now 578 lines. The category row and create-category form
  moved to `components/categories/CategoryRow.tsx` and
  `CategoryCreateForm.tsx`; pure helpers moved to
  `utils/transactionCategoriesPanelUtils.ts`.

Verification: `ruff check` passes on the backend split; `tsc --noEmit`
and `eslint .` pass clean across the whole frontend. The sandbox used to
make these changes cannot run the real backend test suite (Python 3.10
vs. the pinned 3.11+ dependencies) or `npm run build`/`npm run test`
(the frontend's `node_modules` has an arch-specific `rolldown` native
binding built for the owner's Mac) — these still need to be run for real
in the owner's own terminal before merging, per this project's mandatory
post-edit workflow.

- [x] Add a distinguishing `aria-label` (e.g. `Mark ${description} as owed`) to the mobile "Owed" row action in `TransactionTable.tsx`, matching the pattern already used for its Edit/Delete siblings — done 2026-07-20; the equivalent desktop button was missing the same `aria-label` and was fixed at the same time.
- [x] Normalize remaining formatting and naming inconsistencies — covered by the file-splitting pass above; `eslint .` is clean across the whole frontend with no outstanding warnings besides one pre-existing, intentionally-suppressed `exhaustive-deps` pattern already used elsewhere in the codebase (`useInvestmentData.ts`).

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

## 12. Frontend Design System (#36) — open

Full audit, target token system, and rationale:
[`docs/frontend-design-system.md`](docs/frontend-design-system.md). Read it
before starting; the tasks below are deliberately terse because that
document holds the detail.

Decisions already taken, do not reopen: token-first refactor in plain CSS
(no Tailwind, no component library, no new runtime dependencies); visual
direction is a refined version of the current light neutral look, not a
restyle; the four hand-rolled SVG charts stay hand-rolled.

Audited state: 37 stylesheets, 216 hardcoded hex literals, 20 design tokens
that almost nothing consumes, a 618-line dark-mode override sheet, 9
`var()` references to variables that do not exist, and 1 `transition`
declaration in the entire app.

Work the phases in order. Each phase is a separate commit (Phase 4 is ten
commits). Every phase ends with the project's mandatory post-edit workflow:
`npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build`,
`git diff --check`, changed-file line counts, full diff review.

**Constraint that applies to every phase:** 11 unit test files and 7
Playwright specs select on visible text and ARIA roles. Preserve every
existing accessible name, role, `aria-label`, and `data-testid` exactly.
Run the suites after each component migration, not only at the end.

### Phase 0 — Correctness fixes — implementation complete; visual verification open (2026-07-20)

Verification run on the owner's machine, uncommitted in the working tree:

- `npm run lint` — clean, no warnings.
- `npm run build` (`tsc -b && vite build`) — passes. Inter now emits 7 woff2
  subsets (~218 kB total, latin subset 48 kB); CSS bundle 240.71 kB
  (36.89 kB gzipped), JS 482.59 kB (131.75 kB gzipped).
- `npm run test` — 11 files, 31 tests, all passing.
- `npm run test:e2e` — 13 passed, 7 skipped, 15 failed. The 15 failures are
  3 specs (`import`, `export`, `category-replacement`) across all 5 browser
  projects, and they are **environmental, not a regression**: they need an
  authenticated backend, and the locally started backend returned 400 on
  every CORS preflight and 401 on `POST /api/import/preview` because it was
  not started with the matching `SUPABASE_JWT_SECRET` and allowed origin
  from `frontend/e2e/.env.e2e.local`. Confirmed by stashing every source
  change and re-running the same three specs at `HEAD` — identical failures.
  Re-run these three against a properly configured backend before merging.
- `git diff --check` — clean.
- No changed file exceeds the 1000-line cap (largest: `base.css` 908,
  `wealth.css` 905, `index.css` 854).

Note on the environment: `npm install` run from a shell where
`NODE_ENV=production` is exported will silently apply `omit=dev` and strip
every devDependency from `node_modules`. If `eslint`/`tsc` suddenly report
"command not found", that is the cause — recover with
`NODE_ENV= npm install --include=dev`.

Still outstanding before this section is closed: a visual check in both
themes at 375px / 800px / 1440px, per the last item below.

- [x] Fixed **19** `var()` references to undefined variables — not 9, as the
      first audit pass claimed. Seven undefined names were in use
      (`--muted`, `--border`, `--border-subtle`, `--surface`,
      `--surface-elevated`, `--text`, `--text-muted`): 5 occurrences in
      `frontend/src/index.css`, 14 in
      `frontend/src/styles/transaction-repayment.css`. The original count was
      wrong because the search guessed four names instead of diffing every
      used `var()` name against every defined one.
      Mapping applied, preserving the author's intended two-level surface
      hierarchy: `--border`/`--border-subtle` → `--theme-border`;
      `--surface-elevated` → `--theme-surface`; `--surface` (tiles nested
      inside elevated panels) → `--theme-surface-muted`;
      `--muted`/`--text-muted` → `--theme-muted`; `--text` → `--theme-text`.
      **Expect a visible change:** the Money-In repayment panel and its
      allocation rows previously rendered with *no* background and *no*
      border (the declarations were invalid at computed-value time) and now
      render correctly in both themes. This is the fix, not a regression.
- [x] Loaded Inter, self-hosted via `@fontsource-variable/inter@^5.3.0`,
      imported in `main.tsx` ahead of the app styles. `base.css` now leads
      with `"Inter Variable"`. Self-hosted rather than CDN so the PWA renders
      correctly offline — `public/sw.js` caches static assets
      opportunistically on visit, with no precache manifest to update.
- [x] Made `<meta name="theme-color">` theme-aware. `index.html` now ships a
      media-scoped light/dark pair for correctness before React mounts, and
      `ThemeContext` replaces them with a single resolved tag on every theme
      change so an explicit choice that disagrees with the OS is honoured.
      `manifest.webmanifest` realigned from `#111216` to `#09090b`.
      Deliberately **not** changed: `apple-mobile-web-app-status-bar-style`
      stays `default`; moving it to `black-translucent` needs safe-area top
      padding on the sticky mobile header, which belongs in a later phase.
- [x] Gave `.primary-button` real hover and active states. The base rule set
      `:hover { background: #16a34a }`, identical to its resting background.
      Fixing `base.css` alone was **not** sufficient — three higher-priority
      rules defeated it and each needed its own hover/active pair:
      `.owed-page-polished .primary-button` and `.wealth-page .primary-button`
      (equal specificity to the base hover, winning on source order) and
      `:root[data-theme='dark'] .primary-button` (higher specificity, which
      meant primary buttons had **no** hover in dark mode at all).
      `transactions.css` already had a correct hover; the new values match it
      exactly (`#16a34a` → `#15803d` → `#166534`), so all pages now agree.
      Dark mode brightens on hover instead of darkening.
      Also added a generic `button:active:not(:disabled)` and a
      `.danger-button` active state.
- [x] Consolidated the duplicated `@media (max-width: 800px)` blocks in
      `frontend/src/styles/tables.css` (595 → 577 lines, 5 → 4 media blocks).
      Correction to the audit: the two blocks were *interleaved*, not wholly
      duplicated — some declarations in the first block were dead
      (`.table-wrap` margins, `.table-wrap table` min-width, `th, td` padding
      and font size, `.badge` font-size) while others still applied
      (`.table-wrap` borders and overflow, `.badge` padding). Only the dead
      declarations were removed; every computed value is unchanged.
- [x] Deleted `frontend/public/icons.svg` — confirmed zero references
      anywhere in the repo outside stale `dist/` build output.
- [ ] **Do not delete `frontend/src/styles/shell.css`.** The audit was wrong
      about this one. It is 701 lines defining `:root`, `body`, `.app-shell`,
      and `.sidebar`, and it *is* live — reached via `@import './shell.css'`
      on line 1 of `dashboard.css`, which was misread as a comment. Deleting
      it would strip the application chrome from every page. The real defect
      is that the global shell loads as a transitive dependency of the
      Dashboard's stylesheet; hoist it into the declared import manifest in
      Phase 1 instead.
- [ ] Verification gate for this phase: `npm run lint`, `npm run test`,
      `npm run test:e2e`, `npm run build`, `git diff --check`, then a visual
      check of the Money-In repayment panel, the Owed and Wealth page primary
      buttons, and the mobile transactions table, in both themes.

### Phase 1 — Token layer — implemented and verified 2026-07-20

209 tokens created across three files. **Nothing consumes them yet** — that is
Phase 2 onward. Verified inert: `npm run lint` clean, 31/31 unit tests pass,
`npm run build` passes, and a rule-level diff of the built CSS bundle against
the pre-Phase-1 build shows **0 existing rules changed or removed**. The only
bundle delta is the two new `:root` token blocks (+7.0 kB raw, +1.9 kB gzipped)
and one deduplicated variable (below).

- [x] `frontend/src/styles/tokens/primitives.css` (232 lines) — 9 colour ramps,
      4px-base spacing scale, 5-step radius scale, 4-step elevation scale, type
      scale, motion tokens, z-index scale, breakpoint reference.
      Colour provenance: a frequency analysis of all 139 distinct hex literals
      in `src/` showed the app was already using **Tailwind's default palette**,
      applied by hand — `#111827` text (90 uses), `#e5e7eb` borders (71),
      `#6b7280` muted (58), and the dark theme on `zinc`. Every ramp is
      therefore that exact palette, so adopting tokens changes no rendered
      colour. Two neutral families are in use (`gray` and `slate`); `gray`
      dominates and is the one kept — the ~8 `slate` values fold into it during
      Phase 2/4.
      The z-index scale also fixes a live ordering bug: the category combobox
      sits at 80 and the modal at 50, so the combobox currently outranks it.
- [x] `frontend/src/styles/tokens/semantic.css` (134 lines) — role tokens.
      Beyond §3.1 it adds `--color-expense` (an expense is normal, not an
      error, so it must not share the negative ramp) and `--chart-1..8` plus
      chart grid/axis/track roles, ready for Phase 6.
- [x] `frontend/src/styles/tokens/dark.css` (109 lines) — semantic overrides
      only, zero component selectors. Encodes two things the current
      `theme-dark.css` gets right only by accident: dark elevation works by
      getting *lighter* (`--color-surface-sunken` is lighter than
      `--color-surface`, the inverse of light mode), and interactive ramps
      invert so hover brightens.
- [x] Declared the import manifest in `main.tsx`. Tokens load first;
      everything else keeps its exact historical order.
      **Deliberately not done yet:** hoisting `shell.css` out of
      `dashboard.css`, and moving the dark override sheets. Both change
      cascade order for equal-specificity rules, which would have made Phase 1
      non-inert. The manifest comment records why and defers them to Phase 2/5.
      (First attempt did reorder these; caught by the build-CSS diff.)
- [x] Removed a duplicate `--tracking-tight` from `typography.css` — the only
      name collision between the 209 new tokens and the 95 pre-existing
      variables. Both defined `-0.03em`, so primitives is now the single
      definition with no rendering change.
- [ ] Optional follow-up: the second dark ramp. Beyond `zinc`, the "polished"
      pages use a bespoke cool-grey set (`#1c1d21`, `#232429`, `#2a2c32`,
      `#aeb3bd`, `#8f95a1`). Phase 5 must pick one; `dark.css` currently
      encodes the zinc-based one.

### Phase 2 — Base layer migration — implemented and verified 2026-07-20

**Acceptance criterion met.** Built a throwaway Playwright harness that loads
the built CSS bundle over a bare fixture of base elements, deletes all **181**
legacy `[data-theme='dark']` component rules, and reads back computed colours
in both themes. With every legacy dark rule gone, `body`, `button`, `input`,
`.card`, `th` and `td` all still theme correctly from tokens alone.

Verification: `npm run lint` clean, 31/31 unit tests pass, `npm run build`
passes. Harness deleted after use — worth rebuilding for the Phase 5 deletion.

- [x] `base.css` migrated: **0 hex literals remain** (was 26 distinct values
      across ~70 declarations) and all 17 `border-radius` values now use the
      5-step radius scale. Done with a property-aware script — the same hex
      means different roles depending on whether it is a `background`, a
      `color`, or a `border-color`, so a blind find-and-replace would have
      been wrong (e.g. `#ffffff` is `--color-surface` on 13 backgrounds but
      `--color-text-inverse` on 2 colours; `#166534` is `--color-positive-text`
      as a colour and `--color-positive-active` as a background).
- [x] Added motion. Buttons transition background/border/colour, inputs
      transition border and shadow, both on `--duration-fast`. `base.css`
      already honours `prefers-reduced-motion` globally, so no per-use guard
      is needed.
- [x] Replaced the blanket `:disabled { opacity: 0.5 }` with a real disabled
      palette (`--color-bg-subtle` surface, `--color-text-subtle` text) for
      both buttons and inputs, and added `::placeholder` styling. Verified it
      flips: disabled text is `gray-400` in light, `zinc-500` in dark.
- [x] Removed the global `input, select, textarea { min-width: 220px }` and
      replaced it with an explicit `min-width: 0`. Confirmed safe first: the
      generic `.toolbar` class this was presumably for **is not used in any
      JSX at all** (dead CSS), and the two contexts that genuinely need an
      intrinsic width already declare their own — `.owed-toolbar select`
      (220px) and `.table-wrap input` (180px). The explicit `min-width: 0`
      also fixes the underlying cause of the ~20 scattered `min-width: 0`
      patches, which can now be deleted during Phase 4.
- [x] Migrated `shell.css`'s page-canvas rules (`:root`, `body`, `main`,
      `.app-shell`) onto tokens. This was **not** in the original plan and had
      to be added: the harness showed `body` staying light in dark mode
      because `shell.css` — which is base-layer, not a page sheet — hardcoded
      `#f5f5f7` in four places. Introduced a `--bg-canvas` token because the
      light and dark canvases use different radial gradients, and a gradient
      cannot be swapped by re-pointing a colour token alone.
      `shell.css`'s remaining ~690 lines are sidebar internals and stay for
      Phase 4.
- [x] Fixed a bug introduced during this phase: `--color-surface-subtle` was
      added to `semantic.css` *after* `dark.css` was written, so it never got
      a dark override and table headers stayed light. Caught by the harness.
- [x] Unified focus indicators on `--focus-ring`. `.mobile-bottom-nav
      button:focus-visible` had replaced the standard 2px ring with
      `box-shadow: inset 0 0 0 1px #cbd5e1`, which fails contrast on white and
      is invisible in dark mode; it now uses the shared ring with a negative
      offset so it is not clipped by the 40px-tall fixed nav. Also corrected
      `:focus` to `:focus:not(:focus-visible)` there, which was suppressing
      the outline for keyboard users too.
- [x] Added `:active` to base buttons (`button:active:not(:disabled)`), on top
      of the `.primary-button` / `.danger-button` active states added in
      Phase 0.

**Deliberately deferred out of this phase:** the 66 remaining raw spacing
values in `base.css`. Unlike colour and radius, spacing has no safe mechanical
mapping — values like 5, 7, 11, 13, 18 and 26px sit between scale steps, and
rounding them blind shifts layout on every page at once. These migrate
page-by-page in Phase 4, where each page's layout can actually be looked at.

**Gotcha for whoever verifies this visually:** buttons now carry a 120ms
colour transition. Anything that samples computed styles immediately after
flipping the theme (a screenshot script, a test) will read a mid-transition
value and appear to show the theme not applying. Wait ~400ms, or disable
transitions, before sampling. This cost a while to diagnose.

### Phase 3 — Primitive components — implemented and verified 2026-07-20

1,819 lines across 27 files in `frontend/src/components/ui/`. **No call sites
were changed**, so the shipped bundle is unaffected: the JS bundle is
byte-identical at 482.59 kB and no `ui-*` class appears in the built CSS —
the whole layer is tree-shaken until Phase 4 imports it.

Verification: `npm run lint` clean, `npm run build` passes, **49/49 unit tests
pass (18 new)** — all 18 passed on the first run. Zero colour literals in the
primitives' CSS; the only two hex matches are inside an explanatory comment.

- [x] Built all 12 primitives with colocated CSS: `Button`, `IconButton`,
      `Card`, `Badge`, `Field`, `PageHeader`, `SegmentedControl`, `Skeleton`,
      `EmptyState`, `Modal`, `Toast`, `Table` (+ 6 table subcomponents), plus
      an `index.ts` barrel.
- [x] `Toast` is split across `toastContext.ts` / `useToast.ts` /
      `ToastProvider.tsx` to satisfy `react-refresh/only-export-components`,
      matching the split the codebase already uses for `themeContextValue.ts`
      and `authContext.ts`.
- [x] `Modal` wraps the existing `useDialogAccessibility` rather than
      reimplementing focus trapping — that hook already handles Escape, Tab
      cycling and focus restoration, and had a real focus-stealing bug fixed
      in it previously. It adds the `role="dialog"`, `aria-modal` and labelled
      title that the hand-rolled `.modal-card` markup never had.
- [x] `IconButton` makes `label` a **required** prop, so an icon-only control
      without an accessible name will not compile.

Decisions made while building, worth knowing before wiring them up:

- **`Button` defaults `type="button"`.** The native default is `submit`, which
  inside this codebase's inline table forms makes every unmarked button submit
  the form. There is a regression test for this.
- **`Table` takes an explicit `maxHeight` to enable sticky headers.** The old
  `.table-wrap` set `position: sticky` on `thead th` but gave the wrapper
  `overflow-x: auto` with no height constraint, so the sticky header never
  actually worked. Sticky is now opt-in and only offered where it can function.
- **Clickable table rows are keyboard-activatable** (`tabIndex`, Enter/Space).
  The old `.clickable-row` was mouse-only.
- **Row striping was dropped, not ported.** The old stripe was `#fdfdfd` on a
  `#ffffff` surface — invisible on most displays. Hover is the affordance.
- **`Badge` does not capitalise.** The old `.badge` had
  `text-transform: capitalize`, which mangles acronyms and source names
  ("ActivoBank" → "Activobank"). There is a test asserting verbatim text.
- **`SegmentedControl` uses radio semantics**, so a selection is announced as
  "2 of 3" rather than as three unrelated buttons. It replaces five separate
  implementations.
- **Error toasts do not auto-dismiss.** A user who looked away must not lose
  the only notice that their edit failed.
- **Added a `--color-scrim` token** while building `Modal` — the backdrop was
  the one place a raw `rgb()` had crept into the primitives. Dark mode needs a
  much heavier scrim (62% vs 35%), since a light veil over a near-black canvas
  separates nothing.
Collapsed by these primitives, to be deleted as Phase 4 migrates each page:

- `Button` replaces the 8 de facto button sizes in `.toolbar button`,
  `.page-header button`, `td .action-group button`,
  `.transaction-mobile-actions button`, `.mobile-more-actions button`,
  `.month-navigator button`, `.small-button` and
  `.investment-trend-window-selector button` — with 3 sizes and 4 variants.
- `Field` supplies the `label`/`hint`/`error`/`required` states that did not
  exist at all; all validation feedback previously went through the page-level
  `StatusMessage` banner.
- `PageHeader` replaces the two competing page scaffolds —
  `.page-header`/`.cards`/`.card` in `base.css` and the newer
  `.app-page`/`.page-title-block`/`.summary-grid`/`.content-card` in
  `index.css`.
- `Skeleton`, `EmptyState` and `Toast` have no predecessor. They are the
  loading, empty and transient-feedback states the app simply did not have.

Covered by `tests/uiPrimitives.test.tsx` (18 tests): variants and sizes,
disabled and loading behaviour, accessible names, `Field` label/description/
invalid wiring, `SegmentedControl` radio semantics, `Modal` Escape handling
including the close-disabled case, and `Table` sort announcement plus keyboard
row activation.

### Phase 4 — Call-site migration, one commit per page

**Current next task: Transactions.** Complete and verify it before starting Investments. Preserve every existing accessible name, role, `aria-label`, and `data-testid`, and do not remove its TODO item until the full post-edit workflow succeeds.

- [x] **Dashboard — done and verified 2026-07-20 (pilot).**
      `npm run lint` clean, 49/49 unit tests pass (the 4 Dashboard state tests
      unchanged), `npm run build` passes, and `dashboard.spec.ts` +
      `offline.spec.ts` pass on chromium and mobile-chromium against a live
      backend. Verified visually in both themes at 375 / 800 / 1440px.

      `DashboardPage.tsx` now uses `PageHeader`, `Card`, `Button`, `Badge`,
      `Table`, `Skeleton` and `EmptyState`. `theme-dark.css` 631 → 419 lines
      and `theme-dark-overrides.css` → 332; `loading-states.css` 94 → 19.

      **The key change was not swapping components.** `.dashboard-page`
      defined its own private palette (`--dashboard-surface`, `--dashboard-
      border`, `--dashboard-muted`, ...) with hardcoded light values that were
      never re-themed for dark — which is *why* dark mode needed a
      component-by-component override list at all. Those are now aliases onto
      the semantic layer, so every rule using `var(--dashboard-*)` follows the
      theme for free. That single change is what let 22 dark-override selector
      entries be deleted. **Expect the same pattern on the other pages —
      look for a page-local palette before migrating components.**

      Two real bugs found and fixed along the way:
      - `.status-info` was used in **10 places across 5 pages** and defined in
        no stylesheet, so every info banner in the app rendered as bare padded
        text with no background, border or colour. Now defined in `base.css`.
      - **Legacy dark rules outrank the primitives.**
        `:root[data-theme='dark'] button` has specificity (0,2,1) and beat
        `.ui-button-primary` (0,1,0), so in dark mode every migrated button —
        primary, danger, disabled — collapsed to the same grey. Seven such
        selectors across the two dark sheets are now scoped with
        `:not(.ui-button, .ui-icon-button)`. **This will affect every
        remaining page**; the exclusion disappears when Phase 5 deletes those
        files.

      Two traps for the next page, both of which cost time here:
      - A screenshot fixture must include `<aside class="sidebar">`.
        `.app-shell` is a two-column grid, so without it `<main>` renders
        inside the 214px nav column and everything looks broken.
      - Scoping scripts must tolerate a leading `/* comment */` on the first
        selector in a list. One rule hid from the first pass exactly that way,
        and the clean rebuild that "proved" the fix had not worked was in fact
        reporting a genuinely still-broken rule.

      Deliberately deferred: the bespoke summary-bar visualisation and the
      donut chart keep their own CSS — charts are Phase 6.

      **Two follow-ups after reviewing the change against the real app:**
      - `PageHeader`'s eyebrow is **sentence case, not uppercase** — settled
        decision, do not "fix" it later. It carries a personal greeting
        ("Good evening, Francisco") on these pages, and an uppercase micro-
        label reads as a system tag rather than an address to the person.
      - The recent-transactions **subtitle duplicated the title** on real
        data: `getReasonText` falls back to `transaction.description` when a
        row has no notes and a `raw_description` equal to its description, so
        rows rendered as "Prenda de Anos Ze / Prenda de Anos Ze". A new
        `getSecondaryReasonText` returns `null` in that case and the line is
        omitted. Worth checking wherever else `getReasonText` is used.

      **Still open on this page:**
      - *Card inside a card on the Spending breakdown panel.*
        `ExpenseCategoryDonutChart` renders its own `.expense-chart-card`
        surface and the Dashboard wraps it in a `Card` as well, so the donut
        sits in a visibly lighter inset rectangle while `Monthly summary`
        beside it is flat. Introduced by the Phase 4 migration. Fix: either
        drop the wrapper to `padding="none"` and let the chart own its
        surface, or strip `.expense-chart-card`'s border/background/radius and
        let `Card` own it — the second is preferable, since it is the same
        nesting problem `charts.css` currently papers over with 15
        `!important` declarations for `WealthMonthlyChart`. Disposition: leave this open and resolve it in Phase 6 together with `WealthMonthlyChart`; do not include it in the Transactions migration unless it blocks verification.
      - *Fully-owed transactions render a column of `€0.00`* in the recent
        list (product decision, not styling). Arithmetically correct — the
        personal amount is zero once the whole sum is owed — but on real data
        it reads as broken. Needs a "fully owed" treatment showing the gross
        amount instead.

      Note for future audits: the production app looks considerably better
      than a stripped test fixture suggests. The problems found in this work
      were mostly invisible — broken variables, an unloaded font, dead hover
      states, a fragile dark mode — rather than the pages looking bad.
- [x] **Transactions — migrated, reviewed and completed 2026-07-21.**
      `Button` (54 call sites), `IconButton` (4), `SegmentedControl` (2),
      `PageHeader` (2), `Badge` (7) and `EmptyState` (2). Verified: lint
      clean, 49/49 unit tests, build passing, **12/12 e2e** on chromium and
      mobile-chromium against a live backend, and computed-style assertions
      for the surface and badge fixes below.

      Done well, and worth copying on the remaining pages: the page-local
      palette (`--transaction-surface`, `--transaction-border`, ...) was
      aliased onto the semantic tokens rather than left hardcoded, which is
      the Dashboard lesson applied correctly. Dialog semantics
      (`role="dialog"`, `aria-modal`, `aria-labelledby`) were preserved, and
      `type="submit"` was kept explicitly where forms rely on it.

      Fixed during review:
      - **Every desktop row printed its description twice.** The desktop table
        rendered `raw_description` unconditionally while the mobile card
        already guarded it with `raw_description !== description`. Now guarded
        on both, preserving the grouped-row count suffix.
      - **17 bare `:not(.ui-button)` exclusions** converted to
        `:not(:where(...))`. Bare `:not()` contributes its argument's
        specificity — the exact mechanism that broke the dark sidebar in #70.
        None had caused visible breakage yet; this removes the latent trap.
      - **`.transactions-page-header` CSS removed** (6 rules in
        `transactions-mobile.css`, 2 in `index.css`). `PageHeader` replaced
        the class and left the rules orphaned.
      - **All 7 legacy `.badge` spans replaced with `Badge`**, and the labels
        are now produced in TypeScript instead of by CSS
        `text-transform: capitalize`. CSS cannot know where word boundaries
        are, so it rendered "activobank" as "Activobank" and "trading212" as
        "Trading212". `SOURCE_LABEL` and `CASHFLOW_LABEL` maps give
        "ActivoBank", "Trading 212", "Income"/"Expense"/"Transfer", with a
        sentence-case fallback for unknown values. A computed-style assertion
        checks `text-transform: none` on every badge and that zero legacy
        `.badge` elements remain.
      - **Both empty states now use `EmptyState`** (mobile list and the
        `td[colspan]` row) with an icon and a "adjust the filters, or add a
        transaction" follow-up, instead of a bare sentence.
      - **The page's two surface colours were unified.** The filter panel and
        table wrap rendered at `#1c1d21` while every migrated button and badge
        used `--color-surface` (`#18181b`). Two causes: the legacy dark sheets
        listed both classes in their `#1c1d21 !important` rule, *and* the
        table wrap additionally carried the generic `content-card table-wrap`
        classes, which are in the same rule. Removed both classes from the
        element — neither contributed anything unique, since
        `.transactions-page .transaction-desktop-table-wrap` already sets the
        border, radius, background and a 960px table `min-width` that
        overrode the generic 920px — and dropped the six dark-override
        entries. Asserted equal computed backgrounds in dark.
      - **`.transactions-page thead th` hardcoded `#fbfbfd`/`#475569`**
        tokenised to `--color-surface-sunken` / `--transaction-muted`.

      Considered and deliberately **not** done: adding `aria-label` to the
      mobile Edit/Delete row actions. Their desktop twins have one, so a
      screen reader on mobile hears "Edit" repeated once per row. It is a
      genuine pre-existing gap, but fixing it changes the buttons' accessible
      names and breaks three `TransactionsPage` tests that select on the bare
      name `Edit`/`Delete` — the mobile and desktop buttons would then be
      indistinguishable to `getByRole`. Worth doing as its own change, with
      the tests reworked to scope by row.
- [ ] Investments — also delete the `investments-page-polished` class and the
      per-page `margin-bottom: 0` patch blocks at the end of `index.css`;
      polish becomes the default, not a per-page opt-in
- [ ] Wealth
- [ ] Owed
- [ ] Categories
- [ ] Import
- [ ] Export
- [ ] Settings
- [ ] Privacy

For each page: swap raw elements for primitives, delete that page's
now-redundant CSS, delete that page's entries from the dark-mode override
files, then run the full verification workflow.

### Phase 5 — Dark mode collapse

- [ ] Delete `theme-dark.css` (618 lines), `theme-dark-overrides.css`, and
      `investments-dark.css`. By this point they should be nearly empty.
      Acceptance: no file matching `*dark*.css` remains under
      `src/styles/`, and adding a new component requires no dark-mode work.
- [ ] Add a theme transition on `background-color` and `color` so toggling
      no longer flashes.
- [ ] Verify every page in both themes at 375px, 800px, and 1440px.

### Phase 6 — Charts and icons

- [ ] Add `frontend/src/components/charts/`: a `useChartScale` hook plus
      shared `ChartAxis`, `ChartGrid`, `ChartTooltip`, `ChartLegend`.
- [ ] Stop hiding chart features. `charts.css` sets `display: none` on
      `.trend-chart-grid-line`, `.wealth-chart-area`,
      `.wealth-chart-edge-point`, and `.wealth-chart-value-label` while the
      markup still renders them. Render gridlines properly instead.
- [ ] Move `SLICE_COLOURS` out of `ExpenseCategoryDonutChart.tsx` into
      `--chart-1` … `--chart-8` semantic tokens so all four charts share one
      theme-aware palette and legend swatches provably match their slices.
- [ ] Fix the nested-card markup in `WealthMonthlyChart` so the 15
      `!important` declarations in `charts.css` can be deleted rather than
      preserved.
- [ ] Add hover tooltips with a crosshair to both trend charts, and format
      y-axis labels as currency via the existing `utils/format.ts`.
- [ ] Make donut interaction keyboard-accessible. Slices are `<circle>`
      elements with `onClick` and no `role`, `tabIndex`, or key handler —
      currently mouse-only. Either promote them properly or move the
      interaction to the legend buttons, which already are real buttons.
- [ ] Give every chart loading (skeleton at final height), empty
      (`EmptyState`), and error states.
- [ ] Standardise icons on `lucide-react`, already a dependency but used in
      only 3 files. Add `ui/Icon.tsx` with a fixed size scale (14/16/20/24)
      and no inline sizes.
- [ ] Replace the `content: "Show"` / `content: "Hide"` CSS pseudo-content
      in `base.css` (`.compact-filter-panel`) and `index.css`
      (`.wealth-mobile-account-group-header`) with a rotating chevron icon,
      keeping `aria-expanded` so state stays announced.
- [ ] Add icons to table row actions, sort direction, status banner tones,
      empty states, import source rows, and page-header primary actions.
      Every icon-only button needs an `aria-label`.

### Phase 7 — Consistency sweep and guardrails

- [ ] Full visual pass: every page, both themes, 375px / 800px / 1440px.
- [ ] Add Stylelint with `declaration-property-value-disallowed-list`
      banning raw hex/`rgb()`/`hsl()` outside `tokens/primitives.css`, and
      banning `!important` outside an explicit allowlist.
- [ ] Add a lint rule restricting `padding`, `margin`, `gap`, and
      `border-radius` to `var(--space-*)` / `var(--radius-*)`.
- [ ] Wire Stylelint into `.github/workflows/ci.yml` next to the existing
      `eslint .` step and add it to `required-checks`'s `needs` list.
- [ ] Apply the project's 1000-line file cap to CSS. `index.css` (854) and
      `theme-dark.css` (618) are the two files closest to it and are exactly
      the ones that should not exist in that form by the end.
- [ ] Add an "adding a new component" section to `frontend/README.md`: use a
      `ui/` primitive, use semantic tokens, never write a
      `[data-theme='dark']` selector.
- [ ] Final acceptance: `rg '#[0-9a-fA-F]{3,8}' frontend/src --type css`
      matches only inside `tokens/primitives.css`.
