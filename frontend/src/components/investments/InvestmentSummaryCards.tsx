import { formatMoney } from '../../utils/format'

export type InvestmentCurrencyTotal = {
  currency: string
  amount: number
}

type InvestmentSummaryCardsProps = {
  eventCount: number
  depositCount: number
  marketBuyCount: number
  unmatchedDepositCount: number
  openPositionCount: number
  costTotals: InvestmentCurrencyTotal[]
  marketValueTotals: InvestmentCurrencyTotal[]
  unrealisedGainTotals: InvestmentCurrencyTotal[]
}

function formatCurrencyTotals(totals: InvestmentCurrencyTotal[]) {
  if (totals.length === 0) {
    return '-'
  }

  return totals
    .map((total) => formatMoney(total.amount, total.currency))
    .join(' / ')
}

export function InvestmentSummaryCards({
  eventCount,
  depositCount,
  marketBuyCount,
  unmatchedDepositCount,
  openPositionCount,
  costTotals,
  marketValueTotals,
  unrealisedGainTotals,
}: InvestmentSummaryCardsProps) {
  return (
    <div className="summary-grid">
      <article className="summary-card">
        <h2>Investment events</h2>
        <strong>{eventCount}</strong>
      </article>

      <article className="summary-card">
        <h2>Deposits</h2>
        <strong>{depositCount}</strong>
      </article>

      <article className="summary-card">
        <h2>Market buys</h2>
        <strong>{marketBuyCount}</strong>
      </article>

      <article className="summary-card">
        <h2>Unmatched deposits</h2>
        <strong>{unmatchedDepositCount}</strong>
      </article>

      <article className="summary-card">
        <h2>Open positions</h2>
        <strong>{openPositionCount}</strong>
      </article>

      <article className="summary-card">
        <h2>Cost basis</h2>
        <strong>{formatCurrencyTotals(costTotals)}</strong>
      </article>

      <article className="summary-card">
        <h2>Market value</h2>
        <strong>{formatCurrencyTotals(marketValueTotals)}</strong>
      </article>

      <article className="summary-card">
        <h2>Unrealised gain</h2>
        <strong>{formatCurrencyTotals(unrealisedGainTotals)}</strong>
      </article>
    </div>
  )
}
