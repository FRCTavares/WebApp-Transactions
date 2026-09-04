import type { ReactNode } from 'react'
import { Button } from '../ui'

/** Owned here rather than by the table, so the form has no cycle back to it. */
export type OwedFormState = {
  person: string
  reason: string
  amountTotal: string
  amountPaid: string
  dueDate: string
  linkedTransactionId: string
  notes: string
}

export type OwedInlineFormProps = {
  form: OwedFormState
  people: string[]
  onChange: (field: keyof OwedFormState, value: string) => void
  onSave: () => void
  onCancel: () => void
  /** Prefixes every accessible name so the create and edit forms stay distinct. */
  labelPrefix?: string
  /** Rendered beside the status field - a Badge when editing, plain text when creating. */
  status: ReactNode
  saveLabel?: string
}

/**
 * The form renders in a page-level editor panel rather than a table row or
 * secondary dialog. A responsive grid keeps every field and both actions
 * reachable while the owed-item list remains visible and scrollable.
 */
export function OwedInlineForm({
  form,
  people,
  onChange,
  onSave,
  onCancel,
  labelPrefix = '',
  status,
  saveLabel = 'Save',
}: OwedInlineFormProps) {
  const label = (text: string) => (labelPrefix ? `${labelPrefix} ${text}` : text)

  return (
    <div className="owed-inline-form">
      <div className="owed-inline-form-grid">
        <label className="owed-inline-field">
          <span>Person</span>
          <input
            className="table-input"
            value={form.person}
            onChange={(event) => onChange('person', event.target.value)}
            placeholder="Person"
            aria-label={label('Person owing')}
            list="owed-person-suggestions"
          />
          <datalist id="owed-person-suggestions">
            {people.map((person) => <option key={person} value={person} />)}
          </datalist>
        </label>

        <label className="owed-inline-field">
          <span>Description</span>
          <input
            className="table-input"
            value={form.reason}
            onChange={(event) => onChange('reason', event.target.value)}
            placeholder="Description"
            aria-label={label('Description')}
          />
        </label>

        <label className="owed-inline-field">
          <span>Total</span>
          <input
            className="table-input right"
            type="number"
            min="0"
            step="0.01"
            value={form.amountTotal}
            onChange={(event) => onChange('amountTotal', event.target.value)}
            placeholder="0.00"
            aria-label={label('Total amount')}
          />
        </label>

        <label className="owed-inline-field">
          <span>Already paid</span>
          <input
            className="table-input right"
            type="number"
            min="0"
            step="0.01"
            value={form.amountPaid}
            onChange={(event) => onChange('amountPaid', event.target.value)}
            placeholder="0.00"
            aria-label={label('Amount already paid')}
          />
        </label>

        <label className="owed-inline-field">
          <span>Due date</span>
          <input
            className="table-input"
            type="date"
            value={form.dueDate}
            onChange={(event) => onChange('dueDate', event.target.value)}
            aria-label={label('Due date')}
          />
        </label>

        <div className="owed-inline-field">
          <span>Status</span>
          <div className="owed-inline-status">{status}</div>
        </div>

        <label className="owed-inline-field owed-inline-field-wide">
          <span>Notes</span>
          <input
            className="table-input"
            value={form.notes}
            onChange={(event) => onChange('notes', event.target.value)}
            placeholder="Notes"
            aria-label={label('Notes')}
          />
        </label>

        <label className="owed-inline-field">
          <span>Money Out transaction ID (optional)</span>
          <input
            className="table-input"
            type="number"
            min="1"
            step="1"
            value={form.linkedTransactionId}
            onChange={(event) => onChange('linkedTransactionId', event.target.value)}
            placeholder="Manual Tx ID"
            aria-label={label('Linked transaction ID')}
          />
        </label>
      </div>

      <div className="owed-inline-form-actions">
        <Button type="button" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
