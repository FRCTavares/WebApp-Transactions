type SettingsPageProps = {
  isAuthEnabled: boolean
  displayName: string
  onOpenImport: () => void
  onOpenExport: () => void
  onOpenCategories: () => void
  onSignOut: () => void | Promise<void>
}

type SettingsActionProps = {
  title: string
  description: string
  actionLabel: string
  onClick: () => void
}

function SettingsAction({
  title,
  description,
  actionLabel,
  onClick,
}: SettingsActionProps) {
  return (
    <button type="button" className="settings-action-button" onClick={onClick}>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <em>{actionLabel}</em>
    </button>
  )
}

export function SettingsPage({
  isAuthEnabled,
  displayName,
  onOpenImport,
  onOpenExport,
  onOpenCategories,
  onSignOut,
}: SettingsPageProps) {
  return (
    <section className="settings-page">
      <header className="page-header settings-page-header">
        <div>
          <p className="eyebrow">Tools</p>
          <h1>Settings</h1>
          <p className="page-subtitle">
            Keep configuration and admin actions out of the main navigation.
          </p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-header">
            <p className="eyebrow">Organisation</p>
            <h2>Rules</h2>
            <p>Manage categorisation behaviour.</p>
          </div>

          <div className="settings-action-list">
            <SettingsAction
              title="Categories / Rules"
              description="Manage category, description, and cashflow rules."
              actionLabel="Open"
              onClick={onOpenCategories}
            />
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <p className="eyebrow">Data</p>
            <h2>Import and backup</h2>
            <p>Bring records in and export local data when needed.</p>
          </div>

          <div className="settings-action-list">
            <SettingsAction
              title="Import"
              description="Preview CSV/XLSX files before committing rows."
              actionLabel="Open"
              onClick={onOpenImport}
            />
            <SettingsAction
              title="Export / Backup"
              description="Export records for backup or manual inspection."
              actionLabel="Open"
              onClick={onOpenExport}
            />
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <p className="eyebrow">Account</p>
            <h2>Access mode</h2>
            <p>
              {isAuthEnabled
                ? `Signed in as ${displayName}.`
                : 'Running in local mode. No account controls are active.'}
            </p>
          </div>

          <div className="settings-status">
            <span>{isAuthEnabled ? 'Signed in' : 'Local mode'}</span>
            {isAuthEnabled && (
              <button type="button" className="danger-button" onClick={() => void onSignOut()}>
                Sign out
              </button>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
