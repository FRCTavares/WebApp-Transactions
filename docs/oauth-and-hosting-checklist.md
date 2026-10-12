# Google Sign-in and Hosting Checklist

Items that live outside the repository and are worth checking when something about sign-in or reachability
breaks. Finance and Fitness sign in through the **same Google OAuth client** (project "Fitness Dashboard Auth").

## Google Cloud Console (OAuth client)

- [ ] **Authorized JavaScript origins** include `https://finance.<tailnet>.ts.net` (and `https://fitness.<tailnet>.ts.net`
      for the other app). A missing origin shows Google's `origin_mismatch` error on the sign-in button.
      The origin must be added to the client the app actually uses (`VITE_GOOGLE_CLIENT_ID`), not to another client.
- [ ] No redirect URIs are needed (the sign-in button returns an ID token to the page, not a redirect).
- [ ] The consent screen's app name, logo and support email are accurate, the privacy policy link is
      `https://finance.<tailnet>.ts.net/privacy`, and the authorized-domains list matches what you use.
- [ ] The project must stay: deleting it breaks sign-in for both apps.

## Home server

- [ ] `finance.env` has `AUTH_MODE=google`, `GOOGLE_CLIENT_ID` (same id as the build), a `SESSION_SECRET` of at least
      32 characters, `ALLOWED_USER_EMAILS`, `ADMIN_USER_EMAILS` and `CORS_ORIGINS=https://finance.<tailnet>.ts.net`.
- [ ] `finance-build.env` has `VITE_API_BASE_URL`, `VITE_AUTH_MODE=google` and the same client id.
- [ ] The Tailscale sidecar is up (the node `finance` shows in the tailnet admin console) and the device you use is on
      the tailnet. Nothing outside the tailnet can reach the app by design.
- [ ] `GET /api/health` through the site reports the expected commit; `GET /api/ready` is OK.

## Common failures

| Symptom | Check |
|---|---|
| `origin_mismatch` on the Google button | authorized JavaScript origins on the client in use |
| Signed out of everything | `SESSION_SECRET` changed, or sessions expired (`SESSION_TTL_HOURS`) |
| "Missing bearer token" on first load | an old build before the first-load fix; update to the latest release |
| Signed in but empty data | `AUTH_USER_ID_MAP` does not pin your email to the id your rows carry |
| Pending screen for yourself | your email is not in `ALLOWED_USER_EMAILS` |
