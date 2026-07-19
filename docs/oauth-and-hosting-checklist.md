# OAuth and Hosting Checklist

Part of #33. These items require access to the Google Cloud Console,
Supabase dashboard, and Render/Vercel dashboards — access this assistant
doesn't have. This is a checklist for the project owner to walk through and
confirm; nothing here should be treated as verified until checked off.

## Google OAuth (Google Cloud Console)

- [ ] App branding (name, logo, support email) is accurate and not the
      default placeholder.
- [ ] Authorized JavaScript origins include the exact production frontend
      URL (and any preview URLs you actually use), with no trailing slash.
- [ ] Authorized redirect URIs include the exact Supabase Auth callback URL
      (`https://<project-ref>.supabase.co/auth/v1/callback`) and match
      exactly — no trailing slash mismatches.
- [ ] OAuth consent screen requests only the minimum scopes actually used
      (email, profile) — nothing broader.
- [ ] If the app has moved out of Google's "Testing" publishing status, or
      requests sensitive/restricted scopes, confirm whether Google's
      verification process applies and where that stands.
- [ ] Privacy policy link on the consent screen points to
      [`docs/privacy.md`](privacy.md) (or wherever it's actually published)
      and is accurate.

## Supabase (dashboard)

- [ ] Auth → URL Configuration: Site URL and Redirect URLs match the exact
      production frontend URL(s), no trailing slash mismatches.
- [ ] Auth → Providers → Google: Client ID/Secret match the Google Cloud
      Console OAuth client actually in use.
- [ ] Database size, egress, and connection count are below plan limits —
      check the dashboard's usage page against the free-tier limits noted
      in `docs/production-roadmap.md`.
- [ ] A recent backup exists and its restore has actually been tested (see
      `docs/backups-supabase.md` for the drill cadence) — don't rely on
      Supabase's automatic backups being sufficient without a tested
      restore.

## Render (dashboard)

- [ ] Environment variables match `render.yaml`'s expected keys — nothing
      missing, nothing stale from a previous configuration.
- [ ] `autoDeployTrigger: off` is intentional (see
      `docs/release-and-rollback.md`) — confirm this still reflects how you
      want to deploy.
- [ ] Deploy notifications (email/Slack/webhook) are configured so a failed
      deploy is actually noticed — Render supports this per their deploy
      failure docs.

## Vercel (dashboard)

- [ ] Production domain and any preview domains match what's configured in
      Google/Supabase above.
- [ ] Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
      `VITE_API_BASE_URL`) are set correctly for Production (and Preview, if
      previews are actually used against a real backend).

## Render cold-start / keep-warm policy

Resolved decision (`docs/production-roadmap.md`, decision #6): the app must
work during backend cold starts — cold starts are accepted, not eliminated.
Given that, the recommendation is:

**Keep `.github/workflows/keep-backend-warm.yml` running, but treat it as
monitoring infrastructure first and a warmth-keeping mechanism second.**
It pings health/readiness/frontend every 10 minutes regardless; its
failure is what feeds the incident-detection path in
`docs/incident-response.md`. It does not, and cannot, guarantee uptime on
Render's free tier — see the Upgrade Triggers in
`docs/production-roadmap.md` for when that tradeoff should be revisited.

- [ ] Confirm you're comfortable with this framing, or decide to remove/
      change the workflow if the monitoring value doesn't justify its
      GitHub Actions minutes.
