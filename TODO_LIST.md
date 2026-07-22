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

## 12. Frontend Design System — open

<!-- This section previously read "(#36)". That is wrong: #36 is a merged pull
     request titled "Enforce formatting and improve accessibility", not an
     issue tracking this work. There is no GitHub issue for the design system;
     progress is tracked here and in docs/frontend-design-system.md. -->


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

**Phase 4 is complete.** All nine pages are on the primitives. Next is Phase 5,
the dark-mode collapse, which Phase 4 was the precondition for.

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
- [x] **Investments — migrated 2026-07-21.** `Button` (14 call sites),
      `Badge` (all 8 legacy `.badge` spans) and `EmptyState` (6). Verified:
      lint clean, 49/49 unit tests, build passing, 12/12 e2e, and a
      dark-surface assertion across **all eight pages**.

      **`investments-page-polished` is gone.** It was applied only ever
      alongside `investments-page` on the same element, so it was a second
      name for the same thing — "polish" as a per-page opt-in. Renaming
      collapsed **131 rules** across 5 files into the base class; a rename
      keeps specificity identical and preserves source order, so the cascade
      is unchanged. Polish is now simply how the page looks.

      This migration went **wider than the page**, deliberately. The page uses
      the shared `.panel-card` / `.content-card` / `.portfolio-snapshot`
      classes, all of which hardcoded `background: #ffffff` and were kept
      readable in dark mode only by an `!important` override. Removing the
      override alone would have broken four other pages, so the surfaces were
      tokenised instead — which fixes Investments, Wealth, Owed, Import and
      Export at once and let 16 dark-override entries be deleted.

      That exposed two things the override had been masking:
      - **Wealth rendered white panels in dark mode**, because its page-local
        palette was still hardcoded. Caught by a cross-page assertion, not by
        looking at Investments. `--wealth-*` and `--owed-*` are now aliased to
        the semantic layer like the other pages, which also de-risks their own
        migrations.
      - **Six investments surfaces were already broken** in dark mode
        (`#fbfbfd` / `#ffffff` with no override at all). Confirmed
        pre-existing by stashing the branch and re-testing at `HEAD`. Now
        tokenised.

      **A colour audit that only reads `background-color` is not enough.**
      After the hex sweep came back clean, the Portfolio summary band was
      still white in dark mode — three hardcoded `linear-gradient`s, which
      live in `background-image` and so were invisible to the probe. They are
      now flat token surfaces; the gradients added almost nothing in light
      mode and could not theme at all.

      Also fixed: my own selector-dedupe script had stripped the blank lines
      between CSS rules, producing `}.next-selector {`. Valid CSS, unreadable
      diffs. Eight files reformatted.

      Not adopted: `Card` (the page's panels are shared classes now tokenised,
      so wrapping them buys nothing yet), `Table`, `Field`, `Skeleton`.

      **Follow-up (2026-07-21): the portfolio trend line was not missing data
      points — it was missing prices, and then FX rates.**

      The chart looked like it had "too few points". It does not: the endpoint
      returns one point per month for all 24 months, and the SVG plots every
      one. The line looked smooth because months without a stored price are
      valued by carrying the last known price forward, so the line tracked the
      cost basis rather than market movement. Local price history covered only
      2 of 24 months.

      A "Backfill history" action now fetches daily closes for every open
      position across the charted window. No new backend work was needed —
      `POST /api/market-prices/fetch/history`, `MarketPriceService.fetch_history`
      and the provider's `get_history` all already existed, and even
      `fetchMarketPriceHistory` was already in the frontend API module. Nothing
      had ever called it. Verified against the local database: all three
      tickers went from 2 months of prices to 24 (720/498/496 daily rows), and
      the valued portion of the series went from near-flat to €2,243 → €4,000
      across 10 months with 12 distinct values.

      **The remaining gap was FX rates, not prices — now resolved.** Months
      from 2024-09 to 2025-09 returned no market value even with full price
      history, because every CSPX buy in that period was in USD with
      `fx_rate_to_eur = NULL` and `fx_rate_source = 'pending'`. Historical
      valuation converts every holding to EUR from a rate carried on an event,
      so **one** unresolved non-EUR event makes every month from that date
      onward unvaluable — 82 pending events silently truncated the trend by a
      year.

      `ImportFxResolutionService` only resolves rates *during* an import;
      nothing ever revisited stored events. Added
      `PendingFxResolutionService` (`pending_fx_resolution_service.py`) plus
      `GET /api/investment-events/pending-fx` (preview) and
      `POST /api/investment-events/pending-fx/resolve` (commit).

      Design decisions, given this writes to financial records:
      - **Preview then commit**, mirroring the import workflow. The UI previews,
        shows what will change, and asks for confirmation before writing.
      - **Rates are never invented.** If the provider has no rate on or before
        an event's date, that event stays pending and is reported as
        unresolvable — no carry-forward, no guess.
      - **Never uses a rate dated after the event.** There is a regression test
        for this specifically.
      - **One provider call per currency**, covering the whole span, instead of
        one per event date — 82 events needed 76 distinct dates.
      - `fx_rate_source` records the exact rate date
        (`yfinance_historical:2024-09-06`), so every value stays auditable.
        Note `fx_rate_source` is `String(30)` and that format is exactly 30
        characters, so the prefix cannot grow without a migration.
      - The service owns the transaction and commits once, per the layering
        rules; the repository only reads.

      Result on the local database: 82/82 resolved, 0 left pending, and the
      trend went from **10 valued months to 24/24 with 24 distinct values**
      (€34.93 in 2024-09 rising to €3,946.33 in 2026-07). The full two-year
      curve is real data end to end.

      8 new backend tests (`test_pending_fx_resolution.py`); backend suite
      479 passing. One of them initially failed the ownership-boundary guard —
      it inspects the AST of every user-owned model construction and requires
      `user_id` as a visible keyword, which `InvestmentEvent(**defaults)` hid.
      Fixed by passing it explicitly rather than by weakening the guard.

      Also note: the backfill endpoint requires `get_privileged_user`, exactly
      like the existing "Refresh prices" action — market data is shared and
      admin-maintained, so both are owner-only by design. And this increases
      yfinance usage, which section 11 already flags as an unresolved Yahoo
      ToS risk before any wider release.
