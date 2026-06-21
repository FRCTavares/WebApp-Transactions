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

function getFirstMoneyValue(totals: InvestmentCurrencyTotal[]) {
  return totals[0] ?? null
}

function getGainClassName(value: number | null) {
  if (value === null) {
    return 'investment-gain-neutral'
  }

  if (value > 0) {
    return 'investment-gain-positive'
  }

  if (value < 0) {
    return 'investment-gain-negative'
  }

  return 'investment-gain-neutral'
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
  const primaryMarketValue = getFirstMoneyValue(marketValueTotals)
  const primaryCostBasis = getFirstMoneyValue(costTotals)
  const primaryGain = getFirstMoneyValue(unrealisedGainTotals)
  const gainClassName = getGainClassName(primaryGain?.amount ?? null)

  return (
    <section className="portfolio-snapshot investment-summary-card">
      <div className="portfolio-snapshot-header">
        <div>
          <h2>Portfolio</h2>
          <p className="muted small investment-summary-meta">
            {eventCount} events · {marketBuyCount} buys · {depositCount} deposits · {unmatchedDepositCount} unmatched
          </p>
        </div>
      </div>

      <div className="investment-summary-mobile-hero">
        <p className="muted small">Market value</p>
        <strong>
          {primaryMarketValue
            ? formatMoney(String(primaryMarketValue.amount), primaryMarketValue.currency)
            : '-'}
        </strong>
        <span className={gainClassName}>
          {primaryGain
            ? formatMoney(String(primaryGain.amount), primaryGain.currency)
            : '-'} unrealised
        </span>
      </div>

      <div className="portfolio-metrics investment-summary-grid">
        <article>
          <span>Positions</span>
          <strong>{openPositionCount}</strong>
        </article>

        <article>
          <span>Cost basis</span>
          <strong>
            {primaryCostBasis
              ? formatMoney(String(primaryCostBasis.amount), primaryCostBasis.currency)
              : formatCurrencyTotals(costTotals)}
          </strong>
        </article>

        <article className="investment-summary-desktop-only">
          <span>Market value</span>
          <strong>{formatCurrencyTotals(marketValueTotals)}</strong>
        </article>

        <article className="investment-summary-desktop-only">
          <span>Unrealised gain</span>
          <strong className={gainClassName}>{formatCurrencyTotals(unrealisedGainTotals)}</strong>
        </article>
      </div>
    </section>
  )
}
