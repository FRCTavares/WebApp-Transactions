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
import type { TransactionCategory } from '../../types/api'
import { CategoryMigrationReviewDialog } from './CategoryMigrationReviewDialog'
import { CategoryReplacementDialog } from './CategoryReplacementDialog'
import { CategoryCreateForm } from './CategoryCreateForm'
import { CategoryRow } from './CategoryRow'
import {
  INITIAL_FORM,
  getCategoryIdentity,
  getGroupValues,
  getRecommendedCategories,
  sortCategories,
  type CategoryFormState,
  type DisplayGroup,
} from '../../utils/transactionCategoriesPanelUtils'
import { Tags } from 'lucide-react'
import { Button, EmptyState } from '../ui'

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

  return (
    <div className="transaction-categories-layout">
      <CategoryCreateForm
        form={form}
        isBusy={isBusy}
        onNameChange={(name) => setForm((current) => ({ ...current, name }))}
        onGroupChange={(group) => setForm((current) => ({ ...current, group }))}
        onSubmit={handleCreate}
      />

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
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Start with a recommended set, then rename, disable, or remove anything you do not use."
          action={(
            <Button
              type="button"
              variant="primary"
              disabled={isBusy}
              onClick={handleAddRecommended}
            >
              Add recommended categories
            </Button>
          )}
        />
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
              <Button
                type="button"
                size="sm"
                disabled={isBusy}
                onClick={handleAddRecommended}
              >
                Add recommended
              </Button>
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
                      {group.categories.map((category) => (
                        <CategoryRow
                          key={category.id}
                          category={category}
                          isEditing={editingId === category.id}
                          editingName={editingName}
                          onEditingNameChange={setEditingName}
                          onStartEditing={startEditing}
                          onSaveName={handleSaveName}
                          onCancelEditing={cancelEditing}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                        />
                      ))}
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
