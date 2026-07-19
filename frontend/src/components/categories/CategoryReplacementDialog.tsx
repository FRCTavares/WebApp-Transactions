import { useMemo, useState } from 'react'
import type { TransactionCategory } from '../../types/api'
import type {
  TransactionCategoryUsage,
} from '../../api/transactionCategories'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'

type CategoryReplacementDialogProps = {
  category: TransactionCategory
  categories: TransactionCategory[]
  usage: TransactionCategoryUsage
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: (replacementCategoryId: number) => void
  onReview: () => void
}

export function CategoryReplacementDialog({
  category,
  categories,
  usage,
  isSubmitting,
  onCancel,
  onConfirm,
  onReview,
}: CategoryReplacementDialogProps) {
  const replacementOptions = useMemo(
    () =>
      categories
        .filter(
          (candidate) =>
            candidate.id !== category.id &&
            candidate.is_active &&
            candidate.direction === category.direction &&
            candidate.cashflow_type === category.cashflow_type,
        )
        .sort(
          (first, second) =>
            first.sort_order - second.sort_order ||
            first.name.localeCompare(second.name),
        ),
    [categories, category],
  )

  const [replacementCategoryId, setReplacementCategoryId] =
    useState<number | null>(
      replacementOptions[0]?.id ?? null,
    )
  const dialogRef = useDialogAccessibility<HTMLElement>({
    onClose: onCancel,
    isCloseDisabled: isSubmitting,
  })

  return (
    <div
      className="category-replacement-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onCancel()
        }
      }}
    >
      <section
        ref={dialogRef}
        className="category-replacement-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-replacement-title"
        tabIndex={-1}
      >
        <header className="category-replacement-header">
          <div>
            <p className="eyebrow">Delete category</p>
            <h2 id="category-replacement-title">
              Replace “{category.name}”
            </h2>
          </div>

          <button
            type="button"
            className="category-replacement-close"
            aria-label="Close replacement dialog"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            ×
          </button>
        </header>

        <div className="category-replacement-summary">
          <strong>
            {usage.transaction_count} linked{' '}
            {usage.transaction_count === 1
              ? 'transaction'
              : 'transactions'}
          </strong>

          <p>
            Choose one category for every transaction, or review them
            individually before deleting this category.
          </p>
        </div>

        {replacementOptions.length === 0 ? (
          <div className="category-replacement-blocked">
            <strong>No replacement category is available.</strong>
            <p>
              Create or enable another category in the same group before
              deleting “{category.name}”.
            </p>
          </div>
        ) : (
          <label className="category-replacement-field">
            Replace with
            <select
              value={replacementCategoryId ?? ''}
              disabled={isSubmitting}
              onChange={(event) =>
                setReplacementCategoryId(Number(event.target.value))
              }
            >
              {replacementOptions.map((replacement) => (
                <option
                  key={replacement.id}
                  value={replacement.id}
                >
                  {replacement.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="category-replacement-note">
          Existing transactions will be updated before the old category
          is deleted.
        </p>

        <footer className="category-replacement-actions">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              isSubmitting ||
              replacementOptions.length === 0
            }
            onClick={onReview}
          >
            Review individually
          </button>

          <button
            type="button"
            className="danger-button"
            disabled={
              isSubmitting ||
              replacementCategoryId === null
            }
            onClick={() => {
              if (replacementCategoryId !== null) {
                onConfirm(replacementCategoryId)
              }
            }}
          >
            {isSubmitting
              ? 'Replacing…'
              : 'Replace all and delete'}
          </button>
        </footer>
      </section>
    </div>
  )
}
