# Privacy and Account Deletion

This policy describes how F - Transactions handles personal data for its controlled personal and invited-user deployment.

## Data collected and purpose

The application stores the authenticated Supabase user identifier and email address together with financial records the user creates or imports. These records can include transactions, categories, rules, owed-money records, investments, wealth accounts and snapshots, import history, and temporary import previews.

The data is processed only to provide the finance-tracking, import, export, recovery, and authentication features requested by the user. The application does not use financial data for advertising and does not currently enable product analytics or behavioral telemetry.

## Processors and hosting

- Supabase provides authentication and the production PostgreSQL database.
- Render hosts the backend API.
- Vercel hosts the static frontend.
- Google provides OAuth authentication when Google sign-in is used.

Provider regions and subprocessors follow the configuration and terms of the deployed projects. The application owner must record the selected hosting regions before inviting public users.

## Retention and backups

Active application data is retained until the user deletes it or the service is retired. Temporary import previews expire according to the application preview policy.

Production backups follow `docs/backups-supabase.md`: seven daily, four weekly, and twelve monthly backups. Account deletion removes active application data and the Supabase sign-in identity immediately. Existing encrypted backups age out under the normal retention schedule and are not selectively rewritten. Deleted data must not be restored into the active service except for a documented legal or security requirement.

## Export

An authenticated user can download a JSON export from **Settings → Export / Backup** before deleting an account. The export contains recoverable user-owned application tables but excludes transient import previews and shared market data.

## Account deletion

An authenticated user can delete the account from **Settings → Delete account**. The user must type the signed-in email address. The backend then:

1. atomically deletes every active user-owned application row, including transient import previews;
2. removes the corresponding Supabase Auth identity;
3. signs the browser out after successful confirmation.

Deletion cannot be undone. If application data is deleted but the external identity removal fails, the API reports this explicitly and directs the user to the privacy support contact.

## Privacy requests and incidents

The deployment owner must configure `VITE_PRIVACY_CONTACT_EMAIL` with a monitored privacy contact address before inviting public users. The Settings page displays that address. Requests to access, correct, export, or delete data should include the signed-in email address but must never include passwords, access tokens, or financial exports in ordinary email.

Privacy incidents follow the incident-response procedure once that procedure is established. Until a monitored contact, hosting-region record, and incident process exist, unrestricted public release remains blocked.