- [x] **Wealth — migrated 2026-07-21.** `PageHeader`, `Button` (18 call sites
      across the page and 6 components) and `EmptyState` (3). Verified: lint
      clean, 49/49 unit tests, build passing, 12/12 e2e on chromium and
      mobile-chromium against a live backend, and both themes screenshotted at
      desktop and mobile including the account form, snapshot form and
      snapshots panel.

      Quick page, because `--wealth-*` was already aliased onto the semantic
      layer during #74 — the Dashboard lesson paid off in advance. No page-local
      palette work was needed and there were no legacy `.badge` spans.

      Migrating the header fixed the period pill overlapping the `<h1>`, as
      predicted. **That fix then needed a second pass.** Reserving a centre
      column squeezed Wealth's description into three cramped lines, because
      Wealth is the first migrated page with a long `description`. The pill only
      covers the *first line* of the header, so the title block now spans the
      full width while the eyebrow and title — the parts level with the pill —
      are clamped short of it. Both title block and actions are pinned to row 1
      so the buttons stay level with the title rather than dropping below.

      Also fixed: the description's box started 1px above the pill's bottom
      edge, invisible only because the glyphs sit lower in the line box and one
      font-size change from a real overlap. It now has real clearance.

      Deliberately not converted:
      - `wealth-account-group-button` — a whole account card acting as a
        button, not a UI button.
      - The chart's 6M/12M/24M/5Y window selector. It is a `SegmentedControl`
        by rights, but it lives inside `WealthMonthlyChart`, whose 15
        `!important` declarations in `charts.css` are Phase 6 work. Converting
        the control without resolving the nesting would entangle the two.

      Shortened the two form toggles from "Close account form" / "Close
      snapshot form" to "Close account" / "Close snapshot": the longer labels
      overflowed the reserved actions column and wrapped the header onto two
      rows whenever a form was open. The snapshot toggle also drops to
      `secondary` while open, matching Owed — it means "close" in that state,
      so it should not read as the primary action.

      Deleted the CSS the migration orphaned: `.wealth-page-header`,
      `.wealth-empty-state`, `.wealth-mobile-empty`,
      `.wealth-account-action-danger` — 5 rules plus 8 selectors pruned from
      mixed lists.

      **The Investments header was migrated in the same change**, rather than
      left as a known production defect: it was the last page still on the
      legacy `.page-header` and was clipping "Resolve FX" by 51px live. Every
      page that renders a period pill is now verified clear in both themes,
      with an assertion that the header actions do not wrap onto a second row.

      Its three actions needed 326px against the 323px available to the right
      of the pill, so no layout change could fit them - the content was simply
      too wide. "Backfill history" is now "Backfill"; it carries a `title` that
      explains it in full. Deleted `.investments-page-header` and the three
      `.investments-page .page-title-block h1` rules that PageHeader orphaned
      (the generic `.page-header` / `.page-title-block` stay: App, Import and
      Export still use them).
