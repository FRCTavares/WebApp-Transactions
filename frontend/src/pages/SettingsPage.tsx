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
    <button type="button" className="settings-list-row settings-list-button" onClick={onClick}>
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
    <section className="settings-page settings-page-redesigned">
      <header className="settings-hero">
        <p className="eyebrow">Settings</p>
        <h1>Settings</h1>
        <p className="page-subtitle">
          Manage data tools, rules, and access mode.
        </p>
      </header>

      <div className="settings-balanced-grid">
        <section className="settings-group settings-group-access">
          <header className="settings-group-header">
            <h2>Access</h2>
          </header>

          <div className="settings-list-row settings-account-row">
            <span>
              <strong>{isAuthEnabled ? displayName : 'Local mode'}</strong>
              <small>
                {isAuthEnabled
                  ? 'Signed in with account access enabled.'
                  : 'No account controls are active on this local setup.'}
              </small>
            </span>

            {isAuthEnabled ? (
              <button type="button" className="danger-button" onClick={() => void onSignOut()}>
                Sign out
              </button>
            ) : (
              <em>Local only</em>
            )}
          </div>
        </section>

        <section className="settings-group">
          <header className="settings-group-header">
            <h2>Organisation</h2>
          </header>

          <SettingsAction
            title="Categories"
            description="Choose the categories available in transactions."
            actionLabel="Open"
            onClick={onOpenCategories}
          />
        </section>

        <section className="settings-group">
          <header className="settings-group-header">
            <h2>Data</h2>
          </header>

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
        </section>
      </div>
    </section>
  )
}
