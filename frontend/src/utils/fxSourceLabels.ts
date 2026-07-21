/**
 * Human labels for the `fx_rate_source` / `market_fx_rate_source` values the
 * backend stores.
 *
 * These are internal identifiers - "source_currency", "derived_from_eur_trade"
 * - and were being rendered to the user verbatim, so a holdings card read
 * "FX SOURCE: derived_from_eur_trade". The values themselves stay untouched;
 * only their presentation changes.
 *
 * Set by:
 *   importers/trading212.py            source_currency | pending
 *   import_fx_resolution_service.py    source_currency
 *   investment_event_service.py        manual
 *   investment_valuation_service.py    source_currency | investment_event
 *                                      | derived_from_eur_trade
 */
const FX_SOURCE_LABEL: Record<string, string> = {
  source_currency: 'Already in EUR',
  derived_from_eur_trade: 'Derived from the EUR trade value',
  investment_event: 'From the investment event',
  manual: 'Entered manually',
  pending: 'Not yet resolved',
}

/** Longer explanations, for a title tooltip. */
const FX_SOURCE_HINT: Record<string, string> = {
  source_currency: 'The position is priced in EUR, so no conversion was needed.',
  derived_from_eur_trade:
    'The rate was derived from the EUR amount recorded on the original trade.',
  investment_event: 'The rate recorded on the investment event was used.',
  manual: 'The rate was entered by hand.',
  pending: 'No rate has been resolved for this row yet.',
}

function humanise(value: string) {
  const spaced = value.replaceAll('_', ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function formatFxSource(value: string | null | undefined): string {
  if (!value) {
    return 'Not required'
  }

  return FX_SOURCE_LABEL[value] ?? humanise(value)
}

export function getFxSourceHint(value: string | null | undefined): string | undefined {
  if (!value) {
    return 'No conversion was required for this position.'
  }

  return FX_SOURCE_HINT[value]
}
