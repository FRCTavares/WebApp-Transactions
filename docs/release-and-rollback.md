# Release and Rollback

## How a release happens

1. Work happens on a feature branch, opened as a pull request against `main`.
2. Required CI checks must pass: backend tests, database/recovery checks,
   frontend lint/build/unit tests, all four Playwright e2e shards, dependency
   audits, and repository hygiene.
3. Merging to `main` (currently squash merges) is the frontend release
   trigger:
   - **Frontend (Vercel)**: deploys automatically on push to `main`.
   - **Backend (Cloud Run)**: production deployment remains manual. For a
     schema-changing release, the migration Job gate below must succeed before
     `webapp-transactions-backend` is deployed from the release source. This
     preserves an explicit human go/no-go point before backend code reaches
     production.
4. Add a `CHANGELOG.md` entry under `## Unreleased` in the same PR (see that
   file for the format). When a deployment goes out, rename `## Unreleased`
   to that deployment's date and short commit hash.

## Pre-deploy safety net

Cloud Run does not provide the old Render `preDeployCommand` hook. The
production safety gate is therefore explicit:

1. If a release changes `backend/migrations/`, rebuild
   `f-transactions-migrate` from that same release's `./backend` source.
2. Verify the Job runs `/cnb/lifecycle/launcher -- python -m alembic upgrade
   head`, uses the production `DATABASE_URL` secret reference, and has
   `maxRetries=0`. The launcher supplies the buildpack runtime environment;
   invoking `alembic` or `python` directly failed before application startup
   during the 2026-09-23 release.
3. Execute the Job with `--wait`.
4. Confirm the execution succeeded and production `alembic_version` equals the
   repository Alembic head.
5. Only then deploy `webapp-transactions-backend`.

A migration failure must stop this sequence before service deployment. The
repository test in `backend/tests/test_migration_failure.py`
proves the part controlled by the application: a deliberately broken
migration makes `alembic upgrade head` exit non-zero. It does **not** prove
that Cloud Run automatically blocks deployment; the operator enforces that
gate by following the sequence above.

After deployment, `scripts/smoke_production.sh`, `/api/ready`, and Cloud Run
logs are the production verification checks.

## Rollback

### Backend (Cloud Run)

1. List revisions for `webapp-transactions-backend` in `europe-west1` and
   identify the most recent known-good revision.
2. Move 100% of service traffic back to that revision using Cloud Run traffic
   management.
3. Run the production smoke checks and verify `/api/ready`.
4. If the bad release included a forward-only database migration, an
   application-only rollback may be unsafe because the old code may not
   understand the new schema. Check migration compatibility first; if the
   schema itself must be recovered, follow `docs/backups-supabase.md` instead.

Example revision commands:

```bash
gcloud run revisions list \
  --service=webapp-transactions-backend \
  --region=europe-west1

gcloud run services update-traffic webapp-transactions-backend \
  --region=europe-west1 \
  --to-revisions=<known-good-revision>=100
```

### Frontend (Vercel)

1. Open the Vercel dashboard for the project.
2. Find the previous production deployment in the Deployments list.
3. Promote it to production ("Instant Rollback" in Vercel's UI redirects
   production traffic to that build immediately, without a rebuild).

### Git-level revert (either side, or both)

For a bad change that hasn't been redeployed away yet, or to remove it from
history going forward:

```bash
git revert <bad-commit-sha>
git push origin main
```

This triggers the normal frontend deployment. The reverted backend still
requires the manual Cloud Run release sequence described above; schema-changing
reverts require the same migration-compatibility review.

## What's actually been tested vs. documented only

- **Tested**: a broken Alembic migration exits non-zero; the production
  migration Job has `maxRetries=0`; execution `f-transactions-migrate-78bp8`
  succeeded on 2026-09-23, and a read-only `alembic current -v` execution
  (`f-transactions-migrate-kk2vs`) confirmed production revision
  `6f2b4c8d1a93`. Backend revision
  `webapp-transactions-backend-00010-2dl` passed the repository production
  smoke script and `/api/ready` after deployment.
- **Documented, not yet deliberately exercised end-to-end**: rolling Cloud Run
  traffic back to an older revision. Because that changes live production,
  exercise it only during a controlled deployment and record the result here.