- [x] **Owed — migrated 2026-07-21.** `PageHeader`, `Button` (all raw buttons),
      `Badge` (all legacy `.badge` spans), `SegmentedControl` and `EmptyState`.
      Verified: lint clean, 49/49 unit tests, build passing, 12/12 e2e on
      chromium and mobile-chromium against a live backend, and both themes
      screenshotted at desktop and mobile.

      **The blocking bug was bigger than first diagnosed.**
      `.owed-page-polished .owed-table-wrap` carried `overflow: hidden`, so
      Save and Cancel sat ~340px past the right edge with no scrollbar. The
      first fix (`overflow-x: auto` plus a sticky actions column) made Save
      reachable but left the real problem: the inline form was a `<tr>` spread
      across nine columns, ~1650px wide in a ~1010px container, so the **total
      amount and linked-transaction fields sat underneath the sticky actions
      column** where they could be neither seen nor clicked. Adding an item
      with an amount was still effectively impossible.

      Both inline rows are now one `OwedInlineForm` in a single full-width
      cell, laid out on a grid that fits the container at any width. Every
      field is labelled and visible, and the two forms no longer duplicate
      ~100 lines of JSX.

      **`toBeInViewport()` is not enough, and this is the second time.** It
      passes for a control that is on screen but covered by something else —
      exactly how both the sticky-column occlusion and the mobile tab bar
      hiding Save got through a green suite. Verification now hit-tests the
      centre point with `elementFromPoint` and requires the button itself to
      answer. That check failed immediately on mobile and found a third bug:
      `main`'s 1.35rem bottom padding left the last control on the page under
      the fixed bottom nav (now clears it).

      Fixed while there:
      - **The row disclosure affordance.** The `aria-hidden` "⋯" is now a
        chevron that rotates when open, with a visually-hidden "Details" as
        its accessible name. The person-card header row and the item summary
        share one grid template and had to change together. Added a
        `ui-visually-hidden` utility — the codebase had none.
      - **The period pill overlapped the page header actions.**
        `.global-topbar` is `position: absolute; left: 50%`, so it is out of
        flow and floats over whatever the header puts under it: Owed clipped
        "Export CSV" by 19px. `.ui-page-header` now reserves a centre column
        on pages that render a pill. **Wealth and Investments still collide**
        (Investments clips "Resolve FX" by 51px) because they are still on the
        legacy `.page-header`; migrating them fixes it for free.
      - **Mobile amounts were clipped to "€85"** — the person-item summary
        declared three grid tracks for four visible children, so the amount
        landed in the 1.2rem track sized for the old ellipsis and the chevron
        wrapped onto a second row.
      - Table columns 3+ now shrink to content, so Person and Description stop
        wrapping mid-word now that the form no longer forces the table wide.
      - Deleted the CSS the migration orphaned: `.owed-row-action*`,
        `.badge-owed-status*`, `.owed-empty-state` — 14 rules, plus 10
        selectors pruned from mixed lists in the two dark sheets.
      - `Button` and `Badge` gained an appended `className`, matching `Card`.

      Earlier, ahead of the migration: 16 `aria-label`s added to the inline
      inputs (both amount fields were `placeholder="0.00"`, indistinguishable
      to a screen reader), the 80px Status column breaking "open" into
      "ope / n", and `.owed-table th`'s hardcoded `#fbfbfd`/`#475569`.

      A note on the harness, since it cost real time: `page.route` globs treat
      `?` as a single-character wildcard, so `**/api/owed?**` also matched the
      Vite module `/src/api/owed.ts` and served JSON in its place — a blank
      page and four vacuously passing tests. The app also registers `/sw.js`,
      which intercepts fetches before `page.route` sees them. Verifying
      against the real backend is more reliable than stubbing here.

      Still open: the VIEW `<select>` and the Current / Paid history / All
      history buttons are two controls for the same state, which is
      redundant — a product decision rather than styling, so left alone.
