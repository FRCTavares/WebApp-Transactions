# Supabase backup and export notes

This app stores personal finance data. Production readiness requires a clear backup and export path before adding more features.

## What must be backed up

User-scoped application data:

- `transactions`
- `owed_items`
- `owed_payments`
- `owed_payment_allocations`
- `wealth_accounts`
- `wealth_snapshots`
- `investment_events`
- `import_batches`
- `category_rules`
- `cashflow_rules`
- `description_rules`

Global cached market data is not part of the personal export because it can be refreshed.

## In-app JSON export

Authenticated users can export their own data with:

`GET /api/export/json`

The endpoint returns only rows where `user_id` matches the authenticated backend user.

The response shape is:

`{"format_version":1,"user_id":"you@example.com","email":"you@example.com","tables":{...}}`

Decimal values are exported as strings to avoid precision loss. Dates and datetimes are exported as ISO strings.

## Production smoke check

Use `/api/me` first to confirm the backend recognises the authenticated user before relying on an export.

## Manual Supabase backup

At minimum, periodically create a Supabase database backup or SQL dump from the Supabase dashboard or CLI.

Do not store backups in this repository.

Do not commit:

- database dumps
- CSV exports
- JSON exports
- Supabase service-role keys
- database passwords

## Restore policy

Before relying on backups, test one restore into a temporary local or staging database.

A backup is not trustworthy until a restore has been tested.
