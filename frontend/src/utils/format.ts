export type PresentationPreferences = {
  locale: 'en-GB' | 'pt-PT'
  currency: string
  time_zone: string
  date_format: 'short' | 'medium' | 'long'
  language: 'en' | 'pt'
  monthly_investment_goal_eur: string
  has_completed_onboarding: boolean
}

export const DEFAULT_PRESENTATION_PREFERENCES: PresentationPreferences = {
  locale: 'en-GB',
  currency: 'EUR',
  time_zone: 'Europe/Lisbon',
  date_format: 'medium',
  language: 'en',
  monthly_investment_goal_eur: '100.00',
  has_completed_onboarding: false,
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

/**
 * Currency, abbreviated to one significant fractional digit (e.g. "€48K",
 * "€1.2M"). For chart axes and other tight labels where the full grouped
 * number would overflow its container - the exact value still shows in the
 * tooltip. Values below 1,000 render in full.
 */
export function formatMoneyCompact(value: string | number, currency?: string) {
  const numberValue = typeof value === 'string' ? Number(value) : value

  if (Number.isNaN(numberValue)) {
    return String(value)
  }

  const formatted = new Intl.NumberFormat(preferences.locale, {
    style: 'currency',
    currency: currency ?? preferences.currency,
    notation: 'compact',
    maximumFractionDigits: Math.abs(numberValue) >= 1000 ? 1 : 0,
  }).format(numberValue)

  // Some ICU builds render the compact suffix lower-case (e.g. "€1.3m");
  // upper-case a single-letter magnitude so axis labels read consistently.
  return formatted.replace(/(\d\s?)([kmbt])\b/gi, (_, digits, suffix) =>
    `${digits}${suffix.toUpperCase()}`,
  )
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
