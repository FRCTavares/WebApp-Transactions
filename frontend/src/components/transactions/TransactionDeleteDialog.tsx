import { Button } from '../ui'
import type { Transaction } from '../../types/api'
import { formatMoney } from '../../utils/format'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'

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
  const dialogRef = useDialogAccessibility<HTMLDivElement>({
    onClose: onCancel,
    isCloseDisabled: isDeleting,
  })

  return (
    <div className="modal-backdrop transaction-delete-dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="transaction-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-delete-title"
        tabIndex={-1}
      >
        <div className="transaction-delete-dialog-header">
          <span className="transaction-delete-dialog-icon" aria-hidden="true">
            !
          </span>
          <div>
            <h2 id="transaction-delete-title">Delete transaction?</h2>
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
          <Button type="button" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}
