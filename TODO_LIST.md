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

- [ ] Add Playwright interactive-state coverage for the Investments page's
      "Add trade"/"Add manual position" modal (see the comment above the
      Categories block in `frontend/e2e/interactive-state-coverage.spec.ts`).
      It has unit coverage (`ManualInvestmentEventForm.test.tsx`) but no
      e2e coverage of the modal open/close/submit flow.
- [ ] Decide whether to delete the now-frontend-unreachable backend
      surface left over from the Investments page cleanup: the
      `investment-funding-months` routes/service/repository, the manual
      market-price CRUD endpoints (`POST`/`PATCH`/`DELETE
      /api/market-prices`), and `resolve-manual-funding`. Nothing in the
      frontend calls these anymore, but removing backend routes/services/
      migrations is a separate, larger change from the frontend cleanup and
      wasn't done here.

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

### Phase 7 — Consistency sweep and guardrails
