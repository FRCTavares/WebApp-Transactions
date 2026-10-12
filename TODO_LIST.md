# Vault: Open Tasks

Project overview and stack: [`README.md`](README.md).

Status, accepted constraints, and resolved decisions:
[`docs/production-roadmap.md`](docs/production-roadmap.md).

The completed frontend design-system audit and implementation plan is retained
at [`docs/frontend-design-system.md`](docs/frontend-design-system.md).

## Current state

The app runs on the home server (migrated 2026-10-11; see `docs/self-hosted.md`).
There are no open tasks. New actionable work should be added here in
project-priority order.

Conditional future release gates that do not apply to the current controlled
deployment remain documented in `docs/production-roadmap.md`. In particular,
Yahoo/yfinance market data must be replaced or licensed before any wider
public or commercial release.

## Completion requirements for future tasks

Do not remove a task until it is fully validated.

Every implementation must finish with the relevant focused tests plus:

- broader tests when shared behavior changes;
- frontend lint, unit tests, and build for frontend changes (Playwright when
  a flow changed; it needs a backend, see `frontend/README.md`);
- migration checks for database changes;
- `git diff --check`;
- changed-file line counts;
- diff summary and complete diff review;
- final repository-status review.
