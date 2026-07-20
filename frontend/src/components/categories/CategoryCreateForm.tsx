import type { FormEvent } from 'react'
import type { CategoryFormState, CategoryGroup } from '../../utils/transactionCategoriesPanelUtils'

/**
 * The "Add a category" form card on `TransactionCategoriesPanel`. Split
 * out (which was approaching the project's 900-line soft limit) —
 * purely presentational, all state lives in the parent panel.
 */
export function CategoryCreateForm({
  form,
  isBusy,
  onNameChange,
  onGroupChange,
  onSubmit,
}: {
  form: CategoryFormState
  isBusy: boolean
  onNameChange: (value: string) => void
  onGroupChange: (value: CategoryGroup) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="transaction-category-create-card">
      <div className="transaction-category-create-copy">
        <h2>Add a category</h2>
        <p>
          Add only the categories you actually use.
        </p>
      </div>

      <form
        className="transaction-category-create-form"
        onSubmit={onSubmit}
      >
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. Groceries"
          />
        </label>

        <label>
          Used for
          <select
            value={form.group}
            onChange={(event) => onGroupChange(event.target.value as CategoryGroup)}
          >
            <option value="expense">Money Out</option>
            <option value="income">Money In</option>
            <option value="transfer_in">Transfer into account</option>
            <option value="transfer_out">Transfer out of account</option>
          </select>
        </label>

        <button
          type="submit"
          className="primary-button"
          disabled={isBusy}
        >
          Add category
        </button>
      </form>
    </section>
  )
}
