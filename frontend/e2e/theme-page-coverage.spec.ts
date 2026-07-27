import { expect, test, type Page } from '@playwright/test'

const THEME_STORAGE_KEY = 'finance-theme-preference'

type Theme = 'light' | 'dark'

type PageCase = {
  name: string
  path: string
  heading: string
}

type ViewportCase = {
  name: string
  width: number
  height: number
}

const PAGE_CASES: PageCase[] = [
  {
    name: 'dashboard',
    path: '/dashboard',
    heading: 'Dashboard',
  },
  {
    name: 'transactions',
    path: '/transactions',
    heading: 'Money Out',
  },
  {
    name: 'wealth',
    path: '/wealth',
    heading: 'Wealth',
  },
  {
    name: 'investments',
    path: '/investments',
    heading: 'Investments',
  },
  {
    name: 'owed',
    path: '/owed',
    heading: 'Owed To Me',
  },
  {
    name: 'more',
    path: '/more',
    heading: 'More',
  },
  {
    name: 'import',
    path: '/import',
    heading: 'Import CSV/XLSX',
  },
  {
    name: 'categories',
    path: '/categories',
    heading: 'Categories',
  },
  {
    name: 'export',
    path: '/export',
    heading: 'Export / Backup',
  },
  {
    name: 'settings',
    path: '/settings',
    heading: 'Settings',
  },
  {
    name: 'privacy',
    path: '/privacy',
    heading: 'Privacy and Account Deletion',
  },
]

const THEMES: Theme[] = ['light', 'dark']

const VIEWPORT_CASES: ViewportCase[] = [
  {
    name: 'mobile',
    width: 375,
    height: 900,
  },
  {
    name: 'tablet',
    width: 800,
    height: 1000,
  },
  {
    name: 'desktop',
    width: 1440,
    height: 1000,
  },
]

async function installThemePreference(page: Page, theme: Theme) {
  await page.addInitScript(
    ({ storageKey, themePreference }) => {
      window.localStorage.setItem(storageKey, themePreference)
    },
    {
      storageKey: THEME_STORAGE_KEY,
      themePreference: theme,
    },
  )
}

async function getHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const documentElement = document.documentElement
    const body = document.body

    return {
      documentClientWidth: documentElement.clientWidth,
      documentScrollWidth: documentElement.scrollWidth,
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
    }
  })
}

for (const pageCase of PAGE_CASES) {
  for (const theme of THEMES) {
    for (const viewport of VIEWPORT_CASES) {
      test(
        `${pageCase.name} renders in ${theme} theme at ${viewport.width}px`,
        async ({ page }, testInfo) => {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          })

          await installThemePreference(page, theme)
          await page.goto(pageCase.path)

          await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            theme,
          )

          await expect(
            page.getByRole('heading', {
              level: 1,
              name: pageCase.heading,
              exact: true,
            }),
          ).toBeVisible()

          const overflow = await getHorizontalOverflow(page)

          expect(
            overflow.documentScrollWidth,
            `document overflow on ${pageCase.path} at ${viewport.width}px`,
          ).toBeLessThanOrEqual(overflow.documentClientWidth)

          expect(
            overflow.bodyScrollWidth,
            `body overflow on ${pageCase.path} at ${viewport.width}px`,
          ).toBeLessThanOrEqual(overflow.bodyClientWidth)

          await page.screenshot({
            path: testInfo.outputPath(
              `${pageCase.name}-${theme}-${viewport.name}-${viewport.width}px.png`,
            ),
            fullPage: true,
          })
        },
      )
    }
  }
}
