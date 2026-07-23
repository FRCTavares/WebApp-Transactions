# F - Transactions: Open Tasks

Project overview, stack, and free-tier context: [`README.md`](README.md).

Readiness evidence and resolved decisions:
[`docs/production-roadmap.md`](docs/production-roadmap.md).

This file contains only unresolved, actionable work. Complete tasks and
historical implementation notes belong in the changelog, roadmap, issue, or
pull-request history rather than this file.

Work remains ordered by the project's priorities: security, ownership,
financial correctness, atomicity, backup and recovery, data integrity,
CI/deployment reliability, accessibility, and UI maintainability.

## 1. Dependency and release risks

## 2. Outstanding verification and product decisions

## 3. Financial correctness and atomicity

- [ ] **Handle linked owed obligations when deleting money-out transactions.**
      When a money-out transaction is linked to an owed obligation, deletion
      must not silently leave the owed data inconsistent. Before deletion, show
      the linked obligation and require an explicit action:

      1. delete the transaction and the linked owed obligation;
      2. delete the transaction while preserving the obligation and selecting
         who now owes the money; or
      3. cancel without changing any records.

      The backend, not the frontend, must determine the authoritative linked
      records and validate that the transaction, owed item, allocations, and
      selected replacement party all belong to the authenticated user. The
      operation must be orchestrated by a service and committed atomically.

      Define and test the behaviour for partially paid obligations, obligations
      containing multiple linked transactions, transactions linked to multiple
      allocations, invalid reassignment targets, stale records, and attempted
      cross-user references. Destructive removal must be blocked whenever the
      remaining accounting cannot be preserved correctly.

      Acceptance:

      - unlinked transaction deletion continues to use the normal flow;
      - linked deletion always presents the relationship-aware decision;
      - no mutation occurs before an explicit strategy is selected;
      - deleting both removes only the correct owned records atomically;
      - preserving or reassigning keeps the correct outstanding amount;
      - cancellation and failed requests leave all records unchanged;
      - user ownership is enforced entirely by the backend;
      - service and repository tests cover each strategy and rollback;
      - frontend tests cover the dialog, cancel path, each allowed action,
        validation errors, and controlled backend failures.

- [ ] **Clarify Dashboard investment cash flow and monthly investment goal.**
      The current Dashboard “Investments” metric displays unrealised monthly
      market gain or loss, and the Net metric adds that value to income minus
      personal spending. This incorrectly mixes investment performance with
      spendable cash.

      Replace that model with explicitly separated monthly measures:

      - `Money In`: personal cash income received;
      - `Money Out`: personal consumption and other spend, excluding amounts
        recoverable through owed obligations;
      - `Invested`: net personal cash contributed to investments during the
        selected month;
      - `Available Net`: Money In minus Money Out minus net invested cash; and
      - `Investment performance`: unrealised market and FX gain or loss,
        displayed separately and excluded from Available Net.

      Add a configurable monthly investment goal, initially EUR 100. The
      Dashboard must show the amount invested against that goal, the remaining
      amount, and whether the goal was reached. Automatic investment activity
      must update this progress from authoritative stored financial records.

      Define authoritative contribution semantics before implementation.
      Investment purchases funded from an investment account, broker deposits,
      withdrawals, sales, fees, dividends, and internal account transfers must
      not be treated interchangeably. Net invested cash must represent external
      personal cash committed to investments, less qualifying withdrawals,
      without treating unrealised gains as cash.

      Prevent double-counting when the same EUR 100 movement appears both as a
      bank money-out transaction and as a Trading 212 deposit or investment
      event. Add an explicit reconciliation or provenance relationship rather
      than relying on matching descriptions. Services must validate user
      ownership and apply any multi-record linking atomically.

      Acceptance:

      - the existing investment pill's current calculation is documented in
        code and replaced with unambiguous labels;
      - unrealised gain or loss no longer changes Available Net;
      - investing EUR 100 reduces Available Net by exactly EUR 100;
      - the EUR 100 is not included in ordinary spending-category totals;
      - the goal shows invested, remaining, reached, and over-goal states;
      - withdrawals and reversed or corrected events have defined behaviour;
      - one economic movement represented in two sources is counted once;
      - all authoritative calculations use Decimal values, not floating point;
      - backend tests cover contributions, withdrawals, gains, losses,
        reconciliation, ownership boundaries, and rollback;
      - frontend tests cover all goal states, unavailable partial data, and
        explanatory labels.

