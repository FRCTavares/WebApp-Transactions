import { CategorySelect } from '../CategorySelect'
import type { TransactionFormState } from '../TransactionForm'
import type { Transaction } from '../../types/api'

type TransactionEditDialogProps = {
  transaction: Transaction
  form: TransactionFormState
  categoryOptions: string[]
  isSaving: boolean
  onChange: (field: keyof TransactionFormState, value: string) => void
  onSave: () => void
  onCancel: () => void
}

export function TransactionEditDialog({
  transaction,
  form,
  categoryOptions,
  isSaving,
  onChange,
  onSave,
  onCancel,
}: TransactionEditDialogProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave()
  }

  return (
    <div className="transaction-edit-dialog-backdrop" role="presentation">
      <form
        className="transaction-edit-dialog"
        aria-label={`Edit transaction ${transaction.description}`}
        onSubmit={handleSubmit}
      >
        <div className="transaction-edit-dialog-header">
          <div>
            <p className="eyebrow">Edit transaction</p>
            <h2>{transaction.description}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close edit dialog">
            ×
          </button>
        </div>

        <div className="transaction-edit-dialog-reference">
          <div>
            <span>Raw description</span>
            <strong>{transaction.raw_description || transaction.description}</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>{transaction.source || '-'}</strong>
          </div>
          <div>
            <span>Account</span>
            <strong>{transaction.account || '-'}</strong>
          </div>
        </div>

        <div className="transaction-edit-dialog-grid">
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(event) => onChange('date', event.target.value)}
            />
          </label>

          <label>
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => onChange('amount', event.target.value)}
            />
          </label>

          <label>
            Type
            <select
              value={form.cashflow_type}
              onChange={(event) => onChange('cashflow_type', event.target.value)}
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>

          <CategorySelect
            label="Category"
            value={form.category}
            onChange={(value) => onChange('category', value)}
            options={categoryOptions}
            placeholder="Category"
          />
        </div>

        <label className="transaction-edit-dialog-field-wide">
          Description
          <input
            value={form.description}
            onChange={(event) => onChange('description', event.target.value)}
            placeholder="Description"
          />
        </label>

        <label className="transaction-edit-dialog-field-wide">
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => onChange('notes', event.target.value)}
            placeholder="Optional notes"
            rows={3}
          />
        </label>

        <div className="transaction-edit-dialog-actions">
          <button type="button" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
