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

- [ ] Shard the `Frontend e2e` CI job. It now runs 546 tests across 5
      Playwright browser projects with only 2 GitHub Actions workers,
      taking 16-18 minutes per run (`.github/workflows/ci.yml`,
      `e2e-tests` job, `timeout-minutes: 30`). Every PR pays this cost
      even for changes that can't affect the frontend (a pure backend
      dependency bump blocked five separate merges behind five separate
      17-minute waits on 2026-08-03/04 before they were batched into one
      PR as a workaround). Fix properly with Playwright's built-in
      sharding (`--shard=1/N`) split across N parallel GitHub Actions
      matrix jobs, rather than relying on Playwright's own in-process
      worker parallelism inside a single job. Consider also skipping the
      job entirely (or running a reduced subset) on PRs that only touch
      `backend/requirements.txt` or other files with no possible
      frontend impact, using `paths`/`paths-ignore` filters - but note
      the `webServer` step boots a real backend process, so a pure
      Python dependency bump can still legitimately need e2e coverage if
      it could break server startup; any skip rule must not silently
      hide that case.

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
