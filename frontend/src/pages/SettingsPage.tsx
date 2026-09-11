import { useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  ChevronRight,
  Download,
  FolderCog,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
} from 'lucide-react'
import type { PresentationPreferences } from '../utils/format'
import { translate } from '../i18n/messages'
import { AccessRequestsPanel } from '../components/AccessRequestsPanel'
import { Button, Card, Field, Icon, PageHeader, type IconComponent } from '../components/ui'

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
  icon: IconComponent
  title: string
  description: string
  onClick: () => void
}

function SettingsAction({ icon, title, description, onClick }: SettingsActionProps) {
  return (
    <button type="button" className="settings-list-row settings-list-button" onClick={onClick}>
      <span className="settings-row-avatar" aria-hidden="true">
        <Icon icon={icon} size={16} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <Icon icon={ChevronRight} size={16} className="settings-row-chevron" aria-hidden="true" />
    </button>
  )
}

function SettingsCardHeading({
  icon,
  tone = 'default',
  title,
  description,
}: {
  icon: IconComponent
  tone?: 'default' | 'danger'
  title: string
  description: string
}) {
  return (
    <header className="settings-card-heading">
      <span
        className={`settings-icon-badge${tone === 'danger' ? ' settings-icon-badge-danger' : ''}`}
        aria-hidden="true"
      >
        <Icon icon={icon} size={20} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
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
  const investmentGoalValue = Number(draft.monthly_investment_goal_eur)
  const investmentGoalError =
    draft.monthly_investment_goal_eur.trim() === ''
    || !Number.isFinite(investmentGoalValue)
    || investmentGoalValue <= 0
      ? t('investmentGoalInvalid')
      : null

  async function handleSavePreferences(event: FormEvent) {
    event.preventDefault()

    if (investmentGoalError) {
      setSaveState(null)
      return
    }

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
    <section className="settings-page-redesigned">
      <PageHeader
        eyebrow={t('settings')}
        title={t('settings')}
        description={t('settingsSubtitle')}
      />

      <Card as="section" padding="lg" className="settings-card settings-card-preferences">
        <SettingsCardHeading
          icon={SlidersHorizontal}
          title={t('preferences')}
          description={t('preferencesDescription')}
        />

        <form className="settings-preferences-form" onSubmit={handleSavePreferences}>
          <Field label={t('language')}>
            {(controlProps) => (
              <select
                {...controlProps}
                value={draft.language}
                onChange={(event) =>
                  setDraft({ ...draft, language: event.target.value as 'en' | 'pt' })
                }
              >
                <option value="en">English</option>
                <option value="pt">Português</option>
              </select>
            )}
          </Field>

          <Field label={t('locale')}>
            {(controlProps) => (
              <select
                {...controlProps}
                value={draft.locale}
                onChange={(event) =>
                  setDraft({ ...draft, locale: event.target.value as 'en-GB' | 'pt-PT' })
                }
              >
                <option value="en-GB">English (United Kingdom)</option>
                <option value="pt-PT">Português (Portugal)</option>
              </select>
            )}
          </Field>

          <Field label={t('defaultCurrency')}>
            {(controlProps) => (
              <input
                {...controlProps}
                value={draft.currency}
                maxLength={3}
                onChange={(event) =>
                  setDraft({ ...draft, currency: event.target.value.toUpperCase() })
                }
              />
            )}
          </Field>

          <Field label={t('timeZone')}>
            {(controlProps) => (
              <select
                {...controlProps}
                value={draft.time_zone}
                onChange={(event) => setDraft({ ...draft, time_zone: event.target.value })}
              >
                <option value="Europe/Lisbon">Europe/Lisbon</option>
                <option value="Atlantic/Azores">Atlantic/Azores</option>
                <option value="UTC">UTC</option>
              </select>
            )}
          </Field>

          <Field label={t('dateFormat')}>
            {(controlProps) => (
              <select
                {...controlProps}
                value={draft.date_format}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    date_format: event.target.value as PresentationPreferences['date_format'],
                  })
                }
              >
                <option value="short">{t('short')}</option>
                <option value="medium">{t('medium')}</option>
                <option value="long">{t('long')}</option>
              </select>
            )}
          </Field>

          <Field
            label={t('monthlyInvestmentGoal')}
            hint={t('monthlyInvestmentGoalHint')}
            error={investmentGoalError}
            required
          >
            {(controlProps) => (
              <div className="settings-input-suffix">
                <input
                  {...controlProps}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={draft.monthly_investment_goal_eur}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      monthly_investment_goal_eur: event.target.value,
                    })
                    setSaveState(null)
                  }}
                />
                <span className="settings-input-suffix-label" aria-hidden="true">
                  {draft.currency || 'EUR'}
                </span>
              </div>
            )}
          </Field>

          <div className="settings-preferences-actions">
            {(preferencesError || saveState) && (
              <p className={preferencesError ? 'error-text' : 'muted'} role="status">
                {preferencesError ?? saveState}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              loading={preferencesLoading}
              disabled={
                preferencesLoading
                || draft.currency.length !== 3
                || investmentGoalError !== null
              }
            >
              {t('savePreferences')}
            </Button>
          </div>
        </form>
      </Card>

      <div className="settings-secondary-grid">
        <Card as="section" padding="lg" className="settings-card settings-card-account">
          <SettingsCardHeading
            icon={UserRound}
            title={t('account')}
            description={t('accountDescription')}
          />

          <div className="settings-list-row settings-account-row">
            <span className="settings-row-avatar" aria-hidden="true">
              <Icon icon={UserRound} size={16} />
            </span>
            <span>
              <strong>{isAuthEnabled ? displayName : t('localMode')}</strong>
              <small>{isAuthEnabled ? t('signedIn') : t('localDescription')}</small>
            </span>

            {isAuthEnabled ? (
              <Button type="button" size="sm" variant="danger" onClick={() => void onSignOut()}>
                {t('signOut')}
              </Button>
            ) : (
              <em>{t('localOnly')}</em>
            )}
          </div>

          <a className="settings-list-row settings-list-link" href="/privacy">
            <span className="settings-row-avatar" aria-hidden="true">
              <Icon icon={ShieldCheck} size={16} />
            </span>
            <span>
              <strong>Privacy</strong>
              <small>Control how your data is used and request a copy or deletion.</small>
            </span>
            <Icon icon={ChevronRight} size={16} className="settings-row-chevron" aria-hidden="true" />
          </a>
        </Card>

        <Card as="section" padding="lg" className="settings-card settings-card-data">
          <SettingsCardHeading
            icon={Layers}
            title={t('dataOrganisation')}
            description={t('dataOrganisationDescription')}
          />

          <SettingsAction
            icon={Upload}
            title={t('import')}
            description={t('importDescription')}
            onClick={onOpenImport}
          />

          <SettingsAction
            icon={Download}
            title={t('exportBackup')}
            description={t('exportDescription')}
            onClick={onOpenExport}
          />

          <SettingsAction
            icon={FolderCog}
            title={t('categories')}
            description={t('categoriesDescription')}
            onClick={onOpenCategories}
          />
        </Card>
      </div>

      {isAuthEnabled && <AccessRequestsPanel />}

      {isAuthEnabled && (
        <Card as="section" padding="lg" className="settings-card settings-card-danger">
          <SettingsCardHeading
            icon={AlertTriangle}
            tone="danger"
            title="Danger zone"
            description="These actions are irreversible."
          />

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
            <em className="settings-delete-trigger-badge">
              {isDeletePanelOpen ? 'Cancel' : 'Delete'}
            </em>
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
              <Button
                type="button"
                variant="danger"
                loading={isDeleting}
                disabled={
                  isDeleting ||
                  deleteConfirmation.trim().toLowerCase() !== accountEmail.toLowerCase()
                }
                onClick={() => void handleDeleteAccount()}
              >
                {isDeleting ? 'Deleting account…' : 'Permanently delete account'}
              </Button>
            </div>
          )}
        </Card>
      )}

      <p className="settings-build-footer">
        Version {__APP_BUILD_COMMIT__} • Built {new Date(__APP_BUILD_TIME__).toLocaleString()} •{' '}
        <a
          href="https://github.com/FRCTavares/WebApp-Transactions/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noreferrer"
        >
          CHANGELOG.md
        </a>
      </p>
    </section>
  )
}
