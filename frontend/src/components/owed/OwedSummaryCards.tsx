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
    <div className="owed-summary-grid">
      <article className="owed-summary-card owed-summary-card-primary">
        <span>Still owed</span>
        <strong>{formatMoney(totalStillOwed.toFixed(2))}</strong>
        <small>{activeItems.length} current items</small>
      </article>

      <article className="owed-summary-card">
        <span>Already reimbursed</span>
        <strong>{formatMoney(totalAlreadyReimbursed.toFixed(2))}</strong>
        <small>{paidItems.length} paid items in this view</small>
      </article>

      <article className="owed-summary-card">
        <span>Total original amount</span>
        <strong>{formatMoney(totalOriginalAmount.toFixed(2))}</strong>
        <small>{cancelledItems.length} cancelled items</small>
      </article>
    </div>
  )
}
