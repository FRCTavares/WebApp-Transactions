import type { TransactionCategory } from '../../types/api'
import { getTransferDirectionLabel } from '../../utils/transactionCategoriesPanelUtils'
import { Button } from '../ui'

/**
 * A single row in `TransactionCategoriesPanel`'s category list. Split
 * out (which was approaching the project's 900-line soft limit) —
 * purely presentational, all state lives in the parent panel.
 */
export function CategoryRow({
  category,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEditing,
  onSaveName,
  onCancelEditing,
  onToggle,
  onDelete,
}: {
  category: TransactionCategory
  isEditing: boolean
  editingName: string
  onEditingNameChange: (value: string) => void
  onStartEditing: (category: TransactionCategory) => void
  onSaveName: (category: TransactionCategory) => void
  onCancelEditing: () => void
  onToggle: (category: TransactionCategory) => void
  onDelete: (category: TransactionCategory) => void
}) {
  const isTransfer = category.cashflow_type === 'transfer'

  return (
    <article
      className={`transaction-category-row ${
        category.is_active
          ? ''
          : 'transaction-category-row-inactive'
      }`}
    >
      <div className="transaction-category-row-main">
        {isEditing ? (
          <input
            className="transaction-category-edit-input"
            value={editingName}
            onChange={(event) => onEditingNameChange(event.target.value)}
            autoFocus
          />
        ) : (
          <strong>{category.name}</strong>
        )}

        {isTransfer && (
          <span className="transaction-category-direction">
            {getTransferDirectionLabel(category)}
          </span>
        )}
      </div>

      <span
        className={`transaction-category-status ${
          category.is_active
            ? 'transaction-category-status-active'
            : 'transaction-category-status-inactive'
        }`}
      >
        {category.is_active ? 'Active' : 'Inactive'}
      </span>

      <div className="transaction-category-actions">
        {isEditing ? (
          <>
            <Button type="button" size="sm" variant="primary" onClick={() => onSaveName(category)}>
              Save
            </Button>
            <Button type="button" size="sm" onClick={onCancelEditing}>
              Cancel
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" onClick={() => onStartEditing(category)}>
            Rename
          </Button>
        )}

        <Button type="button" size="sm" onClick={() => onToggle(category)}>
          {category.is_active ? 'Disable' : 'Enable'}
        </Button>

        <Button type="button" size="sm" variant="danger" onClick={() => onDelete(category)}>
          Delete
        </Button>
      </div>
    </article>
  )
}
