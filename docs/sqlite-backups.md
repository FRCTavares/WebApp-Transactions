# SQLite backups

The local SQLite database lives at:

    backend/data/finance.db

This file contains private personal finance data and must not be committed.

The repository ignores local database files and the backups directory.

## Create a backup

Stop the backend server first with Ctrl+C.

Then run from the repo root:

    ./scripts/backup_sqlite.sh

The script creates a timestamped backup in:

    backups/

Example:

    backups/finance-2026-06-16_10-30-00.db

The script also runs:

    PRAGMA integrity_check;

against the copied backup.

## Restore a backup

Stop the backend server first with Ctrl+C.

Then copy the backup over the active database:

    cp backups/finance-YYYY-MM-DD_HH-MM-SS.db backend/data/finance.db

Restart the backend after restoring.

## Before risky changes

Create a backup before:

- bulk category changes
- legacy imports
- deleting import batches
- deleting many transactions
- schema migration work
- major cleanup sessions

## Security note

Backups contain the same private financial data as the active database. Do not upload them to public services or commit them to git.
