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
    <section className="portfolio-snapshot">
      <div className="portfolio-snapshot-header">
        <div>
          <h2>Portfolio snapshot</h2>
          <p className="muted small">
            {eventCount} events · {marketBuyCount} market buys · {depositCount} deposits · {unmatchedDepositCount} unmatched deposits
          </p>
        </div>
      </div>

      <div className="portfolio-metrics">
        <article>
          <span>Open positions</span>
          <strong>{openPositionCount}</strong>
        </article>

        <article>
          <span>Cost basis</span>
          <strong>{formatCurrencyTotals(costTotals)}</strong>
        </article>

        <article>
          <span>Market value</span>
          <strong>{formatCurrencyTotals(marketValueTotals)}</strong>
        </article>

        <article>
          <span>Unrealised gain</span>
          <strong>{formatCurrencyTotals(unrealisedGainTotals)}</strong>
        </article>
      </div>
    </section>
  )
}
