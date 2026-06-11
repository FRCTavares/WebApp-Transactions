import type { OwedItem } from '../../types/api'
import { formatMoney } from '../../utils/format'

type OwedSummaryCardsProps = {
  activeItems: OwedItem[]
  paidItems: OwedItem[]
  cancelledItems: OwedItem[]
  totalStillOwed: number
  totalAlreadyReimbursed: number
  totalOriginalAmount: number
}

export function OwedSummaryCards({
  activeItems,
  paidItems,
  cancelledItems,
  totalStillOwed,
  totalAlreadyReimbursed,
  totalOriginalAmount,
}: OwedSummaryCardsProps) {
  return (
    <>
      <div className="summary-grid">
        <article className="summary-card">
          <h2>Still owed to me</h2>
          <strong>{formatMoney(totalStillOwed.toFixed(2))}</strong>
        </article>

        <article className="summary-card">
          <h2>Already reimbursed</h2>
          <strong>{formatMoney(totalAlreadyReimbursed.toFixed(2))}</strong>
        </article>

        <article className="summary-card">
          <h2>Total original amount</h2>
          <strong>{formatMoney(totalOriginalAmount.toFixed(2))}</strong>
        </article>

        <article className="summary-card">
          <h2>Active owed items</h2>
          <strong>{activeItems.length}</strong>
        </article>
      </div>

      <div className="cards">
        <div className="card">
          <span>Open / partially paid</span>
          <strong>{activeItems.length}</strong>
        </div>
        <div className="card">
          <span>Paid</span>
          <strong>{paidItems.length}</strong>
        </div>
        <div className="card">
          <span>Cancelled</span>
          <strong>{cancelledItems.length}</strong>
        </div>
      </div>
    </>
  )
}
