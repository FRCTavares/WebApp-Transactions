# Authentication and access-control options

## Purpose

This document compares access-control and authentication options for the finance app.

The current priority is not to add real authentication yet. The current priority is to understand the options and avoid choosing too early.

## Comparison

| Option | Best use | Advantages | Disadvantages |
| --- | --- | --- | --- |
| Current local token | Local private use on Mac and same Wi-Fi | Simple, already exists, low complexity | Not real accounts, not user identity, not enough for public access |
| Tailscale or VPN | Personal remote access | Keeps app private, avoids exposing app publicly, good for own devices | Not friendly for family/friends unless they install and understand it |
| Cloudflare Access | Protected remote access without building auth inside the app | Strong access gate, avoids custom auth, useful before full accounts | Adds Cloudflare dependency, still not a full app-level user model |
| Google OAuth | Login using Google accounts | Familiar, avoids password handling, good for users with Google accounts | Google dependency, not everyone wants Google login, still needs user isolation |
| Supabase Auth with email magic links | Family/friends app with simple login | No passwords, good user experience, integrates with Supabase/Postgres | Supabase dependency, email deliverability matters |
| Supabase Auth with OAuth | Family/friends app with social login | Uses managed auth, can support Google and other providers | Supabase plus provider dependency, OAuth setup complexity |
| Custom email/password auth | Full control | No external auth provider dependency | High security burden, password storage risk, reset flows, brute-force protection, session security |
| Passkeys | Modern secure login | Strong security, good long-term direction, no passwords | More implementation complexity, user support issues, provider/library choice matters |

## Recommendation

### Short term

Use the current local token.

It is enough for the current local-first private app, especially on the same Wi-Fi network. It should not be treated as production authentication.

### Remote personal access

Use Tailscale, another VPN, or Cloudflare Access.

This is better than making the app public before it is ready. It gives remote access without immediately building full account management.

### Family/friends public-ish app

Use Supabase Auth with email magic links or OAuth.

This is the most practical route once the backend already has user ownership and isolation tests. Email magic links are simple for non-technical users. OAuth is familiar for users who prefer Google login.

### Avoid for now

Avoid custom password auth.

Building password authentication safely means handling hashing, resets, sessions, rate limiting, brute-force protection, email verification, account recovery, and secure cookies. That is too much burden for this stage.

## Dependency trade-offs

### Google dependency

Google OAuth is convenient and familiar, but it ties login to Google accounts. Some users may not have or want a Google account. The app must still maintain its own internal user records and ownership model.

### Supabase dependency

Supabase can provide Postgres and authentication in one ecosystem. This reduces custom security work and can speed up development. The trade-off is platform dependency.

Using Supabase does not remove the need for clean backend architecture. The backend should still avoid scattering database-specific logic everywhere.

### Custom security burden

Custom auth gives maximum control, but also creates the largest maintenance and security burden.

For a finance app, weak custom auth is worse than using a reputable managed provider.

## Key principle

Do not confuse login with security.

Real security requires:

- authenticated users.
- private records owned by users.
- backend filtering by current user.
- user-isolation tests.
- HTTPS.
- safe sessions.
- backups and privacy controls.
