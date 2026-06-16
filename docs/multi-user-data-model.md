# Multi-user data model

## Purpose

This document describes the data ownership changes required before the finance app can become a proper secure multi-user app.

Do not add real authentication before the private data model is ready.

## Core principle

Every private record needs ownership.

A user should only be able to access records that belong to them. This must be enforced in the backend, not trusted from the frontend.

## Candidate ownership field

Use:

- `user_id`

This field should identify the owner of each private record.

In the future, `user_id` should come from the authenticated session or request context. The frontend should not be allowed to decide who owns a private record.

## Tables likely needing `user_id`

These tables likely contain private user data and should be scoped to a user:

- `transactions`
- `owed_items`
- `owed_payments`
- `owed_payment_allocations`
- `category_rules`
- `cashflow_rules`
- `description_rules`
- `import_batches`
- `investment_events`
- `wealth_accounts`
- `wealth_snapshots`

These may need a decision depending on whether they are shared market reference data or user-specific cached data:

- `market_prices`
- `market_price_history`

If market prices are global reference data, they may not need `user_id`. If they are tied to a user's chosen instruments, provider, or local cache policy, they may need user scoping or a separate ownership relationship.

## Repository and service changes

Every repository method handling private data should receive the current user context or current `user_id`.

The following operations must filter by current user:

- list
- get
- create
- update
- delete
- import preview
- import commit
- duplicate detection
- summaries
- category/rule matching
- owed item payment allocation
- wealth and investment queries

For private records, never accept `user_id` blindly from the frontend.

The current user should come from:

- a fixed local default user during the next local-readiness phase.
- later, a real auth/session context.

## Router responsibilities

Routers should remain thin.

Routers should:

- handle HTTP details.
- resolve the current user from the request context.
- call services with the current user.
- return schemas.

Routers should not contain ownership logic directly.

## Service responsibilities

Services should:

- enforce business rules.
- pass the current user to repositories.
- ensure imports, summaries, rules, and owed-item logic are user-scoped.

Services should not trust user ownership values from request bodies for private data.

## Repository responsibilities

Repositories should:

- apply `user_id` filters in database queries.
- only return records owned by the current user.
- avoid raw SQL scattered outside repository files.
- keep database access isolated so SQLite can later be replaced with Postgres/Supabase with less rewriting.

## Testing requirements

User-isolation tests are mandatory before real auth.

Tests should create at least two users:

- user A
- user B

The tests should verify:

- user A cannot list user B records.
- user A cannot get user B records by ID.
- user A cannot update user B records.
- user A cannot delete user B records.
- transaction summaries are user-scoped.
- import batches are user-scoped.
- duplicate detection is user-scoped.
- owed items are user-scoped.
- owed payments and allocations are user-scoped.
- category and cashflow rules are user-scoped.
- wealth and investment records are user-scoped.

A passing login flow is not enough. The backend must prove isolation through tests.

## Safe migration strategy

Use a staged migration:

1. Add a fixed local default user concept.
2. Add `user_id` columns to private tables.
3. Backfill existing rows to the default user.
4. Update repositories and services to require current user context.
5. Add user-isolation tests.
6. Only then add real authentication.

## Fixed local default user phase

The next phase should not add Google OAuth, Supabase Auth, or custom accounts.

Instead, it should add a local default user concept, for example:

- a fixed default user ID in backend configuration.
- a small helper that returns the current local user.
- service/repository signatures that are ready to receive a user context.

This makes the code multi-user-ready while keeping the current local workflow simple.

## Future auth phase

When real auth is added later:

- the current user should come from the authenticated request.
- services and repositories should already be user-scoped.
- tests should already prove that records are isolated.
- auth should plug into the existing user context instead of forcing a large rewrite.
