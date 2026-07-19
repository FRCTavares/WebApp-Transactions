import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionCategoriesPanel } from '../src/components/categories/TransactionCategoriesPanel'

const mocks = vi.hoisted(() => ({
  listTransactionCategories: vi.fn(),
  getTransactionCategoryUsage: vi.fn(),
  replaceAndDeleteTransactionCategory: vi.fn(),
  deleteTransactionCategory: vi.fn(),
}))

vi.mock('../src/api/transactionCategories', () => ({
  applyTransactionCategoryMigration: vi.fn(),
  createTransactionCategory: vi.fn(),
  deleteTransactionCategory: mocks.deleteTransactionCategory,
  getTransactionCategoryMigrationPreview: vi.fn(),
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

describe('category deletion with linked transactions', () => {
  beforeEach(() => {
    mocks.listTransactionCategories.mockReset().mockResolvedValue([EXPENSE_CATEGORY])
    mocks.getTransactionCategoryUsage.mockReset().mockResolvedValue({
      transaction_count: 3,
    })
    mocks.replaceAndDeleteTransactionCategory.mockReset()
    mocks.deleteTransactionCategory.mockReset()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('opens the replacement dialog when the category has linked transactions', async () => {
    const user = userEvent.setup()
    render(<TransactionCategoriesPanel />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(
      await screen.findByRole('dialog', { name: 'Replace “Groceries”' }),
    ).toBeInTheDocument()
    expect(mocks.deleteTransactionCategory).not.toHaveBeenCalled()
  })

  it('closes the replacement dialog on Escape without replacing anything', async () => {
    const user = userEvent.setup()
    render(<TransactionCategoriesPanel />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Replace “Groceries”',
    })

    await user.keyboard('{Escape}')

    expect(dialog).not.toBeInTheDocument()
    expect(mocks.replaceAndDeleteTransactionCategory).not.toHaveBeenCalled()
  })
})
