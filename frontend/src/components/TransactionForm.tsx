import type { FormEvent } from 'react'
import { CategorySelect } from './CategorySelect'
import type { Direction } from '../types/api'

export type TransactionFormState = {
  date: string
  description: string
  amount: string
  category: string
  subcategory: string
  notes: string
}

type TransactionFormProps = {
  title: string
  form: TransactionFormState
  submitLabel: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (field: keyof TransactionFormState, value: string) => void
  direction?: Direction
  editingTransactionId?: number
  onCancel?: () => void
}

export function TransactionForm({
  title,
  form,
  submitLabel,
  onSubmit,
  onChange,
  direction,
  editingTransactionId,
  onCancel,
}: TransactionFormProps) {
  return (
    <form className="manual-form" onSubmit={onSubmit}>
      <h2>{title}</h2>

      {editingTransactionId !== undefined && (
        <p className="muted small">
          Editing transaction #{editingTransactionId}
        </p>
      )}

      <div className="form-row">
        <label>
          Date
          <input
            type="date"
            value={form.date}
            onChange={(event) => onChange('date', event.target.value)}
          />
        </label>

        <label>
          Description
          <input
            value={form.description}
            onChange={(event) => onChange('description', event.target.value)}
            placeholder="Description"
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
            placeholder="0.00"
          />
        </label>
      </div>

      <div className="form-row">
        <CategorySelect
          label="Category"
          value={form.category}
          onChange={(value) => onChange('category', value)}
        />

        <label>
          Subcategory
          <input
            value={form.subcategory}
            onChange={(event) => onChange('subcategory', event.target.value)}
            placeholder="Optional"
          />
        </label>

        <label>
          Notes
          <input
            value={form.notes}
            onChange={(event) => onChange('notes', event.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>

      <div className="action-group">
        <button type="submit">
          {direction ? `${submitLabel} ${direction === 'in' ? 'Money In' : 'Money Out'}` : submitLabel}
        </button>

        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
