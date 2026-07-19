# Release and Rollback

## Releasing

- **Backend (Render)**: `autoDeployTrigger: off` in `render.yaml` — merging
  to `main` does **not** auto-deploy. Trigger a deploy manually from the
  Render Dashboard (or `render deploys create` via the Render CLI).
  `preDeployCommand: alembic upgrade head` runs before the new instance
  starts. **Verified** (`backend/tests/test_migration_failure_blocks_deploy.py`):
  if that command exits non-zero, Render's documented behavior is that the
  entire deploy fails, no further steps run, and the service keeps running
  its most recent successful deploy with zero downtime — a bad migration
  cannot take the backend down.
- **Frontend (Vercel)**: deploys automatically on push/merge to `main`.
  Vercel's build is immutable and gated: if the build fails, it's never
  promoted to production and the previous deployment keeps serving traffic.

## Rolling back

### Backend (Render)

Two options, in order of preference:
1. **Render Dashboard → Deploys → pick a previous successful deploy → Rollback.**
   Redeploys that exact commit and configuration.
2. **Git-level:** `git revert` the offending commit(s) on `main`, push, then
   manually trigger a new Render deploy (per `autoDeployTrigger: off`
   above). Preferred when the previous deploy's *database schema* is no
   longer compatible with a further rollback (Alembic migrations are
   forward-only in this project — there's no automated downgrade-on-rollback
   step).

### Frontend (Vercel)

**Vercel Dashboard → Deployments → find the last good deployment → Instant
Rollback** (or `vercel rollback <deployment-url>` via CLI). This is a
routing-layer change, takes effect in seconds, and does **not** rebuild.
Note: this only works for a deployment that previously served production
traffic, and on the Hobby plan you can only roll back to the *immediately
previous* production deployment — if you need to go back further, promote
deployments one step at a time, or upgrade (see the upgrade triggers in
`docs/production-roadmap.md`).

After an Instant Rollback, Vercel stops auto-promoting new pushes to
production until you explicitly promote a deployment again — don't forget
to do that once the underlying issue is fixed and merged.

### Database

Rolling back code does not roll back data. If a bad deploy already wrote
bad data, fix the data separately — see `docs/backups-supabase.md` for the
backup/restore procedure. Restoring a full backup is a last resort, not
a first response.

## What's actually been tested here

- `backend/tests/test_migration_failure_blocks_deploy.py` proves an
  unresolvable database migration state causes `alembic upgrade head` to
  exit non-zero, which is the exact command Render's `preDeployCommand`
  runs — confirming a bad migration blocks the deploy rather than
  half-applying.
- The CI "Database and recovery" job proves the happy path: a clean
  database reaches a single Alembic head successfully on every push.
- What's **not** been tested end-to-end (would require actually deploying
  to Render/Vercel, which this repo's automation doesn't do): triggering a
  real rollback via either dashboard. Treat the dashboard steps above as
  documented procedure, not as something verified by an automated test.
