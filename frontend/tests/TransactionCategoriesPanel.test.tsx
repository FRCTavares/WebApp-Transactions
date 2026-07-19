import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionCategoriesPanel } from '../src/components/categories/TransactionCategoriesPanel'

const mocks = vi.hoisted(() => ({
  listTransactionCategories: vi.fn(),
  getTransactionCategoryUsage: vi.fn(),
  getTransactionCategoryMigrationPreview: vi.fn(),
  applyTransactionCategoryMigration: vi.fn(),
  replaceAndDeleteTransactionCategory: vi.fn(),
  deleteTransactionCategory: vi.fn(),
}))

vi.mock('../src/api/transactionCategories', () => ({
  applyTransactionCategoryMigration: mocks.applyTransactionCategoryMigration,
  createTransactionCategory: vi.fn(),
  deleteTransactionCategory: mocks.deleteTransactionCategory,
  getTransactionCategoryMigrationPreview: mocks.getTransactionCategoryMigrationPreview,
  getTransactionCategoryUsage: mocks.getTransactionCategoryUsage,
  listTransactionCategories: mocks.listTransactionCategories,
  replaceAndDeleteTransactionCategory: mocks.replaceAndDeleteTransactionCategory,
  updateTransactionCategory: vi.fn(),
}))

const EXPENSE_CATEGORY = {
  id: 1,
  name: 'Groceries',
  direction: 'out' as const,
  cashflow_type: 'expense' as const,
  is_active: true,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const REPLACEMENT_CATEGORY = {
  ...EXPENSE_CATEGORY,
  id: 2,
  name: 'Eating Out',
}

describe('category deletion with linked transactions', () => {
  function getGroceriesRow() {
    return screen.getByText('Groceries').closest('article') as HTMLElement
  }

  beforeEach(() => {
    mocks.listTransactionCategories.mockReset().mockResolvedValue([
      EXPENSE_CATEGORY,
      REPLACEMENT_CATEGORY,
    ])
    mocks.getTransactionCategoryUsage.mockReset().mockResolvedValue({
      transaction_count: 3,
    })
    mocks.getTransactionCategoryMigrationPreview.mockReset()
    mocks.applyTransactionCategoryMigration.mockReset()
    mocks.replaceAndDeleteTransactionCategory.mockReset()
    mocks.deleteTransactionCategory.mockReset()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('opens the replacement dialog when the category has linked transactions', async () => {
    const user = userEvent.setup()
    render(<TransactionCategoriesPanel />)

    await screen.findByText('Groceries')
    await user.click(within(getGroceriesRow()).getByRole('button', { name: 'Delete' }))

    expect(
      await screen.findByRole('dialog', { name: 'Replace “Groceries”' }),
    ).toBeInTheDocument()
    expect(mocks.deleteTransactionCategory).not.toHaveBeenCalled()
  })

  it('closes the replacement dialog on Escape without replacing anything', async () => {
    const user = userEvent.setup()
    render(<TransactionCategoriesPanel />)

    await screen.findByText('Groceries')
    await user.click(within(getGroceriesRow()).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Replace “Groceries”',
    })

    await user.keyboard('{Escape}')

    expect(dialog).not.toBeInTheDocument()
    expect(mocks.replaceAndDeleteTransactionCategory).not.toHaveBeenCalled()
  })

  it('opens the migration review dialog for individual reassignment', async () => {
    mocks.getTransactionCategoryMigrationPreview.mockResolvedValue({
      category: EXPENSE_CATEGORY,
      transactions: [
        {
          id: 101,
          date: '2026-07-01',
          description: 'Corner shop',
          raw_description: 'CORNER SHOP LDA',
          merchant: null,
          source: 'manual',
          account: null,
          amount: '12.00',
          currency: 'EUR',
        },
      ],
      replacement_categories: [REPLACEMENT_CATEGORY],
    })

    const user = userEvent.setup()
    render(<TransactionCategoriesPanel />)

    await screen.findByText('Groceries')
    await user.click(within(getGroceriesRow()).getByRole('button', { name: 'Delete' }))
    await screen.findByRole('dialog', { name: 'Replace “Groceries”' })

    await user.click(screen.getByRole('button', { name: 'Review individually' }))

    expect(
      await screen.findByRole('dialog', { name: 'Reassign “Groceries”' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Corner shop')).toBeInTheDocument()
    expect(mocks.applyTransactionCategoryMigration).not.toHaveBeenCalled()
  })

  it('closes the migration review dialog on Escape without applying anything', async () => {
    mocks.getTransactionCategoryMigrationPreview.mockResolvedValue({
      category: EXPENSE_CATEGORY,
      transactions: [],
      replacement_categories: [REPLACEMENT_CATEGORY],
    })

    const user = userEvent.setup()
    render(<TransactionCategoriesPanel />)

    await screen.findByText('Groceries')
    await user.click(within(getGroceriesRow()).getByRole('button', { name: 'Delete' }))
    await screen.findByRole('dialog', { name: 'Replace “Groceries”' })
    await user.click(screen.getByRole('button', { name: 'Review individually' }))

    const dialog = await screen.findByRole('dialog', {
      name: 'Reassign “Groceries”',
    })

    await user.keyboard('{Escape}')

    expect(dialog).not.toBeInTheDocument()
    expect(mocks.applyTransactionCategoryMigration).not.toHaveBeenCalled()
  })
})
