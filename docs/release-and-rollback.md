# Release and Rollback

Releases are manual and deploy only when you run them: **merging to `main` deploys nothing** and there is no
hosted CI. The gate is local.

## Before a release

From the repository root, on the branch, all of these must pass:

```bash
cd backend && python -m pytest -q
cd ../frontend && npx tsc -b && npx eslint . --max-warnings 0 && npx vitest run && npx vite build
```

Add a `CHANGELOG.md` entry under `## Unreleased` in the same change. Merge to `main` (squash).

## Releasing

1. On the Mac, from a clean checkout of the merged `main`:

   ```bash
   git fetch && git checkout --detach origin/main
   deploy/package-release.sh /tmp/fin-relN
   scp -r /tmp/fin-relN/finance-g<sha> homeserver:stage/
   ```

   The package is the exact committed source plus a checksum; its id is `finance-g<short sha>`.
2. On the server (optionally run with `--check` first, which verifies and changes nothing):

   ```bash
   ssh -t homeserver 'sudo ~/stage/deploy-finance --stage ~/stage/finance-g<sha> --i-have-a-fresh-backup'
   ```

   `deploy-finance` (HomeServer repository) verifies the checksum, builds the two images (`backend/Dockerfile`,
   `deploy/web/Dockerfile`), runs the one-shot migrate job (`python -m alembic upgrade head`), then swaps the
   API, web tier and Tailscale sidecar, and finally checks that `GET /api/health` through the web tier reports
   the release's commit.
3. Reload the app. **Settings → Build** shows the running commit.

The script refuses to reuse a release directory, so re-running a release that already succeeded stops with
"release directory already exists": check `sudo docker ps` (the images are tagged with the commit) before
deleting anything.

Take a fresh database backup (see [backups.md](backups.md)) before any release that adds a migration.

## Rollback

- **Images:** if the new release does not report the expected commit, `deploy-finance` restores the previous
  images by itself.
- **Code:** to go back to an older release, package and deploy the older commit the same way (or `git revert`
  the change and release the revert).
- **Database:** migrations are forward-only and are not undone by a rollback. If an old release cannot work with
  the new schema, restore from a backup as described in [backups.md](backups.md); data written after that
  backup is lost.
