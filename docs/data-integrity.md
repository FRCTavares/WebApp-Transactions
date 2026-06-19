# Data integrity audit

Before adding database-level constraints, run the read-only integrity audit.

The script checks for invalid existing rows without mutating the database.

## Local run

From `backend`:

`DATABASE_URL=sqlite:///data/finance.db .venv/bin/python scripts/audit_data_integrity.py`

For JSON output:

`DATABASE_URL=sqlite:///data/finance.db .venv/bin/python scripts/audit_data_integrity.py --json`

## Production run

Use the production `DATABASE_URL` in the environment, then run:

`.venv/bin/python scripts/audit_data_integrity.py`

The script prints only check names and violation counts. It does not print personal transaction rows.

## Current checks

- positive transaction amounts
- known transaction directions
- known cashflow types
- valid currency code lengths
- valid owed item amounts and status
- owed item balance consistency
- positive owed payment and allocation amounts
- owed allocation references to existing payments and items
- positive investment event amounts
- valid investment event currency code lengths
- valid wealth snapshot balances and FX rates
- wealth snapshot references to existing accounts
- import batch counter consistency

## Constraint policy

Do not add database constraints until this audit passes on production data.

If any check fails, fix or migrate the data first.
