# Backup and Recovery Policy

This document defines the current backup and recovery objectives for F - Transactions.

The application is currently operated on free-tier infrastructure for controlled personal or invited use. These objectives are operational targets, not contractual availability guarantees.

## Recovery objectives

| Objective | Target |
|---|---:|
| Recovery point objective (RPO) | 24 hours |
| Recovery time objective (RTO) | 4 hours during owner availability |
| PostgreSQL restore drill | Quarterly |
| JSON export restore drill | Monthly |
| Local SQLite backup drill | Monthly |

An RPO of 24 hours means that a severe incident may lose changes made since the most recent successful backup.

An RTO of 4 hours means the owner aims to restore service within four hours after beginning recovery work. Free-tier provider outages, owner unavailability, or external service failures may extend this time.

## Backup coverage

### Production PostgreSQL

Production data is stored in Supabase Postgres.

Create a custom-format PostgreSQL dump using `pg_dump`. A valid production backup must include:

- all application tables,
- the Alembic version table,
- schema definitions,
- constraints and indexes,
- table data,
- a SHA-256 checksum,
- the backup timestamp and source environment.

Validate each dump with `pg_restore --list` before considering it successful.

### User JSON exports

The authenticated JSON export is a second recovery path for user-owned application data.

A valid JSON recovery drill must:

1. validate the export format,
2. restore into a clean temporary SQLite database,
3. compare every exported and restored table count,
4. run the complete integrity audit,
5. verify important relationships.

JSON exports do not replace full PostgreSQL backups because they exclude transient import previews and shared market data.

### Local SQLite

Use `scripts/backup_sqlite.sh`.

The script uses Python SQLite’s online backup API instead of copying the database file directly. This produces a transactionally consistent backup even when the source database uses WAL mode.

The script must run `PRAGMA integrity_check` against the completed backup before reporting success.

## Schedule

### Daily

The owner creates or confirms a production PostgreSQL backup at least once every 24 hours while the application contains active financial data.

### Monthly

The owner performs both of these drills:

- create a local SQLite backup and verify it opens successfully,
- download a current JSON export and restore it into clean SQLite.

### Quarterly

The owner performs a complete production PostgreSQL restore drill:

1. create a fresh custom-format dump,
2. verify its checksum and archive structure,
3. restore it into an isolated clean PostgreSQL database,
4. verify the Alembic revision,
5. compare every application-table row count,
6. run integrity checks,
7. record the date, result, backup checksum, restored revision, and counts outside the repository.

A restore drill also runs after a major schema or recovery-tool change.

## Retention

Keep successful production PostgreSQL backups using this minimum schedule:

- seven daily backups,
- four weekly backups,
- twelve monthly backups.

Keep at least the two most recent successful JSON exports.

Delete expired backups securely after confirming that newer valid backups and restore evidence exist.

Account deletion removes active application data immediately. Existing encrypted backups are not selectively rewritten and expire under this retention schedule: seven daily, four weekly, and twelve monthly backups. Deleted data must not be restored into the active service except for a documented legal or security requirement. See `docs/privacy.md`.

## Encryption and secret handling

Backups contain private financial data.

Requirements:

- encrypt backup files before placing them in off-device storage,
- use an established encrypted container or encrypted storage provider,
- keep encryption keys and database credentials separate from backup files,
- never commit backups, exports, checksums containing private paths, passwords, tokens, or database URLs,
- never place production credentials in shell history, documentation, or repository files,
- restrict access to the application owner.

The repository ignores `backups/`, database files, spreadsheets, PDFs, and environment files. This does not replace encryption.

## Off-device storage

At least one current production backup must be stored outside:

- the Supabase project,
- the Render service,
- the development Mac,
- the Git repository.

The off-device copy must be encrypted and accessible to the recovery owner.

A backup stored only on the same machine or provider as the source is not sufficient.

## Recovery ownership

The application owner is responsible for:

- creating backups,
- checking backup command results,
- protecting encryption keys,
- maintaining off-device copies,
- performing restore drills,
- recording drill evidence,
- deciding when to initiate recovery,
- confirming application behavior after restoration.

No backup is considered operationally valid until it has passed the relevant restore drill.

## Recovery sequence

For a production incident:

1. stop writes or place the application in maintenance mode,
2. identify the most recent validated backup,
3. preserve the damaged environment for investigation,
4. restore into an isolated clean database,
5. verify checksum, schema revision, table counts, constraints, and integrity,
6. update application configuration only after validation succeeds,
7. run authenticated smoke tests,
8. document the incident, data-loss window, restore duration, and follow-up actions.

Do not restore directly over the only production database.

## Existing evidence

The repository audit records that:

- a production PostgreSQL custom-format dump passed checksum and archive validation,
- the dump restored into an isolated PostgreSQL database,
- all application-table row counts matched,
- the restored Alembic revision was `c4d2e6f8a130`,
- generated JSON exports restored into clean SQLite with matching counts and relationship verification.

Detailed production restore evidence remains outside the repository because it may contain private operational information.
