# F - Transactions: Open Tasks

Project overview, stack, and free-tier context: [`README.md`](README.md).

Readiness evidence, accepted constraints, and resolved decisions:
[`docs/production-roadmap.md`](docs/production-roadmap.md).

The completed frontend design-system audit and implementation plan is retained
at [`docs/frontend-design-system.md`](docs/frontend-design-system.md).

## Current state

As of the 2026-08-07 repository audit, there are no unresolved, actionable
repository tasks recorded here.

New work belongs in this file only when it is concrete and actionable. Add it
in priority order: security, ownership, financial correctness, atomicity,
backup and recovery, data integrity, CI/deployment reliability,
accessibility, then UI maintainability.

Conditional future release gates that do not apply to the current controlled
deployment remain documented in `docs/production-roadmap.md` rather than being
treated as active implementation work. In particular, Yahoo/yfinance market
data must be replaced or licensed before any wider public or commercial
release.

## Completion requirements for future tasks

Do not remove a task until it is fully validated.

Every implementation must finish with the relevant focused tests plus:

- broader tests when shared behavior changes;
- frontend lint, CSS lint, unit tests, relevant Playwright tests, and build
  for frontend changes;
- migration checks for database changes;
- `git diff --check`;
- changed-file line counts;
- diff summary and complete diff review;
- final repository-status review.
