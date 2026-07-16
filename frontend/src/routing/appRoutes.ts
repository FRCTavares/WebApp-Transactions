export type Page =
  | 'dashboard'
  | 'transactions'
  | 'wealth'
  | 'investments'
  | 'owed'
  | 'more'
  | 'import'
  | 'categories'
  | 'export'
  | 'settings'

const PAGE_PATHS: Record<Page, string> = {
  dashboard: '/dashboard',
  transactions: '/transactions',
  wealth: '/wealth',
  investments: '/investments',
  owed: '/owed',
  more: '/more',
  import: '/import',
  categories: '/categories',
  export: '/export',
  settings: '/settings',
}

const PATH_PAGES = new Map(
  Object.entries(PAGE_PATHS).map(([page, path]) => [
    path,
    page as Page,
  ]),
)

export function getPageFromPath(pathname: string): Page | null {
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname

  return PATH_PAGES.get(normalizedPath) ?? null
}

export function getPathForPage(page: Page): string {
  return PAGE_PATHS[page]
}
