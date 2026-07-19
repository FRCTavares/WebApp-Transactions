import { useState, type FormEvent } from 'react'
import type { PresentationPreferences } from '../utils/format'
import { translate } from '../i18n/messages'

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
  preferences: PresentationPreferences
  preferencesError: string | null
  preferencesLoading: boolean
  onSavePreferences: (preferences: PresentationPreferences) => Promise<PresentationPreferences>
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
  preferences,
  preferencesError,
  preferencesLoading,
  onSavePreferences,
  onDeleteAccount,
}: SettingsPageProps) {
  const [draft, setDraft] = useState(preferences)
  const [saveState, setSaveState] = useState<string | null>(null)
  const t = (key: Parameters<typeof translate>[1]) => translate(draft.language, key)
  const [isDeletePanelOpen, setIsDeletePanelOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleSavePreferences(event: FormEvent) {
    event.preventDefault()
    setSaveState(t('saving'))
    try {
      await onSavePreferences(draft)
      setSaveState(t('preferencesSaved'))
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : t('preferencesSaveFailed'))
    }
  }

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
        <p className="eyebrow">{t('settings')}</p>
        <h1>{t('settings')}</h1>
        <p className="page-subtitle">{t('settingsSubtitle')}</p>
      </header>

      <div className="settings-balanced-grid">
        <section className="settings-group settings-group-presentation">
          <header className="settings-group-header"><h2>{t('languageRegion')}</h2></header>
          <form className="settings-preferences-form" onSubmit={handleSavePreferences}>
            <label>{t('language')}<select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value as 'en' | 'pt' })}><option value="en">English</option><option value="pt">Português</option></select></label>
            <label>{t('locale')}<select value={draft.locale} onChange={(event) => setDraft({ ...draft, locale: event.target.value as 'en-GB' | 'pt-PT' })}><option value="en-GB">English (United Kingdom)</option><option value="pt-PT">Português (Portugal)</option></select></label>
            <label>{t('defaultCurrency')}<input value={draft.currency} maxLength={3} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} /></label>
            <label>{t('timeZone')}<select value={draft.time_zone} onChange={(event) => setDraft({ ...draft, time_zone: event.target.value })}><option value="Europe/Lisbon">Europe/Lisbon</option><option value="Atlantic/Azores">Atlantic/Azores</option><option value="UTC">UTC</option></select></label>
            <label>{t('dateFormat')}<select value={draft.date_format} onChange={(event) => setDraft({ ...draft, date_format: event.target.value as PresentationPreferences['date_format'] })}><option value="short">{t('short')}</option><option value="medium">{t('medium')}</option><option value="long">{t('long')}</option></select></label>
            {(preferencesError || saveState) && <p className={preferencesError ? 'error-text' : 'muted'} role="status">{preferencesError ?? saveState}</p>}
            <button type="submit" disabled={preferencesLoading || draft.currency.length !== 3}>{t('savePreferences')}</button>
          </form>
        </section>

        <section className="settings-group settings-group-access">
          <header className="settings-group-header">
            <h2>{t('access')}</h2>
          </header>

          <div className="settings-list-row settings-account-row">
            <span>
              <strong>{isAuthEnabled ? displayName : t('localMode')}</strong>
              <small>
                {isAuthEnabled
                  ? t('signedIn')
                  : t('localDescription')}
              </small>
            </span>

            {isAuthEnabled ? (
              <button type="button" className="danger-button" onClick={() => void onSignOut()}>
                {t('signOut')}
              </button>
            ) : (
              <em>{t('localOnly')}</em>
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
            <h2>{t('organisation')}</h2>
          </header>

          <SettingsAction
            title={t('categories')}
            description={t('categoriesDescription')}
            actionLabel={t('open')}
            onClick={onOpenCategories}
          />
        </section>

        <section className="settings-group">
          <header className="settings-group-header">
            <h2>{t('data')}</h2>
          </header>

          <SettingsAction
            title={t('import')}
            description={t('importDescription')}
            actionLabel={t('open')}
            onClick={onOpenImport}
          />

          <SettingsAction
            title={t('exportBackup')}
            description={t('exportDescription')}
            actionLabel={t('open')}
            onClick={onOpenExport}
          />
        </section>
      </div>
    </section>
  )
}