## 4. Frontend design system

Full audit and target design system:
[`docs/frontend-design-system.md`](docs/frontend-design-system.md).

Preserve all existing accessible names, roles, `aria-label` values, and
`data-testid` values unless a task explicitly requires updating their tests.

Each implementation must finish with:

- focused tests;
- `npm run lint`;
- `npm run lint:css`;
- `npm run test`;
- relevant Playwright tests;
- `npm run build`;
- `git diff --check`;
- changed-file line counts;
- full diff review;
- final repository-status review.

### Phase 5 — Dark-mode collapse

- [ ] Delete `frontend/src/styles/theme-dark.css` and
      `frontend/src/styles/theme-dark-overrides.css`. The remaining live
      selectors require per-component-family tokenisation before their
      overrides can be removed. Start with the largest remaining families:
      investment holdings, Dashboard metric icons and summary bars,
      expense-chart internals, mobile bottom navigation, generic cards,
      table wraps, manual forms, market-data cards, and import panels.

      Acceptance: no file matching `*dark*.css` remains under
      `frontend/src/styles/`, and adding a component requires no separate
      dark-mode styling.

- [ ] Add a theme transition for `background-color` and `color` so changing
      themes no longer flashes. Respect `prefers-reduced-motion`.

- [ ] Verify every page in both themes at 375px, 800px, and 1440px.

### Phase 6 — Charts and icons

- [ ] Add `frontend/src/components/charts/` with a `useChartScale` hook and
      shared `ChartAxis`, `ChartGrid`, `ChartTooltip`, and `ChartLegend`
      components.

- [ ] Stop hiding chart features. Render the existing trend-chart gridlines,
      wealth-chart area, edge point, and value label instead of suppressing
      them with `display: none`.

- [ ] Add hover tooltips with a crosshair to both trend charts and format
      y-axis labels as currency through the existing `utils/format.ts`.

- [ ] Make donut interaction keyboard-accessible. The `<circle>` slices
      currently have `onClick` without a role, `tabIndex`, or keyboard
      handler. Either make the slices fully interactive or move interaction
      to the existing legend buttons.

- [ ] Give every chart loading, empty, and error states. Loading skeletons
      must reserve the chart's final height.

- [ ] Standardise icons on `lucide-react`. Add `ui/Icon.tsx` with fixed
      14px, 16px, 20px, and 24px sizes and no call-site inline sizing.

- [ ] Replace the CSS-generated “Show” and “Hide” text in the compact filter
      panel and Wealth mobile account-group header with a rotating chevron,
      while preserving `aria-expanded`.

- [ ] Add icons to table row actions, sort direction, status-banner tones,
      empty states, import-source rows, and page-header primary actions.
      Every icon-only button must have an `aria-label`.

### Phase 7 — Consistency sweep and guardrails

- [ ] Extend the raw-colour guard to TypeScript and TSX. The current Stylelint
      ratchet covers stylesheets but does not catch hex literals in JSX style
      or attribute positions.

- [ ] Extend Stylelint enforcement beyond the existing raw-hex ratchet to ban
      raw `rgb()` and `hsl()` colour values outside the primitive token file,
      and ban `!important` outside a narrowly documented allowlist.

- [ ] Turn the interactive visual audit into a repeatable standing check.
      Cover every page and every dialog, menu, inline form, disclosure, and
      other click-dependent state in both themes at 375px, 800px, and 1440px.
      Seed representative data first and assert that each expected state
      actually opened.

- [ ] Complete the final visual pass for every page in both themes at 375px,
      800px, and 1440px.

- [ ] Add lint enforcement restricting `padding`, `margin`, `gap`, and
      `border-radius` to the project's `--space-*` and `--radius-*` tokens,
      with narrowly documented exceptions where necessary.

- [ ] Apply the project's 1000-line production-file cap to CSS and split
      oversized or overly broad stylesheets into focused modules.

- [ ] Add an “Adding a new component” section to `frontend/README.md`:
      use an existing `ui/` primitive, use semantic tokens, and never add a
      component-specific `[data-theme='dark']` selector.

- [ ] Reach the final raw-colour acceptance criterion:

      `rg '#[0-9a-fA-F]{3,8}' frontend/src --type css`

      must match only `frontend/src/styles/tokens/primitives.css`.
