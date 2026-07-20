# Release and Rollback

## How a release happens

1. Work happens on a feature branch, opened as a pull request against `main`.
2. Required CI checks must pass: backend tests, database/recovery checks,
   frontend lint/build/unit tests, dependency audits, repository hygiene.
   The "Frontend e2e" job also runs but is not yet required — see
   `TODO_LIST.md`.
3. Merging to `main` (currently squash merges) is the release trigger:
   - **Frontend (Vercel)**: deploys automatically on push to `main`.
   - **Backend (Render)**: `autoDeployTrigger: off` in `render.yaml` — deploys
     are triggered manually from the Render dashboard, not automatically on
     push. This is deliberate: it gives a manual go/no-go point before a
     backend change reaches production.
4. Add a `CHANGELOG.md` entry under `## Unreleased` in the same PR (see that
   file for the format). When a deployment goes out, rename `## Unreleased`
   to that deployment's date and short commit hash.

## Pre-deploy safety net

`render.yaml`'s `preDeployCommand` runs `alembic upgrade head` before the
new backend instance is promoted. Render's documented behavior: if any
command in the deploy pipeline fails or times out, the entire deploy fails,
no further commands run, and the service keeps running its most recent
successful deploy with zero downtime. That means a broken migration should
never reach production traffic — verified locally in
`backend/tests/test_migration_failure_blocks_deploy.py`, which chains a
deliberately-broken migration onto the real current head and confirms
`alembic upgrade head` exits non-zero.

Render's health-check gating provides the same protection for the running
service itself: `healthCheckPath: /api/ready` in `render.yaml` means a new
instance that can't reach the database is never promoted to receive traffic.

## Rollback

### Backend (Render)

1. Open the Render dashboard for `f-transactions-api`.
2. Find the most recent deploy that was known-good, in the Events/Deploys list.
3. Use Render's "Redeploy" / rollback action on that specific prior deploy.
   Render redeploys the exact commit and configuration that was live at that
   deploy, per its own docs.
4. If the bad change included a forward-only database migration, a
   backend-only rollback is not enough — the old code may not understand the
   new schema. Check whether the migration is backward-compatible before
   rolling back the app alone; if not, follow
   `docs/backups-supabase.md`'s recovery sequence instead.

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

This triggers a normal new deploy of the reverted state through the same
pipeline as any other change (frontend auto-deploys; backend still needs a
manual Render deploy trigger, per the "How a release happens" section above).

## What's actually been tested vs. documented only

- **Tested**: `git revert` + push is a completely standard, low-risk git
  operation; the migration-failure-blocks-deploy behavior is tested (see
  above).
- **Documented, not tested from here**: the Render/Vercel dashboard rollback
  buttons themselves — doing so would affect the live deployment, so this
  procedure is written precisely enough to follow, but hasn't been
  exercised end-to-end against production. Test it once, deliberately
  (e.g. after a real deploy you're comfortable rolling back), and note the
  result here.
