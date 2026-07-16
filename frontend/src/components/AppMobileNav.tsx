import {
  HandCoins,
  LayoutDashboard,
  MoreHorizontal,
  PiggyBank,
  ReceiptText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Page } from '../routing/appRoutes'

const MOBILE_NAV_ITEMS: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'transactions', label: 'Activity', icon: ReceiptText },
  { id: 'owed', label: 'Owed', icon: HandCoins },
  { id: 'wealth', label: 'Wealth', icon: PiggyBank },
  { id: 'more', label: 'More', icon: MoreHorizontal },
]

const MORE_RELATED_PAGES = new Set<Page>([
  'more',
  'import',
  'categories',
  'export',
  'settings',
  'investments',
])

function getMobileButtonClass(
  currentPage: Page | null,
  itemId: Page,
) {
  const isMoreActive =
    currentPage !== null
    && itemId === 'more'
    && MORE_RELATED_PAGES.has(currentPage)

  return currentPage === itemId || isMoreActive ? 'active' : ''
}

type AppMobileNavProps = {
  currentPage: Page | null
  onPageChange: (page: Page) => void
}

export function AppMobileNav({ currentPage, onPageChange }: AppMobileNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {MOBILE_NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={getMobileButtonClass(currentPage, item.id)}
          onClick={() => onPageChange(item.id)}
        >
          <item.icon className="mobile-bottom-nav-icon" aria-hidden="true" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
