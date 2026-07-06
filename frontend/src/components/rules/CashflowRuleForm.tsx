import type { FormEvent } from 'react'
import type { CashflowType } from '../../types/api'

export type CashflowRuleFormState = {
  name: string
  cashflow_type: CashflowType
  match_text: string
  match_field: 'description' | 'raw_description' | 'merchant'
  direction: '' | 'in' | 'out'
  source: string
  is_active: boolean
}

type CashflowRuleFormProps = {
  form: CashflowRuleFormState
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (field: keyof CashflowRuleFormState, value: string | boolean) => void
  onClear: () => void
}

export function CashflowRuleForm({
  form,
  onSubmit,
  onChange,
  onClear,
}: CashflowRuleFormProps) {
  return (
    <form className="rule-form" onSubmit={onSubmit}>
      <div className="form-row">
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder="Trading 212 transfer"
          />
        </label>

        <label>
          Cashflow Type
          <select
            value={form.cashflow_type}
            onChange={(event) => onChange('cashflow_type', event.target.value)}
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
        </label>

        <label>
          Match Text
          <input
            value={form.match_text}
            onChange={(event) => onChange('match_text', event.target.value)}
            placeholder="Trading 212"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Match Field
          <select
            value={form.match_field}
            onChange={(event) => onChange('match_field', event.target.value)}
          >
            <option value="raw_description">Raw Description</option>
            <option value="description">Description</option>
            <option value="merchant">Merchant</option>
          </select>
        </label>

        <label>
          Direction
          <select
            value={form.direction}
            onChange={(event) => onChange('direction', event.target.value)}
          >
            <option value="">Any</option>
            <option value="in">In</option>
            <option value="out">Out</option>
          </select>
        </label>

        <label>
          Source
          <input
            value={form.source}
            onChange={(event) => onChange('source', event.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => onChange('is_active', event.target.checked)}
        />
        Active
      </label>

      <div className="action-group">
        <button type="submit">Create cashflow rule</button>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>
    </form>
  )
}
