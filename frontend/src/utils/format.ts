export type PresentationPreferences = {
  locale: 'en-GB' | 'pt-PT'
  currency: string
  time_zone: string
  date_format: 'short' | 'medium' | 'long'
  language: 'en' | 'pt'
  monthly_investment_goal_eur: string
}

export const DEFAULT_PRESENTATION_PREFERENCES: PresentationPreferences = {
  locale: 'en-GB',
  currency: 'EUR',
  time_zone: 'Europe/Lisbon',
  date_format: 'medium',
  language: 'en',
  monthly_investment_goal_eur: '100.00',
}

let preferences = DEFAULT_PRESENTATION_PREFERENCES

export function configureFormatters(next: PresentationPreferences) {
  preferences = next
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next.language
  }
}

export function formatMoney(value: string | number, currency?: string) {
  const numberValue = typeof value === 'string' ? Number(value) : value

  if (Number.isNaN(numberValue)) {
    return String(value)
  }

  return new Intl.NumberFormat(preferences.locale, {
    style: 'currency',
    currency: currency ?? preferences.currency,
  }).format(numberValue)
}

export function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(dateOnly ? `${value}T12:00:00Z` : value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const styles = {
    short: { year: '2-digit', month: '2-digit', day: '2-digit' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
  } as const

  return new Intl.DateTimeFormat(preferences.locale, {
    ...styles[preferences.date_format],
    timeZone: preferences.time_zone,
  }).format(date)
}

export function formatMonthLabel(monthKey: string, month: 'short' | 'long' = 'short') {
  const [year, monthNumber] = monthKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1, 1, 12))

  return new Intl.DateTimeFormat(preferences.locale, {
    month,
    year: 'numeric',
    timeZone: preferences.time_zone,
  }).format(date)
}
