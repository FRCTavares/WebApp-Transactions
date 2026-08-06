import type {
  InvestmentEvent,
  InvestmentPosition,
} from '../types/api'
import type { InvestmentCurrencyTotal } from '../components/investments/InvestmentSummaryCards'

/**
 * Pure helpers for `InvestmentsPage`. Split out of `InvestmentsPage.tsx`
 * (which was approaching the project's 900-line soft limit) — none of this
 * touches component state.
 */

function addCurrencyTotal(
  totals: Map<string, number>,
  currency: string | null,
  amount: string | null,
) {
  if (!currency || !amount) {
    return
  }

  const numericAmount = Number(amount)

  if (Number.isNaN(numericAmount)) {
    return
  }

  totals.set(currency, (totals.get(currency) ?? 0) + numericAmount)
}

function toCurrencyTotals(totals: Map<string, number>): InvestmentCurrencyTotal[] {
  return [...totals.entries()]
    .map(([currency, amount]) => ({
      currency,
      amount,
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}

export function getInvestmentTotals(positions: InvestmentPosition[]) {
  const costTotals = new Map<string, number>()
  const marketValueTotals = new Map<string, number>()
  const unrealisedGainTotals = new Map<string, number>()

  for (const position of positions) {
    for (const cost of position.costs) {
      if (cost.currency === 'EUR') {
        addCurrencyTotal(costTotals, 'EUR', cost.total_cost)
        continue
      }

      if (position.market_fx_rate_to_eur) {
        const convertedCost = Number(cost.total_cost) * Number(position.market_fx_rate_to_eur)

        if (!Number.isNaN(convertedCost)) {
          addCurrencyTotal(costTotals, 'EUR', String(convertedCost))
          continue
        }
      }

      addCurrencyTotal(costTotals, cost.currency, cost.total_cost)
    }

    addCurrencyTotal(
      marketValueTotals,
      position.market_value_currency,
      position.market_value,
    )

    addCurrencyTotal(
      unrealisedGainTotals,
      position.market_value_currency,
      position.unrealised_gain,
    )
  }

  return {
    costTotals: toCurrencyTotals(costTotals),
    marketValueTotals: toCurrencyTotals(marketValueTotals),
    unrealisedGainTotals: toCurrencyTotals(unrealisedGainTotals),
  }
}

export function getEventCount(events: InvestmentEvent[], eventType: string) {
  return events.filter((event) => event.event_type === eventType).length
}

export function getDefaultYahooSymbol(position: InvestmentPosition) {
  const ticker = position.ticker?.toUpperCase()

  if (ticker === 'VWCE') {
    return 'VWCE.DE'
  }

  if (ticker === 'CSPX') {
    return 'CSPX.L'
  }

  if (ticker === 'BTC') {
    return 'BTC-EUR'
  }

  return position.ticker ?? ''
}

export function getPositionCurrency(position: InvestmentPosition) {
  return position.market_price_currency ?? position.costs[0]?.currency ?? ''
}

export function getMarketDataLabel(position: InvestmentPosition) {
  return position.ticker ?? position.isin ?? position.instrument_name ?? 'holding'
}
