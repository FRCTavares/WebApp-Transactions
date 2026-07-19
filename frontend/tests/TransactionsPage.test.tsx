import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionsPage } from '../src/pages/TransactionsPage'

const mocks = vi.hoisted(() => ({
  createTransactionWithOwed: vi.fn(),
  deleteTransaction: vi.fn(),
  listTransactionCategories: vi.fn(),
  listTransactions: vi.fn(),
  updateTransaction: vi.fn(),
  listOwedItems: vi.fn(),
  listOwedPayments: vi.fn(),
  usePeriod: vi.fn(),
}))

vi.mock('../src/api/transactions', () => ({
  createOwedSplitForTransaction: vi.fn(),
  createTransactionWithOwed: mocks.createTransactionWithOwed,
  deleteTransaction: mocks.deleteTransaction,
  exportTransactionsCsv: vi.fn(),
  listTransactions: mocks.listTransactions,
  updateTransaction: mocks.updateTransaction,
}))

vi.mock('../src/api/transactionCategories', () => ({
  listTransactionCategories: mocks.listTransactionCategories,
}))

vi.mock('../src/api/owed', () => ({
  listOwedItems: mocks.listOwedItems,
  listOwedPayments: mocks.listOwedPayments,
}))

vi.mock('../src/hooks/usePeriod', () => ({
  usePeriod: mocks.usePeriod,
}))

const EXISTING_TRANSACTION = {
  id: 42,
  date: '2026-07-10',
  description: 'Grocery store',
  raw_description: 'GROCERY STORE LDA',
  amount: '30.00',
  direction: 'out' as const,
  cashflow_type: 'expense' as const,
  source: 'manual',
  account: null,
  category: 'Groceries',
  currency: 'EUR',
  notes: null,
  owed_amount_total: '0.00',
}

describe('transactions page workflows', () => {
  function renderPage() {
    return render(
      <BrowserRouter>
        <TransactionsPage />
      </BrowserRouter>,
    )
  }

  beforeEach(() => {
    mocks.createTransactionWithOwed.mockReset()
    mocks.deleteTransaction.mockReset()
    mocks.updateTransaction.mockReset()
    mocks.listOwedItems.mockReset().mockResolvedValue([])
    mocks.listOwedPayments.mockReset().mockResolvedValue([])
    mocks.listTransactionCategories.mockReset().mockResolvedValue([])
    mocks.listTransactions.mockReset().mockResolvedValue([EXISTING_TRANSACTION])
    mocks.usePeriod.mockReset().mockReturnValue({
      year: 2026,
      month: 7,
      monthKey: '2026-07',
      setPeriod: vi.fn(),
      setMonthKey: vi.fn(),
      shiftMonth: vi.fn(),
      resetToCurrentMonth: vi.fn(),
    })
  })

  it('creates a new transaction from the add form', async () => {
    mocks.createTransactionWithOwed.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '+ Add' }))
    await user.type(screen.getByLabelText('Amount'), '12.50')
    await user.type(screen.getByLabelText('Description'), 'New coffee shop')

    await user.click(screen.getByRole('button', { name: 'Save Money Out' }))

    await waitFor(() => {
      expect(mocks.createTransactionWithOwed).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            description: 'New coffee shop',
            amount: '12.50',
            direction: 'out',
          }),
        }),
      )
    })

    expect(await screen.findByText('Transaction created.')).toBeInTheDocument()
  })

  it('edits an existing transaction', async () => {
    mocks.updateTransaction.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    const dialog = await screen.findByRole('dialog', {
      name: /Edit transaction/,
    })

    const descriptionInput = screen.getByDisplayValue('Grocery store')
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Grocery store (updated)')

    await user.click(
      screen.getByRole('button', { name: 'Save changes' }),
    )

    await waitFor(() => {
      expect(mocks.updateTransaction).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ description: 'Grocery store (updated)' }),
      )
    })

    expect(dialog).not.toBeInTheDocument()
    expect(await screen.findByText('Transaction updated.')).toBeInTheDocument()
  })

  it('closes the edit dialog on Escape without saving', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', {
      name: /Edit transaction/,
    })

    await user.keyboard('{Escape}')

    expect(dialog).not.toBeInTheDocument()
    expect(mocks.updateTransaction).not.toHaveBeenCalled()
  })
})