- [x] **Categories — migrated 2026-07-21.** `PageHeader`, `Button` (15 call
      sites), `IconButton` (2 dialog closes) and `EmptyState`. Verified: lint
      clean, 49/49 unit tests, build passing, 12/12 e2e, and both themes
      screenshotted at desktop and mobile including the replacement and
      migration dialogs, with every control hit-tested for occlusion.

      **This page carried its own dark mode.** `transaction-categories.css`
      had 54 `[data-theme='dark']` selectors in 27 rules — the largest such
      block left — because its light values were hardcoded rather than
      tokenised, so dark had to be repainted by hand. Tokenising the light
      declarations onto the semantic layer made all 27 redundant. The sheet
      is 787 → 556 lines and now contains **zero dark-mode CSS**.

      That was proved rather than assumed. Computed colours for every selector
      the dark blocks targeted were captured with both dialogs open, the blocks
      deleted, and the measurement repeated. Five differences remained, all
      accounted for:
      - three are the page converging on the token palette (surface
        `#1c1d21` → `#18181b`, label `#d5d7dc` → `#f4f4f5`, border
        `rgb(255 255 255 / 0.075)` → `#2f3037`);
      - two were `currentColor` readings on **zero-width borders** —
        `.transaction-category-row` has `border-width: 0` on all four sides, so
        the dark rule was colouring a border that does not render. Dead code.

      Light mode changed in exactly two places, both deliberate: form labels
      moved from `gray-700` to `--color-text`, and one group border from a
      bespoke `#eef2f7` to `--color-border`. Collapsing bespoke greys onto the
      ramp is the point of the exercise.

      Deleted the CSS the migration orphaned: `.transaction-category-action*`,
      `.category-replacement-close`, `.transaction-category-empty-state`,
      `.transaction-category-empty-icon` — 11 rules plus 3 selectors. Note
      `.transaction-category-actions` (plural, the flex container) is still
      rendered; a substring match would have deleted it.
- [x] **Import, Settings, Export and Privacy — migrated 2026-07-21.**
      `PageHeader` (3), `Button` (12) and `Badge` (19). Verified: lint clean,
      49/49 unit tests, build passing, 12/12 e2e, all four pages screenshotted
      in both themes at desktop and mobile, a real Revolut CSV driven through
      preview and commit to see the preview and history badges, and every
      control hit-tested for occlusion.

      **The legacy badge system is gone.** These pages held the last 19 legacy
      `.badge` spans (7 in the import preview, 9 across the three rules tables,
      the import history status and source, and 2 in Wealth that a plainer grep
      had missed during that migration). With no call sites left, all 30
      `.badge*` classes were dead: **42 rules deleted across 13 stylesheets**,
      plus their dark-mode overrides.

      `SOURCE_LABEL` / `CASHFLOW_LABEL` moved out of `TransactionTable.tsx` into
      `utils/badgeLabels.ts` and gained direction labels and tones. The same
      source, direction and cashflow values are rendered by the transactions
      table, the import preview and history, and three rules tables; duplicating
      the maps four more times was the alternative. `CashflowRulesTable` also had
      its own `formatCashflowType` that only replaced underscores, leaving
      "money out" for CSS to capitalise.

      Fixed while there:
      - **Every successful import rendered a neutral grey badge.** The status
        tone map is keyed on the values `panels-import.css` anticipated
        (`committed`, `completed`, `imported`), but `success` — the only value
        the backend actually writes, via the `ImportBatch` model default — was
        in none of them. It is now `positive`.
      - **Sign out stretched across its row in Settings.**
        `.settings-account-row .danger-button` set `flex: 0 0 auto`, which does
        nothing: the row is a grid. It is `justify-self: start` now, matching
        the `<em>` that renders in its place when auth is disabled.

      Privacy needed no change and deliberately keeps its own markup: it is a
      public, unauthenticated legal document rendered outside the app shell,
      not a page with a header and actions.

      A process note: the first attempt at the Import header replacement sliced
      from the header to `<StatusMessage>` and deleted the entire upload panel
      with it — the source select, file input and Preview button. `tsc` caught
      it as four unused symbols. The file was reverted and redone with a helper
      that asserts each replacement matches exactly once, which is how the rest
      of the file's edits were then applied safely.

For each page: swap raw elements for primitives, delete that page's
now-redundant CSS, delete that page's entries from the dark-mode override
files, then run the full verification workflow.

### Phase 5 — Dark mode collapse

