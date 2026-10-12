# Incident Response

How outages, bad releases and auth problems are handled for Vault. For getting data back see
[backups.md](backups.md). This is a personal/small-group project with one owner, so the process is deliberately
light: a repeatable checklist, not an on-call rotation.

## Detection

- **Control Center** (HomeServer): the Applications page shows Vault' components (API, web, database)
  and version, and its alerts report failing health checks.
- **Manual**: you notice broken behaviour, or someone using the app tells you.

There is no hosted monitoring; the app is only reachable on the tailnet.

## Severity

| Level | Definition | Example |
|---|---|---|
| SEV1 | Data loss/corruption, or the app is unusable for everyone | restore needed; sign-in completely broken |
| SEV2 | A core workflow is broken | import or export failing; a page crashes |
| SEV3 | Degraded but workable | slow responses; a cosmetic bug |

## Triage

1. Confirm it is real: `GET /api/health` and `GET /api/ready` through the site, from a tailnet device.
2. Classify the severity.
3. Look at the containers' logs on the server (`sudo docker logs finance-api-1`, the web tier and the sidecar) and at
   what was released last (`sudo docker ps` shows the commit tag): many incidents follow a release.
4. Choose the path:
   - **Bad release**: [release-and-rollback.md](release-and-rollback.md).
   - **Data loss or corruption**: [backups.md](backups.md).
   - **Everyone signed out / cannot sign in**: the checklist in [oauth-and-hosting-checklist.md](oauth-and-hosting-checklist.md)
     (OAuth origins and `SESSION_SECRET` are the usual causes).
   - **Cannot reach the site at all**: is the device on the tailnet, is the `finance` Tailscale node up, is the server
     itself up (Control Center).

## Communication

If someone else is affected, tell them directly what is broken and when you expect it back, and confirm when it is fixed.

## Post-incident

For a SEV1 or SEV2, write a short note (what happened, how it was found, what fixed it, one follow-up) and link it from
`CHANGELOG.md` if it led to a code change.
