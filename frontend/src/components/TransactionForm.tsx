import { useState, type FormEvent, type ReactNode } from 'react'
import { CategorySelect } from './CategorySelect'
import type { CashflowType, Direction } from '../types/api'

export type TransactionFormState = {
  date: string
  description: string
  amount: string
  cashflow_type: CashflowType
  category: string
  notes: string
}

type CashflowTypeOption = {
  value: CashflowType
  label: string
}

function getCashflowTypeOptions(direction?: Direction): CashflowTypeOption[] {
  if (direction === 'in') {
    return [
      { value: 'income', label: 'Income' },
      { value: 'transfer', label: 'Transfer' },
    ]
  }

  if (direction === 'out') {
    return [
      { value: 'expense', label: 'Expense' },
      { value: 'transfer', label: 'Transfer' },
    ]
  }

  return [
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
    { value: 'transfer', label: 'Transfer' },
  ]
}

type TransactionFormProps = {
  title: string
  form: TransactionFormState
  submitLabel: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (field: keyof TransactionFormState, value: string) => void
  children?: ReactNode
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
  children,
  direction,
  editingTransactionId,
  onCancel,
}: TransactionFormProps) {
  const [isMoreDetailsOpen, setIsMoreDetailsOpen] = useState(
    editingTransactionId !== undefined,
  )

  return (
    <form
      className={`manual-form transaction-form ${isMoreDetailsOpen ? 'transaction-form-more-open' : ''}`}
      onSubmit={onSubmit}
    >
      <h2>{title}</h2>

      {editingTransactionId !== undefined && (
        <p className="muted small">
          Editing transaction #{editingTransactionId}
        </p>
      )}

      <div className="form-row transaction-form-primary-fields">
        <label className="transaction-form-amount-field">
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

        <label>
          Description
          <input
            value={form.description}
            onChange={(event) => onChange('description', event.target.value)}
            placeholder="Description"
          />
        </label>

        <CategorySelect
          label="Category"
          value={form.category}
          onChange={(value) => onChange('category', value)}
        />
      </div>

      <button
        type="button"
        className="transaction-form-more-toggle"
        onClick={() => setIsMoreDetailsOpen((isOpen) => !isOpen)}
      >
        {isMoreDetailsOpen ? 'Hide details' : 'More details'}
      </button>

      <div className="transaction-form-secondary-fields">
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
            Cashflow
            <select
              value={form.cashflow_type}
              onChange={(event) => onChange('cashflow_type', event.target.value)}
            >
              {getCashflowTypeOptions(direction).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            Notes
            <input
              value={form.notes}
              onChange={(event) => onChange('notes', event.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
      </div>

      {children}

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