**State at 2026-07-22.** 901 -> 591 lines, 378 -> 206 selectors. Shipped in #81,
#82, #84, #85, plus the 5 selectors the Phase 6 nested-card fix took with it.

**Correction: "everything still in the three dark sheets is chart internals" was
wrong, and so was the claim that the nested-card fix unblocks this phase.** That
fix has now landed. It removed exactly 5 selectors — 596 -> 591 lines,
211 -> 206 — because the chart elements were only ever *listed* in these sheets,
never the bulk of them. What remains is broad and not chart-specific: the
dashboard metric icons and summary-bar tracks, the entire
`.investment-holding-card` family (33 selectors in `investments-dark.css` alone,
several of them `[class*='...']` matches), `.expense-chart-card`,
`.mobile-bottom-nav`, the market-data cards, the import panels, `.card`,
`.manual-form`, `.table-wrap`, and odd/even row striping on three tables.
Deleting these files is a per-component-family job, not one sweep.

The natural next tranche, and the twin of the fix just shipped, is
`.expense-chart-card` — the same nested-card shape on the Dashboard, already
recorded as open under Phase 4 and still carrying a `#1c1d21 !important`
override in `theme-dark-overrides.css`.

The original note that these files "should be nearly empty by now" was wrong and
is corrected here: removing all three today still changes 113 of 117 measured
selectors, and `.expense-chart-card` renders pure white in dark mode without
them. Phase 4 tokenised page-level surfaces; component internals were untouched.

- [ ] Delete `theme-dark.css` (618 lines), `theme-dark-overrides.css`, and
      `investments-dark.css`. By this point they should be nearly empty.
      Acceptance: no file matching `*dark*.css` remains under
      `src/styles/`, and adding a new component requires no dark-mode work.
- [ ] Add a theme transition on `background-color` and `color` so toggling
      no longer flashes.
- [ ] Verify every page in both themes at 375px, 800px, and 1440px.

### Phase 6 — Charts and icons

