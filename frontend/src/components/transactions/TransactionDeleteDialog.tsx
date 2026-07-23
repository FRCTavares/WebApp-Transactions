import { useState } from 'react'
import { Button } from '../ui'
import type {
  Transaction,
  TransactionDeletionPreview,
  TransactionLinkedOwedDeletionStrategy,
} from '../../types/api'
import { formatMoney } from '../../utils/format'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'
import './TransactionDeleteDialog.css'

type TransactionDeleteDialogProps = {
  transaction: Transaction
  preview: TransactionDeletionPreview | null
  previewError: string | null
  isPreviewLoading: boolean
  isDeleting: boolean
  onCancel: () => void
  onConfirm: (
    strategy: TransactionLinkedOwedDeletionStrategy | null,
    replacementPerson: string | null,
  ) => void
}

export function TransactionDeleteDialog({
  transaction,
  preview,
  previewError,
  isPreviewLoading,
  isDeleting,
  onCancel,
  onConfirm,
}: TransactionDeleteDialogProps) {
  const [selectedStrategy, setSelectedStrategy] =
    useState<
      TransactionLinkedOwedDeletionStrategy | undefined
    >(undefined)
  const [
    selectedReplacementPerson,
    setSelectedReplacementPerson,
  ] = useState<string | undefined>(undefined)

  const strategy = selectedStrategy ?? null
  const replacementPerson =
    selectedReplacementPerson ?? ''

  const dialogRef = useDialogAccessibility<HTMLDivElement>({
    onClose: onCancel,
    isCloseDisabled: isDeleting,
  })

  const normalDeleteAllowed =
    preview?.normal_delete_allowed === true
  const preserveSelected = strategy === 'preserve_owed'
  const strategyAllowed =
    strategy === 'delete_with_owed'
      ? preview?.delete_with_owed_allowed === true
      : strategy === 'preserve_owed'
        ? preview?.preserve_owed_allowed === true
        : false
  const canConfirm =
    !isPreviewLoading &&
    !previewError &&
    !isDeleting &&
    (
      normalDeleteAllowed ||
      (
        strategyAllowed &&
        (
          !preserveSelected ||
          replacementPerson.trim().length > 0
        )
      )
    )

  let confirmLabel = normalDeleteAllowed
    ? 'Delete'
    : 'Choose an action'

  if (strategy === 'delete_with_owed') {
    confirmLabel = 'Delete transaction and owed'
  } else if (strategy === 'preserve_owed') {
    confirmLabel = 'Keep owed and delete'
  }

  function handleConfirm() {
    if (!canConfirm) {
      return
    }

    onConfirm(
      normalDeleteAllowed ? null : strategy,
      preserveSelected ? replacementPerson.trim() : null,
    )
  }

  return (
    <div
      className="modal-backdrop transaction-delete-dialog-backdrop"
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="transaction-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-delete-title"
        tabIndex={-1}
      >
        <div className="transaction-delete-dialog-header">
          <span
            className="transaction-delete-dialog-icon"
            aria-hidden="true"
          >
            !
          </span>
          <div>
            <h2 id="transaction-delete-title">
              Delete transaction?
            </h2>
            <p>
              Review linked owed records before continuing.
            </p>
          </div>
        </div>

        <div className="transaction-delete-dialog-summary">
          <strong>{transaction.description}</strong>
          <span>
            {formatMoney(
              transaction.amount,
              transaction.currency,
            )}
          </span>
        </div>

        <div className="transaction-delete-dialog-body">
          {isPreviewLoading ? (
            <p
              className="transaction-delete-dialog-loading"
              role="status"
              aria-live="polite"
            >
              Checking linked owed records...
            </p>
          ) : null}

          {previewError ? (
            <p
              className="transaction-delete-dialog-error"
              role="alert"
            >
              {previewError}
            </p>
          ) : null}

          {preview?.normal_delete_allowed ? (
            <p className="transaction-delete-dialog-warning">
              No linked owed records were found. Deleting this
              transaction cannot be undone.
            </p>
          ) : null}

          {preview?.has_linked_owed ? (
            <>
              <section
                className="transaction-delete-dialog-linked"
                aria-labelledby="transaction-delete-linked-title"
              >
                <div>
                  <h3 id="transaction-delete-linked-title">
                    Linked owed obligations
                  </h3>
                  <p>
                    These records must be handled in the same
                    operation.
                  </p>
                </div>

                <ul className="transaction-delete-dialog-list">
                  {preview.linked_owed_items.map((item) => (
                    <li
                      key={item.id}
                      className="transaction-delete-dialog-item"
                    >
                      <div className="transaction-delete-dialog-item-header">
                        <strong>{item.person}</strong>
                        <span>
                          {formatMoney(
                            item.amount_remaining,
                            transaction.currency,
                          )}{' '}
                          remaining
                        </span>
                      </div>
                      <div className="transaction-delete-dialog-item-meta">
                        <span>
                          Total{' '}
                          {formatMoney(
                            item.amount_total,
                            transaction.currency,
                          )}
                        </span>
                        <span>
                          Paid{' '}
                          {formatMoney(
                            item.amount_paid,
                            transaction.currency,
                          )}
                        </span>
                        <span>
                          {item.status.replaceAll('_', ' ')}
                        </span>
                        <span>
                          {item.allocation_count}{' '}
                          {item.allocation_count === 1
                            ? 'allocation'
                            : 'allocations'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <fieldset className="transaction-delete-dialog-options">
                <legend>Choose what happens</legend>

                <label
                  className={`transaction-delete-dialog-option${
                    preview.delete_with_owed_allowed
                      ? ''
                      : ' is-disabled'
                  }`}
                >
                  <input
                    type="radio"
                    name="transaction-delete-strategy"
                    value="delete_with_owed"
                    checked={strategy === 'delete_with_owed'}
                    disabled={
                      isDeleting ||
                      !preview.delete_with_owed_allowed
                    }
                    onChange={() =>
                      setSelectedStrategy('delete_with_owed')
                    }
                  />
                  <span>
                    <strong>
                      Delete the transaction and linked owed
                      obligations
                    </strong>
                    <small>
                      Use this only when no repayment history must
                      be retained.
                    </small>
                    {!preview.delete_with_owed_allowed &&
                    preview.delete_with_owed_block_reason ? (
                      <em>
                        {preview.delete_with_owed_block_reason}
                      </em>
                    ) : null}
                  </span>
                </label>

                <label
                  className={`transaction-delete-dialog-option${
                    preview.preserve_owed_allowed
                      ? ''
                      : ' is-disabled'
                  }`}
                >
                  <input
                    type="radio"
                    name="transaction-delete-strategy"
                    value="preserve_owed"
                    checked={strategy === 'preserve_owed'}
                    disabled={
                      isDeleting ||
                      !preview.preserve_owed_allowed
                    }
                    onChange={() =>
                      setSelectedStrategy('preserve_owed')
                    }
                  />
                  <span>
                    <strong>
                      Keep the owed obligations
                    </strong>
                    <small>
                      Detach them from this transaction and choose
                      who now owes you.
                    </small>
                    {!preview.preserve_owed_allowed &&
                    preview.preserve_owed_block_reason ? (
                      <em>
                        {preview.preserve_owed_block_reason}
                      </em>
                    ) : null}
                  </span>
                </label>
              </fieldset>

              {strategy === 'preserve_owed' ? (
                <label className="transaction-delete-dialog-field">
                  Who should owe you now?
                  <select
                    value={replacementPerson}
                    disabled={isDeleting}
                    onChange={(event) =>
                      setSelectedReplacementPerson(event.target.value)
                    }
                  >
                    <option value="">
                      Choose a person
                    </option>
                    {preview.available_replacement_people.map(
                      (person) => (
                        <option key={person} value={person}>
                          {person}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              ) : null}
            </>
          ) : null}

          {preview &&
          !preview.normal_delete_allowed &&
          !preview.has_linked_owed ? (
            <div className="transaction-delete-dialog-blocked">
              <strong>
                This transaction cannot be deleted here.
              </strong>
              <p>
                {preview.normal_delete_block_reason ??
                  'A linked financial record requires manual review.'}
              </p>
              {preview.linked_owed_payment_count > 0 ? (
                <p>
                  Linked owed payments: {' '}
                  {preview.linked_owed_payment_count}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="transaction-delete-dialog-actions">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          {preview &&
          (
            preview.normal_delete_allowed ||
            preview.has_linked_owed
          ) ? (
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              {isDeleting ? 'Deleting...' : confirmLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
