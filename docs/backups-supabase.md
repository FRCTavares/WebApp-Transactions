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

Production data is stored in Supabase Postgres. **Supabase's Free plan does
not include any built-in scheduled backups** (confirmed 2026-07-20 via the
dashboard's Database → Backups page) — everything below is this project's
own, fully independent backup mechanism; it does not build on top of
anything Supabase provides automatically.

**Automated since 2026-07-20**:
`.github/workflows/backup-database.yml` runs this daily on a schedule (plus
`workflow_dispatch` for on-demand runs) so it no longer depends on the
owner remembering to run it manually. It dumps, validates, checksums,
encrypts, and uploads the result as a GitHub Actions artifact. A failed run
surfaces through the same GitHub Actions notification settings covered in
`docs/oauth-and-hosting-checklist.md` (failed-workflows-only).

Required repository secrets (set via `gh secret set <NAME>` or GitHub →
Settings → Secrets and variables → Actions):

- `BACKUP_DATABASE_URL`: a direct (non-pooled) Postgres connection string
  for the production Supabase database, with a role that can read all
  tables. Keep this separate from the backend's own `DATABASE_URL` secret
  on Render — same database, but this one only needs read access.
- `BACKUP_ENCRYPTION_PASSPHRASE`: a long, random passphrase used to encrypt
  the dump with GPG symmetric (AES-256) encryption before upload. Store
  this passphrase itself somewhere durable and separate from the repository
  (e.g. a password manager) — losing it makes every backup unrecoverable.

**Known retention gap**: GitHub Actions artifacts expire after a maximum of
90 days, so this mechanism alone cannot literally satisfy the "twelve
monthly backups" target below — anything older than ~90 days is gone
unless manually archived elsewhere first. It fully covers the seven-daily
and four-weekly tiers. Revisit if the twelve-month tier actually matters in
practice (e.g. by periodically downloading an artifact to a second,
independent encrypted location before it expires, or moving to genuine
off-device object storage).

A valid production backup must include:

- all application tables,
- the Alembic version table,
- schema definitions,
- constraints and indexes,
- table data,
- a SHA-256 checksum,
- the backup timestamp and source environment.

Validate each dump with `pg_restore --list` before considering it successful
— the workflow does this automatically; do the same by hand for any manual
dump.

To create one manually (e.g. before a risky migration, or on demand rather
than waiting for the schedule), either trigger
`.github/workflows/backup-database.yml` via `workflow_dispatch`
(`gh workflow run backup-database.yml`), or run the equivalent locally:

```
pg_dump --format=custom --no-owner --no-privileges \
  --dbname="$BACKUP_DATABASE_URL" --file=backup.dump
pg_restore --list backup.dump > /dev/null && echo "valid"
sha256sum backup.dump > backup.dump.sha256
gpg --symmetric --cipher-algo AES256 --output backup.dump.gpg backup.dump
rm backup.dump
```

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

Automated: `.github/workflows/backup-database.yml` runs daily. The owner
should still glance at the Actions tab occasionally (a failed run also
triggers the account's GitHub Actions failure notification), and confirm at
least once a month that recent artifacts are actually restorable, not just
present — an automated dump that silently produces a corrupt file is worse
than no automation, because it creates false confidence.

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

**As of 2026-07-20, the automated GitHub Actions workflow only satisfies the
first two tiers** — GitHub Actions artifacts expire after a maximum of 90
days, so nothing survives to fill the twelve-month tier without a separate,
manual step to archive an artifact somewhere longer-lived before it expires.
This is a known, accepted gap for now given the project's scale — revisit
if that changes.

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

**GitHub Actions artifacts satisfy this today** — they're outside Supabase,
Render, and the development Mac. They are, however, hosted by the same
provider (GitHub) as the source code itself, which is not full independence
in the strictest sense: a GitHub account-level incident (not just a repo or
Actions issue) could plausibly affect both at once. Accepted tradeoff for
now given the project's scale; a genuinely independent provider (e.g. an
S3-compatible bucket) would close this residual gap if it ever matters.

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
