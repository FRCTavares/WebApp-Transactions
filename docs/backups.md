# Backups and Recovery

Finance's database is a PostgreSQL 17 database (`finance`, role `finance_app`) in the home server's shared
PostgreSQL instance. Backups, retention, off-box copies and restore tests are run by the **HomeServer**
(repository `FRCTavares/HomeServer`), not by this app. This page says what exists and how to get data back.

## What runs

| What | When | Notes |
|---|---|---|
| Database dump (`homeserver-db-backup@f_transactions_db`) | three times a day (02:30, 10:30, 18:30) | `pg_dump` of the `public` schema to the backup SSD (`/srv/storage/backups/postgres/f-transactions`), each with a manifest; the run is only marked verified once both files are in place |
| Retention (`homeserver-backup-prune`) | daily 04:00 | 90 days |
| Secondary copy (`homeserver-secondary-replication`) | every six hours | to the Windows PC |
| Isolated restore test (`homeserver-restore-test@f_transactions_db`) | monthly (the 8th) | restores the latest dump into a throwaway database and checks it against `config/restore-validation/f_transactions_db.json` (19 tables) |

The Control Center's Backups page shows the latest runs and restore tests.

## Your own copy

**Settings → Export / Backup** downloads a JSON export of your own data (transactions, owed items, wealth,
investments, import batches and rules). It is a convenience copy for inspection, not the recovery path.

## Recovery

1. Decide the point to return to and find the dump (and its manifest) in
   `/srv/storage/backups/postgres/f-transactions`.
2. Follow the HomeServer's `docs/recovery/postgres-restore.md` to restore into the `finance` database
   (`pg_restore --clean --if-exists`), with the finance API stopped.
3. Start the stack (`deploy-finance` or `docker compose` in `/srv/compose/finance`) and check
   `GET /api/health` and the app.

Migrations are forward-only: restoring an old dump into a newer release needs the migrate job to run again
(it does on every `deploy-finance`).

## Account deletion and backups

Deleting an account removes its rows immediately. Copies already in backups age out with the 90-day retention
and are not selectively rewritten; a deleted account's data must not be restored into the live database.
