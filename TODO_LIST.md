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
