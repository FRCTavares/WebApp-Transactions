# Privacy and Account Deletion

This policy describes how F - Transactions handles personal data for its controlled personal and invited-user deployment.

## Data collected and purpose

The application stores the authenticated user identifier and email address (from Google sign-in) together with financial records the user creates or imports. These records can include transactions, categories, rules, owed-money records, investments, wealth accounts and snapshots, import history, and temporary import previews.

The data is processed only to provide the finance-tracking, import, export, recovery, and authentication features requested by the user. The application does not use financial data for advertising and does not currently enable product analytics or behavioral telemetry.

## Processors and hosting

- The application and its PostgreSQL database run on the operator's own home server and are reachable only over a
  private network (Tailscale). No cloud host stores the financial data.
- Google provides sign-in: it proves who the person is once, after which the application issues its own session.
- Market prices are fetched from Yahoo Finance's public endpoints from the server (see `docs/production-roadmap.md`,
  decision 13).

Data is stored in Portugal on the operator's hardware.

## Retention and backups

Active application data is retained until the user deletes it or the service is retired. Temporary import previews expire according to the application preview policy.

Backups follow `docs/backups.md`: database dumps three times a day, kept for 90 days, with a copy on a second machine on the same private network. Account deletion removes active application data immediately. Existing backups age out under that retention and are not selectively rewritten. Deleted data must not be restored into the active service except for a documented legal or security requirement.

## Export

An authenticated user can download a JSON export from **Settings → Export / Backup** before deleting an account. The export contains recoverable user-owned application tables but excludes transient import previews and shared market data.

## Account deletion

An authenticated user can delete the account from **Settings → Delete account**. The user must type the signed-in email address. The backend then:

1. atomically deletes every active user-owned application row, including transient import previews;
2. signs the browser out after successful confirmation.

The Google identity itself is not ours to delete: remove the app's access from the Google account if you want that too. Deletion cannot be undone.

## Privacy requests and incidents

`VITE_PRIVACY_CONTACT_EMAIL` is configured (confirmed 2026-07-20:
`francisco.carreira.tavares@gmail.com`, monitored by the deployment owner).
The Settings page displays that address. Requests to access, correct,
export, or delete data should include the signed-in email address but must
never include passwords, access tokens, or financial exports in ordinary
email.

Privacy incidents follow the incident-response procedure in
`docs/incident-response.md`. That document covers detection, triage, and
recovery for outages/data-loss/auth breakage, but does not yet spell out
confidentiality-breach-specific steps (e.g. what to do if user data is
exposed to someone who shouldn't see it, or notification obligations) —
that gap should be closed before a large public user base exists, but does
not block the current small/invited scale.

All three original release gates are now satisfied: a monitored privacy
contact, a recorded hosting location (the operator's own server in Portugal), and an established
incident-response procedure.
