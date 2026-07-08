import { CategorySelect } from '../CategorySelect'
import type { TransactionFormState } from '../TransactionForm'
import type { TransactionTableRow } from '../TransactionTable'

type TransactionInlineEditRowProps = {
  transaction: TransactionTableRow
  form: TransactionFormState
  categoryOptions: string[]
  onChange: (field: keyof TransactionFormState, value: string) => void
  onSave: () => void
  onCancel: () => void
}

export function TransactionInlineEditRow({
  transaction,
  form,
  categoryOptions,
  onChange,
  onSave,
  onCancel,
}: TransactionInlineEditRowProps) {
  return (
    <tr key={transaction.id} className="inline-edit-row">
      <td>
        <input
          className="table-input"
          type="date"
          value={form.date}
          onChange={(event) => onChange('date', event.target.value)}
        />
      </td>
      <td>
        <input
          className="table-input"
          value={form.description}
          onChange={(event) => onChange('description', event.target.value)}
          placeholder="Description"
        />
        <input
          className="table-input table-input-secondary"
          value={form.notes}
          onChange={(event) => onChange('notes', event.target.value)}
          placeholder="Notes"
        />
      </td>
      <td>
        <select
          className="table-input"
          value={form.cashflow_type}
          onChange={(event) => onChange('cashflow_type', event.target.value)}
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </select>
      </td>
      <td>
        <CategorySelect
          value={form.category}
          onChange={(value) => onChange('category', value)}
          options={categoryOptions}
          placeholder="Category"
        />
      </td>
      <td>{transaction.source}</td>
      <td className="right">
        <input
          className="table-input right"
          type="number"
          min="0"
          step="0.01"
          value={form.amount}
          onChange={(event) => onChange('amount', event.target.value)}
          placeholder="0.00"
        />
      </td>
      <td className="actions-cell">
        <div className="table-action-group">
          <button type="button" className="primary-button" onClick={onSave}>
            Save
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}
