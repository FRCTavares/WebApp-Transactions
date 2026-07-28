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


### Phase 6 — Charts and icons


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