**State at 2026-07-22.** The shared chart palette is done (#87): both donuts read
`chartSliceColour()` from `utils/chartColours.ts`, which returns `--chart-*`
token references, so they theme correctly and a legend swatch and its slice are
the same token by construction. A unit test locks that identity.

- [x] **Fixed the `WealthMonthlyChart` nested card — 2026-07-22.** The inner
      `<div>` is now `.wealth-chart-body`, all **15** `!important` declarations
      are gone from `charts.css`, and the file no longer contains the word.
      Nine files touched, 110 lines deleted against 12 added.

      Verified: `npm run lint` clean, `npm run lint:css` at baseline,
      52/52 unit tests, `npm run build` passes, 12/12 e2e on chromium and
      mobile-chromium against a live backend, `git diff --check` clean.
      Above all: **7,830 computed values across 12 page/theme/width
      combinations were compared before and after, and all 24 screenshots are
      byte-identical.** The only reported difference is the class name itself.

      Three corrections to the map above, all of which cost time to find:

      - **`wealth-mobile.css` was not in the plan and held four more
        `.wealth-chart-card` selectors** (`:18`, `:158`, `:338`, `:363`),
        including a `background: var(--color-surface) !important` that paints
        the inner div as a card at ≤800px. It never rendered: `charts.css`
        loads after `wealth-mobile.css` at equal specificity, so its
        `background: transparent !important` won. Two of the four were selectors
        inside lists that also target `.wealth-trend-panel` and had to be pruned,
        not deleted.
      - **The two `min-height` rules the plan said to keep were both dead.**
        `wealth-chart.css:140` (`14.2rem`) is overridden by `:210` (`auto`), and
        both lose to `charts.css`'s `min-height: 0` at higher specificity.
        Measured `0px` before and after. Both deleted.
      - **The 15 `!important`s were not all about the card.** Five were, four
        were the same treatment for `.wealth-chart-wrap` /
        `.investment-trend-visual`, three were the dark-mode repeat, and two
        were `min-height`/`max-height` on the SVGs — which meant also deleting
        the `min-height: 11.25rem` and `max-height` declarations in
        `wealth-chart.css` and `investments.css` that they existed to defeat.

      `.investment-trend-visual` did have the same shape and got the same pass:
      `investments.css:692` gave it a radius and a `--color-surface-sunken`
      background, invisible because `charts.css` overrode both. Rule deleted;
      not renamed, since "visual" does not claim to be a card.

      One hex literal disappeared with `wealth.css`'s `.wealth-chart-card`
      (`#fbfbfd`), so `.stylelint-hex-baseline.json` drops 527 -> 526.

      **On the harness, for whoever does `.expense-chart-card` next.** Seeding
      went through the API and asserted `/api/wealth/monthly` and
      `/api/investment-events/monthly-series` were non-empty *before* any
      probe ran; the capture then asserted each chart's path `d` was actually
      drawn, so a blank page could not come back green. Probes listed both the
      old and new class name in one selector, which is what let the same script
      run unchanged on both sides. `backgroundImage` was read alongside
      `backgroundColor` — two of the deleted backgrounds were gradients and a
      `backgroundColor`-only probe would not have seen them at all.


- [ ] Add `frontend/src/components/charts/`: a `useChartScale` hook plus
      shared `ChartAxis`, `ChartGrid`, `ChartTooltip`, `ChartLegend`.
- [ ] Stop hiding chart features. `charts.css` sets `display: none` on
      `.trend-chart-grid-line`, `.wealth-chart-area`,
      `.wealth-chart-edge-point`, and `.wealth-chart-value-label` while the
      markup still renders them. Render gridlines properly instead.
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

**State at 2026-07-22.** The CSS hex ratchet is live (#86). `npm run lint:css`
runs in CI and enforces a baseline of **527** raw hex colours outside
`tokens/primitives.css`. It fails when the count rises *and* when it falls
without the committed baseline being lowered, so the number can only move
toward zero. Lower `maxHexColours` in `.stylelint-hex-baseline.json` whenever
you tokenise a file — that is how the 527 gets worked down, per file, safely.

- [ ] **Extend the hex guard to TS/TSX.** The ratchet scans stylesheets only.
      The chart palette removed in #87 was 12 raw hex values living in `.tsx`,
      entirely unguarded. Add an ESLint `no-restricted-syntax` rule for hex
      literals in JSX style/attribute positions, or widen the ratchet.

- [ ] **Make the interactive audit a standing check, not an improvisation.**
      The existing Phase 7 line says "every page, both themes, 375/800/1440" —
      pages, which is not enough. Three dark-mode bugs shipped in surfaces that
      only exist after a click: the Record Payment modal painted white under
      near-white text, the category dropdown's active option was pale blue under
      light text, and the Investments mobile funding summary was near-black on a
      dark card. It should read: every page **and every dialog, menu, inline
      form and disclosure**.

---

**Harness notes — read before writing any verification script.**

These cost real time to learn, and most of them produced a *passing* check over
visibly broken output.

- **Seed data first, and assert the state actually opened.** An empty database
  makes every check vacuous: pages render empty, dialogs cannot be reached, and
  the run comes back green having proved nothing. Assert the dialog is visible,
  not just that the click did not throw.
- **Seed through the API, not raw SQL.** The API cannot drift from the schema.
  Hand-written INSERTs failed on `transaction_categories.direction`,
  `transactions.raw_description`, `account_type: 'savings_account'` (not
  `savings`), and `investment_events.amount` needing `gt=0` even for buys.
- **Some states need a specific data shape.** The Wealth account modal only
  appears for a *group* — two or more accounts sharing an `institution`.
- **The dark sheets are imported from `src/main.tsx`, not `index.css`.**
  Removing the wrong imports once produced "0 of 104 selectors changed", which
  was a build being diffed against itself.
- **A selector-level snapshot only watches selectors the deleted rules name.**
  It reported zero regressions while the spending-breakdown legend rendered
  `#111827` on `#232429`. Screenshots caught it; the snapshot could not.
- **`toBeInViewport()` passes for a control that is covered.** Hit-test the
  centre point with `elementFromPoint` and require the element itself to answer.
- **A colour audit that reads only `backgroundColor` is structurally blind.**
  Gradients live in `background-image`. That hid the white Portfolio band, and
  it still produces false positives on the Owed person cards.
- **Use exact selector matching when bulk-deleting CSS rules.** Substring
  matching made `'tr'` match `.expense-chart-track` and silently ate chart rules.
- **Assert your string replacements matched.** `str.replace` is a silent no-op
  when the target is not found; a helper that asserts exactly one match caught
  an edit that had deleted the entire Import upload panel.
- **Run e2e against a throwaway database.** `backend/scripts/start_e2e_backend.sh`
  does this; `APP_ENV=e2e` refuses to serve `data/finance.db`.


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
