import {
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  Moon,
  Settings,
  Sun,
  TrendingUp,
  Upload,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Page } from '../App'
import { useTheme } from '../context/ThemeContext'

const NAV_GROUPS: { title: string; items: { id: Page; label: string; icon: LucideIcon }[] }[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Money',
    items: [
      { id: 'transactions', label: 'Transactions', icon: ReceiptText },
      { id: 'wealth', label: 'Wealth', icon: PiggyBank },
      { id: 'investments', label: 'Investments', icon: TrendingUp },
      { id: 'owed', label: 'Owed', icon: HandCoins },
    ],
  },
  {
    title: 'Tools',
    items: [
      { id: 'import', label: 'Import', icon: Upload },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

const SETTINGS_RELATED_PAGES = new Set<Page>(['categories', 'export'])

function getSidebarButtonClass(currentPage: Page, itemId: Page) {
  const isSettingsActive = itemId === 'settings' && SETTINGS_RELATED_PAGES.has(currentPage)

  return currentPage === itemId || isSettingsActive ? 'active' : ''
}

type AppSidebarProps = {
  authError: string | null
  currentPage: Page
  displayName: string
  isAuthEnabled: boolean
  profileAvatarUrl: string | null
  onPageChange: (page: Page) => void
  onSignOut: () => void
}

export function AppSidebar({
  authError,
  currentPage,
  displayName,
  isAuthEnabled,
  profileAvatarUrl,
  onPageChange,
  onSignOut,
}: AppSidebarProps) {
  const { resolvedTheme, setThemePreference } = useTheme()

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img
            src="/app-icon.png"
            alt=""
            aria-hidden="true"
            className="sidebar-brand-icon"
          />
          <div className="account-summary">
            <p className="account-greeting">Finance</p>
          </div>
        </div>
        {authError && <p className="error-text">{authError}</p>}
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <section key={group.title} className="nav-group">
            <h3>{group.title}</h3>
            <div className="nav-items">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={getSidebarButtonClass(currentPage, item.id)}
                  onClick={() => onPageChange(item.id)}
                >
                  <item.icon className="nav-icon" aria-hidden="true" />
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-controls">
          <div className="sidebar-theme-switch" role="group" aria-label="Theme">
            <button
              type="button"
              className={resolvedTheme === 'light' ? 'theme-option-active' : ''}
              aria-label="Use light mode"
              aria-pressed={resolvedTheme === 'light'}
              title="Light mode"
              onClick={() => setThemePreference('light')}
            >
              <Sun className="sidebar-theme-switch-icon" aria-hidden="true" />
            </button>

            <button
              type="button"
              className={resolvedTheme === 'dark' ? 'theme-option-active' : ''}
              aria-label="Use dark mode"
              aria-pressed={resolvedTheme === 'dark'}
              title="Dark mode"
              onClick={() => setThemePreference('dark')}
            >
              <Moon className="sidebar-theme-switch-icon" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="sidebar-profile">
          <div className="sidebar-profile-main">
          {profileAvatarUrl ? (
            <img
              src={profileAvatarUrl}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className="sidebar-profile-avatar"
            />
          ) : (
            <div className="sidebar-profile-avatar sidebar-profile-avatar-fallback" aria-hidden="true">
              <UserRound className="sidebar-profile-avatar-icon" />
            </div>
          )}
          <div className="account-summary">
            <p className="account-greeting">{displayName}</p>
            <p className="account-subtitle">
              {isAuthEnabled ? 'Signed in' : 'Local mode'}
            </p>
          </div>
        </div>

          {isAuthEnabled && (
            <button
              type="button"
              className="sidebar-signout-button"
              onClick={onSignOut}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
