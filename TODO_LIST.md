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

- [ ] Decide the fate of the rest of the Investments page's "main-view
      cleanup" (Phase 7, PR #113): `.investments-page
      .investment-breakdown-card, .investment-detailed-positions-card,
      .investment-tools-grid, .compact-filter-panel,
      .investment-events-card { display: none; }`
      (`frontend/src/styles/investments.css`) currently hides Funding
      split, Manual market price, Detailed positions, Filters, and the
      Events list entirely - not just visually decluttered, genuinely
      unreachable. Francisco did not know this section existed until
      debugging the #128 manual-position form (moved out of
      `investment-tools-grid` so it isn't swept up in this rule).
      Confirm whether the rest should stay hidden pending a proper
      redesign, or be restored/redesigned now.

## 3. Financial correctness and atomicity

- [ ] Audit `owed_item_events` for legacy/stale entries that disagree
      with their `OwedItem`'s current `amount_remaining`/`status`.
      The Wealth trend chart's current-month point didn't match the
      Wealth summary card (a real gap, not rounding) because
      `get_monthly_totals` reconstructed "now" by replaying the event
      log instead of reading the authoritative `OwedItem` row, and at
      least one item's event history had drifted from its real state
      - most likely from the original legacy Excel import, which may
      not have created a matching event for every historical
      payment/edit. Fixed the symptom (the current-month point now
      reads the authoritative source directly, same as the summary
      card - see `WealthService.get_monthly_totals`), but the
      specific stale row(s) causing the drift haven't been identified
      or corrected, and historical (non-current) months still rely on
      event replay, so past chart points could carry the same drift.
      Needs direct production DB access to compare every OwedItem
      against its latest event and fix the actual bad row(s).

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
