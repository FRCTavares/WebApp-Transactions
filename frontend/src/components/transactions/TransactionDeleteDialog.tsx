import type { Transaction } from '../../types/api'
import { formatMoney } from '../../utils/format'

type TransactionDeleteDialogProps = {
  transaction: Transaction
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function TransactionDeleteDialog({
  transaction,
  isDeleting,
  onCancel,
  onConfirm,
}: TransactionDeleteDialogProps) {
  return (
    <div className="modal-backdrop transaction-delete-dialog-backdrop" role="dialog" aria-modal="true">
      <div className="transaction-delete-dialog">
        <div className="transaction-delete-dialog-header">
          <span className="transaction-delete-dialog-icon" aria-hidden="true">
            !
          </span>
          <div>
            <h2>Delete transaction?</h2>
            <p>
              This cannot be undone.
            </p>
          </div>
        </div>

        <div className="transaction-delete-dialog-summary">
          <strong>{transaction.description}</strong>
          <span>{formatMoney(transaction.amount, transaction.currency)}</span>
        </div>

        <div className="transaction-delete-dialog-actions">
          <button type="button" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button
            type="button"
            className="transaction-delete-confirm-button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
