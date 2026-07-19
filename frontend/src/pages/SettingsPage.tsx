import { useState } from 'react'

const PRIVACY_CONTACT =
  import.meta.env.VITE_PRIVACY_CONTACT_EMAIL ?? 'the deployment owner'

type SettingsPageProps = {
  isAuthEnabled: boolean
  displayName: string
  accountEmail: string
  onOpenImport: () => void
  onOpenExport: () => void
  onOpenCategories: () => void
  onSignOut: () => void | Promise<void>
  onDeleteAccount: (confirmation: string) => Promise<void>
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
  accountEmail,
  onOpenImport,
  onOpenExport,
  onOpenCategories,
  onSignOut,
  onDeleteAccount,
}: SettingsPageProps) {
  const [isDeletePanelOpen, setIsDeletePanelOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDeleteAccount() {
    setDeleteError(null)
    setIsDeleting(true)

    try {
      await onDeleteAccount(deleteConfirmation)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Account deletion failed.')
      setIsDeleting(false)
    }
  }

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

          {isAuthEnabled && (
            <>
              <button
                type="button"
                className="settings-list-row settings-list-button settings-delete-trigger"
                onClick={() => setIsDeletePanelOpen((isOpen) => !isOpen)}
                aria-expanded={isDeletePanelOpen}
                aria-controls="account-deletion-panel"
              >
                <span>
                  <strong>Delete account</strong>
                  <small>Permanently remove your financial data and sign-in identity.</small>
                </span>
                <em>{isDeletePanelOpen ? 'Cancel' : 'Delete'}</em>
              </button>

              {isDeletePanelOpen && (
                <div id="account-deletion-panel" className="settings-delete-panel">
                  <strong>This cannot be undone.</strong>
                  <p>
                    Download an export first if you need a copy. Type your signed-in email,
                    <b> {accountEmail}</b>, to confirm permanent deletion.
                  </p>
                  <label>
                    Confirmation email
                    <input
                      type="email"
                      autoComplete="off"
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      disabled={isDeleting}
                    />
                  </label>
                  {deleteError && <p className="status status-error" role="alert">{deleteError}</p>}
                  <button
                    type="button"
                    className="danger-button"
                    disabled={
                      isDeleting ||
                      deleteConfirmation.trim().toLowerCase() !== accountEmail.toLowerCase()
                    }
                    onClick={() => void handleDeleteAccount()}
                  >
                    {isDeleting ? 'Deleting account…' : 'Permanently delete account'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="settings-group">
          <header className="settings-group-header">
            <h2>Privacy</h2>
          </header>
          <div className="settings-list-row settings-privacy-summary">
            <span>
              <strong>Your financial data</strong>
              <small>
                Used only to provide the finance tracker. No advertising or analytics telemetry
                is enabled. Exports and account deletion are available from Settings. Contact{' '}
                {PRIVACY_CONTACT} for privacy requests.
              </small>
            </span>
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
