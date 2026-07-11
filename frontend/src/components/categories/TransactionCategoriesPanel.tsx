import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  applyTransactionCategoryMigration,
  createTransactionCategory,
  deleteTransactionCategory,
  getTransactionCategoryMigrationPreview,
  getTransactionCategoryUsage,
  listTransactionCategories,
  replaceAndDeleteTransactionCategory,
  updateTransactionCategory,
  type TransactionCategoryMigrationApplyPayload,
  type TransactionCategoryMigrationPreview,
  type TransactionCategoryUsage,
} from '../../api/transactionCategories'
import {
  EXPENSE_CATEGORY_OPTIONS,
  INCOME_CATEGORY_OPTIONS,
  TRANSFER_CATEGORY_OPTIONS,
} from '../../constants/categories'
import type {
  CashflowType,
  Direction,
  TransactionCategory,
} from '../../types/api'
import { CategoryMigrationReviewDialog } from './CategoryMigrationReviewDialog'
import { CategoryReplacementDialog } from './CategoryReplacementDialog'

type CategoryGroup =
  | 'expense'
  | 'income'
  | 'transfer_in'
  | 'transfer_out'

type CategoryFormState = {
  name: string
  group: CategoryGroup
}

type DisplayGroup = {
  key: 'expense' | 'income' | 'transfer'
  title: string
  description: string
  categories: TransactionCategory[]
}

const INITIAL_FORM: CategoryFormState = {
  name: '',
  group: 'expense',
}

function getCategoryIdentity(
  name: string,
  direction: Direction,
  cashflowType: CashflowType,
) {
  return `${name.trim().toLowerCase()}|${direction}|${cashflowType}`
}

function getGroupValues(group: CategoryGroup): {
  direction: Direction
  cashflowType: CashflowType
} {
  if (group === 'income') {
    return {
      direction: 'in',
      cashflowType: 'income',
    }
  }

  if (group === 'transfer_in') {
    return {
      direction: 'in',
      cashflowType: 'transfer',
    }
  }

  if (group === 'transfer_out') {
    return {
      direction: 'out',
      cashflowType: 'transfer',
    }
  }

  return {
    direction: 'out',
    cashflowType: 'expense',
  }
}

function getRecommendedCategories() {
  return [
    ...EXPENSE_CATEGORY_OPTIONS.map((name, index) => ({
      name,
      direction: 'out' as const,
      cashflow_type: 'expense' as const,
      sort_order: index,
    })),
    ...INCOME_CATEGORY_OPTIONS.map((name, index) => ({
      name,
      direction: 'in' as const,
      cashflow_type: 'income' as const,
      sort_order: index,
    })),
    ...TRANSFER_CATEGORY_OPTIONS.flatMap((name, index) => [
      {
        name,
        direction: 'in' as const,
        cashflow_type: 'transfer' as const,
        sort_order: index,
      },
      {
        name,
        direction: 'out' as const,
        cashflow_type: 'transfer' as const,
        sort_order: index,
      },
    ]),
  ]
}

function sortCategories(categories: TransactionCategory[]) {
  return [...categories].sort(
    (first, second) =>
      Number(second.is_active) - Number(first.is_active) ||
      first.sort_order - second.sort_order ||
      first.name.localeCompare(second.name),
  )
}

function getTransferDirectionLabel(category: TransactionCategory) {
  return category.direction === 'in' ? 'Into account' : 'Out of account'
}

