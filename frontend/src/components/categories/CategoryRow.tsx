import type { TransactionCategory } from '../../types/api'
import { getTransferDirectionLabel } from '../../utils/transactionCategoriesPanelUtils'
import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { Button, IconButton } from '../ui'

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

      {!category.is_active && (
        <span className="transaction-category-status transaction-category-status-inactive">
          Inactive
        </span>
      )}

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
          <IconButton icon={Pencil} size="md" label="Rename" onClick={() => onStartEditing(category)} />
        )}

        <IconButton
          icon={category.is_active ? EyeOff : Eye}
          size="md"
          label={category.is_active ? 'Disable' : 'Enable'}
          onClick={() => onToggle(category)}
        />

        <IconButton icon={Trash2} size="md" variant="danger" label="Delete" onClick={() => onDelete(category)} />
      </div>
    </article>
  )
}
