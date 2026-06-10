import type { FormEvent } from 'react'
import { CategorySelect } from './CategorySelect'
import type { Direction } from '../types/api'

export type MatchField = 'description' | 'raw_description' | 'merchant'

export type RuleFormState = {
  name: string
  category: string
  subcategory: string
  match_text: string
  match_field: MatchField
  direction: Direction | ''
  source: string
  is_active: boolean
}

const SOURCE_OPTIONS = [
  '',
  'manual',
  'revolut',
  'activobank',
  'trading212',
]

type CategoryRuleFormProps = {
  form: RuleFormState
  submitLabel: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (field: keyof RuleFormState, value: string | boolean) => void
  onCancel?: () => void
  onClear?: () => void
  editingRuleId?: number
}

export function CategoryRuleForm({
  form,
  submitLabel,
  onSubmit,
  onChange,
  onCancel,
  onClear,
  editingRuleId,
}: CategoryRuleFormProps) {
  return (
    <form className="filter-panel" onSubmit={onSubmit}>
      {editingRuleId !== undefined && (
        <p className="muted small">
          Editing rule #{editingRuleId}
        </p>
      )}

      <div className="form-grid">
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder="Auchan groceries"
          />
        </label>

        <CategorySelect
          label="Category"
          value={form.category}
          onChange={(category) => onChange('category', category)}
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
          Match text
          <input
            value={form.match_text}
            onChange={(event) => onChange('match_text', event.target.value)}
            placeholder="AUCHAN"
          />
        </label>

        <label>
          Match field
          <select
            value={form.match_field}
            onChange={(event) => onChange('match_field', event.target.value as MatchField)}
          >
            <option value="description">description</option>
            <option value="raw_description">raw_description</option>
            <option value="merchant">merchant</option>
          </select>
        </label>

        <label>
          Direction
          <select
            value={form.direction}
            onChange={(event) => onChange('direction', event.target.value as Direction | '')}
          >
            <option value="">Any</option>
            <option value="in">in</option>
            <option value="out">out</option>
          </select>
        </label>

        <label>
          Source
          <select
            value={form.source}
            onChange={(event) => onChange('source', event.target.value)}
          >
            {SOURCE_OPTIONS.map((source) => (
              <option key={source || 'any'} value={source}>
                {source || 'Any'}
              </option>
            ))}
          </select>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => onChange('is_active', event.target.checked)}
          />
          Active
        </label>
      </div>

      <div className="toolbar">
        <button type="submit">{submitLabel}</button>

        {onClear && (
          <button type="button" onClick={onClear}>
            Clear
          </button>
        )}

        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
