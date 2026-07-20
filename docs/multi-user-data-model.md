# Multi-User Data Model

## Ownership: how a row belongs to a user

There's no local `users` table — Supabase Auth is the source of truth for
identity. A row's owner is a plain `user_id` string column holding the
Supabase JWT's `sub` claim (a UUID Supabase assigns per account), set by
the service layer from the authenticated request, never from anything the
client sends directly.

User-owned tables (each has a `user_id` column, enforced at the
application/service layer — see "No database-level RLS" below):

`transactions`, `owed_items`, `owed_item_events`, `owed_payments`,
`import_batches`, `import_previews`, `investment_events`,
`investment_funding_months`, `wealth_accounts`, `wealth_snapshots`,
`transaction_categories` (`transaction_category.py`), `cashflow_rules`,
`description_rules`, `user_preferences`.

Every repository method that reads or writes one of these tables takes the
current user's id and filters/sets by it. Cross-user access attempts return
`404`, not `403` — the row simply doesn't exist from that user's
perspective. `backend/tests/test_alembic_upgrade.py` and the app's own
integrity audit check that same-user and orphan constraints hold at the
database level too (foreign keys with deliberate `ondelete` behavior),
as defense in depth beyond the application-layer checks.

## No database-level Row Level Security

Supabase Postgres supports RLS policies; this project doesn't use them.
Ownership is enforced entirely in the FastAPI service layer. The resolved
decision in `docs/production-roadmap.md` is to evaluate RLS as defense in
depth only after the backend's own role/service-account strategy is
settled — not before. This means a bug in the service layer's ownership
checks is not currently caught by a second, independent layer at the
database level.

## Shared data: market prices

`market_prices` and `market_price_history` have **no `user_id` column** —
they're shared, global tables. Every authenticated user reads the same
rows (`GET /api/market-prices`, `.../history`, `.../latest` all use
`get_current_user` with no per-user filtering). Writing or fetching new
data from the market-data provider requires `get_privileged_user`
(`ADMIN_USER_EMAILS`) — see `app/routers/market_prices.py`.

**This doesn't match the recorded decision.** `docs/production-roadmap.md`
records "Should market data be shared, user-specific, or admin-maintained?
→ User-specific" as a resolved decision, but the implementation is
shared reads + admin-maintained writes, not per-user data. This
discrepancy is flagged rather than silently resolved either way — it's a
product decision (whether to actually implement per-user market data, or
correct the recorded decision to match what's built), not a documentation
fix, and is tracked in `TODO_LIST.md`.

## Per-user investment tracking, built on shared prices

Per-user investment data (`investment_events`, `investment_funding_months`)
references shared ticker/ISIN identifiers from `market_prices` without
duplicating price data per user. Each user's holdings, cost basis, and
funding history are their own rows; the price used to value them is looked
up from the shared table by ticker/ISIN, not owned by anyone.

## Admin vs. regular users

`ADMIN_USER_EMAILS` (see `docs/auth-options.md`) grants access to
`get_privileged_user`-gated endpoints — currently just market-data
mutations. It does not grant access to another user's owned data; there's
no "view as" or support-access mechanism. An admin is a regular user with
one extra capability, not a superuser over other accounts.
