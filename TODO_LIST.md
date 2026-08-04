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

- [ ] Add a first-run onboarding experience for new users: a short
      sequence of cards/steps that walks them through setting up their
      monthly investment goal, default currency, and categories before
      they land on an empty Dashboard. Needed before inviting outside
      users, since a new account currently has no orientation into the
      app.

## 2. Outstanding verification and product decisions

- [ ] Audit investment holdings and valuations end-to-end. Francisco
      reports current holdings/quantities and position values on the
      Investments page do not look correct after the July Trading 212
      import. Check `_get_holdings_on` and `_get_portfolio_value_on`
      (`backend/app/services/investment_valuation_service.py`) against
      the actual imported events for at least one full account, and
      confirm cost-basis buckets and FX conversion are applied
      per-holding rather than aggregated incorrectly.

- [ ] Investigate why the Dashboard's "Investment performance" figure
      looks wrong (e.g. -€47.67 shown with no investments made that
      month). Note: the requested methodology - portfolio value on
      the 1st of the month vs. value on the last day of the month,
      minus net cash invested in between - is already what
      `get_monthly_change`
      (`backend/app/services/investment_valuation_service.py`)
      computes, so this is not a missing feature. The likely fault is
      in the inputs: verify `_get_valuation_price_on` is finding a
      real historical price for the boundary dates rather than
      falling back to a stale/estimated price (`is_estimated`), and
      verify the FX rate used for non-EUR tickers on those two dates.

- [ ] Wealth trend values before December 2024 are wrong. Francisco
      has the correct historical net-worth figures in a personal
      spreadsheet and can supply them. Decide whether to backfill via
      manual wealth snapshots (the `Account`/`Snapshot` flow already
      used on the Wealth page) or a one-off data migration, then
      correct the stored snapshot rows so the "Wealth trend" chart's
      Sep 2024-Dec 2024 segment reflects real values instead of
      whatever is there now.

## 3. Financial correctness and atomicity

- [ ] Monthly investment goal on the Dashboard does not update after
      importing Trading 212 contributions that exceed the goal (a
      July 2026 import went well over €100, but "Monthly investment
      goal" still showed €0 of €100 / €100.00 remaining). The goal
      figure is driven by `net_invested_cash`, which only counts
      investment events typed `deposit`/`withdrawal` within the month
      (`InvestmentCashflowService.calculate_month`,
      `backend/app/services/investment_cashflow_service.py`). Confirm
      the Trading 212 importer
      (`backend/app/importers/trading212.py`, `_get_event_type`) is
      actually classifying the imported rows as `deposit`, that the
      event dates fall inside the queried month, and that the
      Dashboard refetches the summary after a successful import
      rather than showing a stale cached value.

- [ ] Bitcoin holdings have no working manual-entry path. Trading 212
      does not provide a statement/CSV for Bitcoin, so this position
      needs to be entered and updated by hand, but the edit control
      Francisco sees does nothing when clicked. There is currently a
      manual *price* override (`MarketPricesTable`,
      `frontend/src/components/investments/MarketPricesTable.tsx`)
      but no manual *holdings/quantity* entry for a non-imported
      asset - determine whether the visible button is dead/unwired UI
      or whether it needs a new backend endpoint plus UI to create
      and edit a manual investment position (quantity, cost basis,
      currency) for assets with no importer.

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

- [ ] Wealth trend chart Y-axis ticks are not "nice" round numbers
      (e.g. €7,954.00 / €5,314.00 / €2,675.00 / €35.00). The ticks are
      generated by splitting min/max into even quarters
      (`frontend/src/components/wealth/WealthMonthlyChart.tsx`, around
      lines 142-160) rather than rounding to a sensible step size.
      Replace with a standard "nice numbers" tick algorithm so axis
      labels land on round values appropriate to the data's
      magnitude.

### Phase 7 — Consistency sweep and guardrails

- [ ] "Save Money In"/"Save Money Out" button sits too close to
      (visually overlaps) the "Someone owes me for this" checkbox row
      on the Add Money In/Out form (Transactions page). Add spacing
      between the checkbox row and the action buttons.

- [ ] Settings page layout is visually unbalanced - large empty
      right-hand column under "Organisation", inconsistent card
      widths/heights across the "Access", "Privacy", "Organisation",
      and "Data" panels. Needs a proper grid pass so panels read as a
      coherent settings page rather than mismatched blocks
      (`frontend/src/pages/SettingsPage.tsx`).