export function TransactionCategoriesPanel() {
  const [categories, setCategories] = useState<TransactionCategory[]>([])
  const [form, setForm] = useState<CategoryFormState>(INITIAL_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [replacementCategory, setReplacementCategory] =
    useState<TransactionCategory | null>(null)
  const [replacementUsage, setReplacementUsage] =
    useState<TransactionCategoryUsage | null>(null)
  const [isReplacingCategory, setIsReplacingCategory] =
    useState(false)
  const [migrationPreview, setMigrationPreview] =
    useState<TransactionCategoryMigrationPreview | null>(null)
  const [isLoadingMigration, setIsLoadingMigration] =
    useState(false)
  const [isApplyingMigration, setIsApplyingMigration] =
    useState(false)

  const activeCount = useMemo(
    () => categories.filter((category) => category.is_active).length,
    [categories],
  )

  const displayGroups = useMemo<DisplayGroup[]>(
    () => [
      {
        key: 'expense',
        title: 'Money Out',
        description: 'Normal spending and expense categories.',
        categories: sortCategories(
          categories.filter(
            (category) =>
              category.direction === 'out' &&
              category.cashflow_type === 'expense',
          ),
        ),
      },
      {
        key: 'income',
        title: 'Money In',
        description: 'Income and incoming money categories.',
        categories: sortCategories(
          categories.filter(
            (category) =>
              category.direction === 'in' &&
              category.cashflow_type === 'income',
          ),
        ),
      },
      {
        key: 'transfer',
        title: 'Transfers',
        description: 'Movements between accounts and investments.',
        categories: sortCategories(
          categories.filter(
            (category) => category.cashflow_type === 'transfer',
          ),
        ),
      },
    ],
    [categories],
  )

  function loadCategories() {
    listTransactionCategories({ limit: 500 })
      .then(setCategories)
      .catch((caughtError: unknown) => {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load categories',
        )
      })
  }

  useEffect(() => {
    loadCategories()
  }, [])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = form.name.trim()

    if (!name) {
      setError('Category name is required.')
      return
    }

    const groupValues = getGroupValues(form.group)

    setError(null)
    setMessage(null)
    setIsBusy(true)

    try {
      await createTransactionCategory({
        name,
        direction: groupValues.direction,
        cashflow_type: groupValues.cashflowType,
        is_active: true,
      })

      setForm((current) => ({
        ...current,
        name: '',
      }))
      setMessage('Category created.')
      loadCategories()
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to create category',
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function handleAddRecommended() {
    const existing = new Set(
      categories.map((category) =>
        getCategoryIdentity(
          category.name,
          category.direction,
          category.cashflow_type,
        ),
      ),
    )

    const missing = getRecommendedCategories().filter(
      (category) =>
        !existing.has(
          getCategoryIdentity(
            category.name,
            category.direction,
            category.cashflow_type,
          ),
        ),
    )

    if (missing.length === 0) {
      setMessage('All recommended categories already exist.')
      setError(null)
      return
    }

    setError(null)
    setMessage(null)
    setIsBusy(true)

    try {
      await Promise.all(
        missing.map((category) =>
          createTransactionCategory({
            ...category,
            is_active: true,
          }),
        ),
      )

      setMessage(`${missing.length} recommended categories added.`)
      loadCategories()
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to add recommended categories',
      )
      loadCategories()
    } finally {
      setIsBusy(false)
    }
  }

  async function handleToggle(category: TransactionCategory) {
    setError(null)
    setMessage(null)

    try {
      await updateTransactionCategory(category.id, {
        is_active: !category.is_active,
      })

      setMessage(
        category.is_active
          ? 'Category disabled.'
          : 'Category enabled.',
      )
      loadCategories()
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to update category',
      )
    }
  }

  function startEditing(category: TransactionCategory) {
    setEditingId(category.id)
    setEditingName(category.name)
    setError(null)
    setMessage(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingName('')
  }

  async function handleSaveName(category: TransactionCategory) {
    const name = editingName.trim()

    if (!name) {
      setError('Category name is required.')
      return
    }

    setError(null)
    setMessage(null)

    try {
      await updateTransactionCategory(category.id, { name })
      cancelEditing()
      setMessage('Category renamed.')
      loadCategories()
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to rename category',
      )
    }
  }

  async function handleDelete(category: TransactionCategory) {
    setError(null)
    setMessage(null)

    try {
      const usage = await getTransactionCategoryUsage(category.id)
      if (usage.transaction_count > 0) {
        setReplacementCategory(category)
        setReplacementUsage(usage)
        return
      }

      const confirmed = window.confirm(
        `Delete category "${category.name}"?`,
      )

      if (!confirmed) {
        return
      }

      await deleteTransactionCategory(category.id)

      if (editingId === category.id) {
        cancelEditing()
      }

      setMessage('Category deleted.')
      loadCategories()
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to inspect or delete category',
      )
    }
  }

  function closeReplacementDialog() {
    if (isReplacingCategory) {
      return
    }

    setReplacementCategory(null)
    setReplacementUsage(null)
  }

  async function handleReviewIndividually() {
    if (!replacementCategory) {
      return
    }

    setError(null)
    setIsLoadingMigration(true)

    try {
      const preview =
        await getTransactionCategoryMigrationPreview(
          replacementCategory.id,
        )

      setMigrationPreview(preview)
      setReplacementCategory(null)
      setReplacementUsage(null)
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to load category migration review',
      )
    } finally {
      setIsLoadingMigration(false)
    }
  }

  function closeMigrationReview() {
    if (isApplyingMigration) {
      return
    }

    setMigrationPreview(null)
  }

  async function handleApplyMigration(
    payload: TransactionCategoryMigrationApplyPayload,
  ) {
    if (!migrationPreview) {
      return
    }

    setError(null)
    setMessage(null)
    setIsApplyingMigration(true)

    try {
      const result = await applyTransactionCategoryMigration(
        migrationPreview.category.id,
        payload,
      )

      setMigrationPreview(null)
      setMessage(
        `${result.transactions_updated} ${
          result.transactions_updated === 1
            ? 'transaction was'
            : 'transactions were'
        } reassigned and the category was deleted.`,
      )
      loadCategories()
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to apply category migration',
      )
    } finally {
      setIsApplyingMigration(false)
    }
  }

  async function handleReplaceAndDelete(
    replacementCategoryId: number,
  ) {
    if (!replacementCategory) {
      return
    }

    setError(null)
    setMessage(null)
    setIsReplacingCategory(true)

    try {
      const result = await replaceAndDeleteTransactionCategory(
        replacementCategory.id,
        replacementCategoryId,
      )

      const replacement = categories.find(
        (category) => category.id === replacementCategoryId,
      )

      if (editingId === replacementCategory.id) {
        cancelEditing()
      }

      setReplacementCategory(null)
      setReplacementUsage(null)
      setMessage(
        `${result.transactions_updated} ${
          result.transactions_updated === 1
            ? 'transaction was'
            : 'transactions were'
        } moved to ${replacement?.name ?? 'the replacement category'}.`,
      )
      loadCategories()
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to replace and delete category',
      )
    } finally {
      setIsReplacingCategory(false)
    }
  }

  function renderCategoryRow(category: TransactionCategory) {
    const isEditing = editingId === category.id
    const isTransfer = category.cashflow_type === 'transfer'

    return (
      <article
        key={category.id}
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
              onChange={(event) =>
                setEditingName(event.target.value)
              }
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
              <button
                type="button"
                className="transaction-category-action"
                onClick={() => handleSaveName(category)}
              >
                Save
              </button>
              <button
                type="button"
                className="transaction-category-action"
                onClick={cancelEditing}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="transaction-category-action"
              onClick={() => startEditing(category)}
            >
              Rename
            </button>
          )}

          <button
            type="button"
            className="transaction-category-action"
            onClick={() => handleToggle(category)}
          >
            {category.is_active ? 'Disable' : 'Enable'}
          </button>

          <button
            type="button"
            className="transaction-category-action transaction-category-action-danger"
            onClick={() => handleDelete(category)}
          >
            Delete
          </button>
        </div>
      </article>
    )
  }

  return (
    <div className="transaction-categories-layout">
      <section className="transaction-category-create-card">
        <div className="transaction-category-create-copy">
          <h2>Add a category</h2>
          <p>
            Add only the categories you actually use.
          </p>
        </div>

        <form
          className="transaction-category-create-form"
          onSubmit={handleCreate}
        >
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="e.g. Groceries"
            />
          </label>

          <label>
            Used for
            <select
              value={form.group}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  group: event.target.value as CategoryGroup,
                }))
              }
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

      {error && (
        <p className="transaction-category-message error-text">
          {error}
        </p>
      )}

      {message && (
        <p className="transaction-category-message success-text">
          {message}
        </p>
      )}

      {categories.length === 0 ? (
        <section className="transaction-category-empty-state">
          <div className="transaction-category-empty-icon" aria-hidden="true">
            +
          </div>

          <div>
            <h2>No categories yet</h2>
            <p>
              Start with a recommended set, then rename, disable, or
              remove anything you do not use.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            disabled={isBusy}
            onClick={handleAddRecommended}
          >
            Add recommended categories
          </button>
        </section>
      ) : (
        <section className="transaction-category-groups">
          <header className="transaction-category-groups-header">
            <div>
              <h2>Your categories</h2>
              <p>
                Disabled categories stay on historical transactions but
                disappear from new forms and filters.
              </p>
            </div>

            <div className="transaction-category-groups-summary">
              <span>{activeCount} active</span>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleAddRecommended}
              >
                Add recommended
              </button>
            </div>
          </header>

          <div className="transaction-category-group-grid">
            {displayGroups.map((group) => {
              const groupActiveCount = group.categories.filter(
                (category) => category.is_active,
              ).length

              return (
                <section
                  key={group.key}
                  className="transaction-category-group"
                >
                  <header className="transaction-category-group-header">
                    <div>
                      <h3>{group.title}</h3>
                      <p>{group.description}</p>
                    </div>

                    <span>
                      {groupActiveCount} active
                    </span>
                  </header>

                  {group.categories.length === 0 ? (
                    <p className="transaction-category-group-empty">
                      No categories in this group.
                    </p>
                  ) : (
                    <div className="transaction-category-list">
                      {group.categories.map(renderCategoryRow)}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </section>
      )}

      {replacementCategory && replacementUsage && (
        <CategoryReplacementDialog
          category={replacementCategory}
          categories={categories}
          usage={replacementUsage}
          isSubmitting={
            isReplacingCategory || isLoadingMigration
          }
          onCancel={closeReplacementDialog}
          onConfirm={handleReplaceAndDelete}
          onReview={handleReviewIndividually}
        />
      )}

      {migrationPreview && (
        <CategoryMigrationReviewDialog
          preview={migrationPreview}
          isSubmitting={isApplyingMigration}
          onCancel={closeMigrationReview}
          onSubmit={handleApplyMigration}
        />
      )}
    </div>
  )
}
