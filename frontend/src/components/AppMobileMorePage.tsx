import {
  Download,
  FolderCog,
  LogOut,
  Settings,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { SegmentedControl } from './ui/SegmentedControl'
import { useTheme } from '../hooks/useTheme'
import type { ResolvedTheme } from '../context/themeContextValue'

const THEME_OPTIONS: { value: ResolvedTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

type AppMobileMorePageProps = {
  isAuthEnabled: boolean
  onOpenCategories: () => void
  onOpenExport: () => void
  onOpenImport: () => void
  onOpenInvestments: () => void
  onOpenSettings: () => void
  onSignOut: () => void
}

export function AppMobileMorePage({
  isAuthEnabled,
  onOpenCategories,
  onOpenExport,
  onOpenImport,
  onOpenInvestments,
  onOpenSettings,
  onSignOut,
}: AppMobileMorePageProps) {
  const { resolvedTheme, setThemePreference } = useTheme()

  return (
    <section className="mobile-more-page">
      <div className="mobile-more-hero">
        <p className="eyebrow">Menu</p>
        <h1>More</h1>
        <p>Tools, settings, imports, and secondary finance views.</p>
      </div>

      <section className="mobile-more-section mobile-more-appearance">
        <div className="mobile-more-section-header">
          <h2>Appearance</h2>
          <p>Choose how the app looks on this device.</p>
        </div>

        <SegmentedControl
          label="Theme"
          options={THEME_OPTIONS}
          value={resolvedTheme}
          onChange={setThemePreference}
        />
      </section>

      <section className="mobile-more-section">
        <div className="mobile-more-section-header">
          <h2>Finance</h2>
          <p>Review and organise your money.</p>
        </div>

        <div className="mobile-more-actions">
          <button type="button" onClick={onOpenInvestments}>
            <span className="mobile-more-action-icon" aria-hidden="true">
              <TrendingUp />
            </span>
            <span>
              <strong>Investments</strong>
              <small>Holdings, market prices, and broker events.</small>
            </span>
          </button>
        </div>
      </section>

      <section className="mobile-more-section">
        <div className="mobile-more-section-header">
          <h2>Tools</h2>
          <p>Import data and manage app configuration.</p>
        </div>

        <div className="mobile-more-actions">
          <button type="button" onClick={onOpenImport}>
            <span className="mobile-more-action-icon" aria-hidden="true">
              <Upload />
            </span>
            <span>
              <strong>Import CSV</strong>
              <small>Preview and import bank or broker files.</small>
            </span>
          </button>

          <button type="button" onClick={onOpenCategories}>
            <span className="mobile-more-action-icon" aria-hidden="true">
              <FolderCog />
            </span>
            <span>
              <strong>Categories / Rules</strong>
              <small>Clean descriptions and automate categories.</small>
            </span>
          </button>

          <button type="button" onClick={onOpenExport}>
            <span className="mobile-more-action-icon" aria-hidden="true">
              <Download />
            </span>
            <span>
              <strong>Export</strong>
              <small>Download your finance data.</small>
            </span>
          </button>

          <button type="button" onClick={onOpenSettings}>
            <span className="mobile-more-action-icon" aria-hidden="true">
              <Settings />
            </span>
            <span>
              <strong>Settings</strong>
              <small>App configuration and account controls.</small>
            </span>
          </button>
        </div>
      </section>

      {isAuthEnabled && (
        <section className="mobile-more-section">
          <div className="mobile-more-actions">
            <button
              type="button"
              className="mobile-more-danger"
              onClick={onSignOut}
            >
              <span className="mobile-more-action-icon" aria-hidden="true">
                <LogOut />
              </span>
              <span>
                <strong>Sign out</strong>
                <small>End this Google session.</small>
              </span>
            </button>
          </div>
        </section>
      )}
    </section>
  )
}
