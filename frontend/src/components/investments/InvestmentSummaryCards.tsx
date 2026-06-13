type InvestmentSummaryCardsProps = {
  eventCount: number
  depositCount: number
  marketBuyCount: number
  unmatchedDepositCount: number
  openPositionCount: number
}

export function InvestmentSummaryCards({
  eventCount,
  depositCount,
  marketBuyCount,
  unmatchedDepositCount,
  openPositionCount,
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
    </div>
  )
}
