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

- [ ] Merge the five open Dependabot backend PRs, in this order to keep
      each rebase small:

      - #90 `peewee` 4.2.3 -> 4.2.6
      - #91 `fastapi` 0.139.0 -> 0.139.2
      - #92 `websockets` 16.1 -> 16.1.1
      - #93 `platformdirs` 4.10.0 -> 4.11.0
      - #94 `certifi` 2026.6.17 -> 2026.7.22

      All five currently show "Frontend e2e" and "Required checks" as
      failing, but those CI runs predate the 2026-08-03 Phase 7 merge
      (job IDs ~29.9M vs current ~308M) and the e2e failure completed in
      1-2 minutes - too fast to be the 546-test suite actually running,
      let alone timing out. That status is stale, not a real signal.

      For each PR: rebase onto current `main` (or close it and let
      Dependabot recreate it against `main`), then let CI run fresh
      before trusting the result. All five already pass the backend
      pytest suite on their stale runs, so if a rebased run still fails
      e2e specifically, suspect a startup-only regression in that
      package - e2e's `webServer` step boots a real `uvicorn` process
      that plain `pytest` never exercises, so a bump that breaks server
      startup (as opposed to request handling) would show up there and
      nowhere else. Investigate before merging rather than assuming it's
      another stale-CI false alarm.

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


### Phase 7 — Consistency sweep and guardrails
