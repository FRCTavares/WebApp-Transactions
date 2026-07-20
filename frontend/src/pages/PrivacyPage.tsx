const PRIVACY_CONTACT =
  import.meta.env.VITE_PRIVACY_CONTACT_EMAIL ?? 'the deployment owner'

/**
 * Public, unauthenticated privacy policy page. Mirrors docs/privacy.md in
 * the repository. Reachable at /privacy without signing in, since Google's
 * OAuth consent screen (and general good practice) requires a privacy
 * policy link the public can actually open.
 *
 * Keep this in sync with docs/privacy.md by hand -- there is no build step
 * that renders one from the other.
 */
export function PrivacyPage() {
  return (
    <div className="privacy-page">
      <div className="privacy-page-card">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy and Account Deletion</h1>
        <p>
          This policy describes how F - Transactions handles personal data
          for its controlled personal and invited-user deployment.
        </p>

        <h2>Data collected and purpose</h2>
        <p>
          The application stores the authenticated Supabase user identifier
          and email address together with financial records the user
          creates or imports. These records can include transactions,
          categories, rules, owed-money records, investments, wealth
          accounts and snapshots, import history, and temporary import
          previews.
        </p>
        <p>
          The data is processed only to provide the finance-tracking,
          import, export, recovery, and authentication features requested
          by the user. The application does not use financial data for
          advertising and does not currently enable product analytics or
          behavioral telemetry.
        </p>

        <h2>Processors and hosting</h2>
        <ul>
          <li>Supabase provides authentication and the production database (hosted in the EU).</li>
          <li>Render hosts the backend API (hosted in the EU).</li>
          <li>Vercel hosts the static frontend (global edge network).</li>
          <li>Google provides OAuth authentication when Google sign-in is used.</li>
        </ul>

        <h2>Retention and backups</h2>
        <p>
          Active application data is retained until the user deletes it or
          the service is retired. Temporary import previews expire
          automatically. Production backups are retained on a rolling daily,
          weekly, and monthly schedule. Account deletion removes active
          application data and the sign-in identity immediately; existing
          encrypted backups age out under the normal retention schedule and
          are not selectively rewritten.
        </p>

        <h2>Export</h2>
        <p>
          A signed-in user can download a JSON export of their data from
          Settings before deleting an account. The export contains
          recoverable user-owned data but excludes transient import previews
          and shared market data.
        </p>

        <h2>Account deletion</h2>
        <p>
          A signed-in user can delete their account from Settings by typing
          their signed-in email address to confirm. The backend then
          atomically deletes every active user-owned record (including
          transient import previews), removes the corresponding sign-in
          identity, and signs the browser out. Deletion cannot be undone.
        </p>

        <h2>Privacy requests and incidents</h2>
        <p>
          For requests to access, correct, export, or delete your data,
          contact <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>{' '}
          from the email address associated with your account. Please never
          include passwords, access tokens, or financial exports in an
          ordinary email.
        </p>
      </div>
    </div>
  )
}
