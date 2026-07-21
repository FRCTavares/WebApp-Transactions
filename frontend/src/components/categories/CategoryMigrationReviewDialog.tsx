import { useMemo, useState } from 'react'
import type {
  TransactionCategoryMigrationApplyPayload,
  TransactionCategoryMigrationPreview,
} from '../../api/transactionCategories'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'
import { X } from 'lucide-react'
import { Button, IconButton } from '../ui'

type CategoryMigrationReviewDialogProps = {
  preview: TransactionCategoryMigrationPreview
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (
    payload: TransactionCategoryMigrationApplyPayload,
  ) => void
}

export function CategoryMigrationReviewDialog({
  preview,
  isSubmitting,
  onCancel,
  onSubmit,
}: CategoryMigrationReviewDialogProps) {
  const dialogRef = useDialogAccessibility<HTMLElement>({
    onClose: onCancel,
    isCloseDisabled: isSubmitting,
  })
  const [transactionAssignments, setTransactionAssignments] =
    useState<Record<number, number | null>>(
      Object.fromEntries(
        preview.transactions.map((transaction) => [
          transaction.id,
          null,
        ]),
      ),
    )

  const isComplete = useMemo(
    () =>
      preview.transactions.every(
        (transaction) =>
          transactionAssignments[transaction.id] !== null,
      ),
    [preview.transactions, transactionAssignments],
  )

  function assignAllTransactions(replacementCategoryId: number) {
    setTransactionAssignments(
      Object.fromEntries(
        preview.transactions.map((transaction) => [
          transaction.id,
          replacementCategoryId,
        ]),
      ),
    )
  }

  function handleSubmit() {
    if (!isComplete) {
      return
    }

    onSubmit({
      transaction_assignments: preview.transactions.map(
        (transaction) => ({
          transaction_id: transaction.id,
          replacement_category_id:
            transactionAssignments[transaction.id] as number,
        }),
      ),
    })
  }

  return (
    <div
      className="category-migration-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onCancel()
        }
      }}
    >
      <section
        ref={dialogRef}
        className="category-migration-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-migration-title"
        tabIndex={-1}
      >
        <header className="category-migration-header">
          <div>
            <p className="eyebrow">Review category deletion</p>
            <h2 id="category-migration-title">
              Reassign “{preview.category.name}”
            </h2>
            <p>
              Choose where each affected transaction should go.
            </p>
          </div>

          <IconButton
            type="button"
            icon={X}
            label="Close migration review"
            disabled={isSubmitting}
            onClick={onCancel}
          />
        </header>

        {preview.replacement_categories.length === 0 ? (
          <div className="category-replacement-blocked">
            <strong>No replacement categories are available.</strong>
            <p>
              Create or enable another category in this group before
              continuing.
            </p>
          </div>
        ) : (
          <div className="category-migration-scroll">
            <section className="category-migration-section">
              <header>
                <div>
                  <h3>Transactions</h3>
                  <p>
                    {preview.transactions.length}{' '}
                    {preview.transactions.length === 1
                      ? 'transaction'
                      : 'transactions'}
                  </p>
                </div>

                <label>
                  Assign all
                  <select
                    disabled={isSubmitting}
                    value=""
                    onChange={(event) => {
                      if (event.target.value) {
                        assignAllTransactions(
                          Number(event.target.value),
                        )
                      }
                    }}
                  >
                    <option value="" disabled>
                      Choose category
                    </option>

                    {preview.replacement_categories.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </header>

              {preview.transactions.length === 0 ? (
                <p className="category-migration-empty">
                  No transactions use this category.
                </p>
              ) : (
                <div className="category-migration-list">
                  {preview.transactions.map((transaction) => (
                    <article
                      key={transaction.id}
                      className="category-migration-row"
                    >
                      <div className="category-migration-row-main">
                        <strong>{transaction.description}</strong>

                        <span>
                          {transaction.date} · {transaction.source}
                          {transaction.account
                            ? ` · ${transaction.account}`
                            : ''}
                        </span>

                        <small>
                          {transaction.raw_description}
                        </small>
                      </div>

                      <span className="category-migration-amount">
                        {transaction.amount} {transaction.currency}
                      </span>

                      <select
                        value={
                          transactionAssignments[transaction.id] ?? ''
                        }
                        disabled={isSubmitting}
                        onChange={(event) =>
                          setTransactionAssignments((current) => ({
                            ...current,
                            [transaction.id]: Number(
                              event.target.value,
                            ),
                          }))
                        }
                      >
                        <option value="" disabled>
                          Choose category
                        </option>

                        {preview.replacement_categories.map(
                          (category) => (
                            <option
                              key={category.id}
                              value={category.id}
                            >
                              {category.name}
                            </option>
                          ),
                        )}
                      </select>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <footer className="category-migration-actions">
          <Button type="button" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <Button
            type="button"
            variant="danger"
            disabled={
              isSubmitting ||
              !isComplete ||
              preview.replacement_categories.length === 0
            }
            onClick={handleSubmit}
          >
            {isSubmitting
              ? 'Applying migration…'
              : 'Apply migration and delete'}
          </Button>
        </footer>
      </section>
    </div>
  )
}
