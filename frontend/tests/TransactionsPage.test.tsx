import {
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionsPage } from '../src/pages/TransactionsPage'

const mocks = vi.hoisted(() => ({
  createOwedSplitForTransaction: vi.fn(),
  createTransactionWithOwed: vi.fn(),
  deleteTransaction: vi.fn(),
  deleteTransactionWithLinkedOwed: vi.fn(),
  getTransactionDeletionPreview: vi.fn(),
  listTransactionCategories: vi.fn(),
  listTransactions: vi.fn(),
  updateTransaction: vi.fn(),
  listOwedItems: vi.fn(),
  listOwedPayments: vi.fn(),
  usePeriod: vi.fn(),
}))

vi.mock('../src/api/transactions', () => ({
  createOwedSplitForTransaction:
    mocks.createOwedSplitForTransaction,
  createTransactionWithOwed:
    mocks.createTransactionWithOwed,
  deleteTransaction: mocks.deleteTransaction,
  deleteTransactionWithLinkedOwed:
    mocks.deleteTransactionWithLinkedOwed,
  exportTransactionsCsv: vi.fn(),
  getTransactionDeletionPreview:
    mocks.getTransactionDeletionPreview,
  listTransactions: mocks.listTransactions,
  updateTransaction: mocks.updateTransaction,
}))

vi.mock('../src/api/transactionCategories', () => ({
  listTransactionCategories:
    mocks.listTransactionCategories,
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

const UNLINKED_DELETE_PREVIEW = {
  transaction_id: 42,
  normal_delete_allowed: true,
  normal_delete_block_reason: null,
  has_linked_owed: false,
  linked_owed_payment_count: 0,
  linked_owed_items: [],
  available_replacement_people: [],
  delete_with_owed_allowed: false,
  delete_with_owed_block_reason: null,
  preserve_owed_allowed: false,
  preserve_owed_block_reason: null,
  relationship_version: 'a'.repeat(64),
}

const LINKED_DELETE_PREVIEW = {
  transaction_id: 42,
  normal_delete_allowed: false,
  normal_delete_block_reason:
    'Transaction has linked owed obligations.',
  has_linked_owed: true,
  linked_owed_payment_count: 0,
  linked_owed_items: [
    {
      id: 7,
      person: 'Alice',
      amount_total: '20.00',
      amount_paid: '0.00',
      amount_remaining: '20.00',
      status: 'open',
      allocation_count: 0,
      deleted: false,
    },
  ],
  available_replacement_people: ['Alice', 'Bob'],
  delete_with_owed_allowed: true,
  delete_with_owed_block_reason: null,
  preserve_owed_allowed: true,
  preserve_owed_block_reason: null,
  relationship_version: 'b'.repeat(64),
}

const PARTIALLY_PAID_DELETE_PREVIEW = {
  ...LINKED_DELETE_PREVIEW,
  linked_owed_items: [
    {
      ...LINKED_DELETE_PREVIEW.linked_owed_items[0],
      amount_paid: '5.00',
      amount_remaining: '15.00',
      status: 'partially_paid',
      allocation_count: 1,
    },
  ],
  delete_with_owed_allowed: false,
  delete_with_owed_block_reason:
    'Paid or partially paid obligations must be preserved.',
  relationship_version: 'c'.repeat(64),
}


const LINKED_PAYMENT_DELETE_PREVIEW = {
  transaction_id: 42,
  normal_delete_allowed: false,
  normal_delete_block_reason:
    'Transaction has linked owed payment records.',
  has_linked_owed: false,
  linked_owed_payment_count: 1,
  linked_owed_items: [],
  available_replacement_people: ['Alice'],
  delete_with_owed_allowed: false,
  delete_with_owed_block_reason:
    'Transactions with linked owed payment records cannot use the owed-obligation deletion command.',
  preserve_owed_allowed: false,
  preserve_owed_block_reason:
    'Transactions with linked owed payment records cannot use the owed-obligation deletion command.',
  relationship_version: 'd'.repeat(64),
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
    mocks.createOwedSplitForTransaction.mockReset()
    mocks.createTransactionWithOwed.mockReset()
    mocks.deleteTransaction.mockReset()
    mocks.deleteTransactionWithLinkedOwed.mockReset()
    mocks.getTransactionDeletionPreview
      .mockReset()
      .mockResolvedValue(UNLINKED_DELETE_PREVIEW)
    mocks.updateTransaction.mockReset()
    mocks.listOwedItems.mockReset().mockResolvedValue([])
    mocks.listOwedPayments.mockReset().mockResolvedValue([])
    mocks.listTransactionCategories
      .mockReset()
      .mockResolvedValue([])
    mocks.listTransactions
      .mockReset()
      .mockResolvedValue([EXISTING_TRANSACTION])
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

    await user.click(
      await screen.findByRole('button', { name: '+ Add' }),
    )
    await user.type(
      screen.getByLabelText('Amount'),
      '12.50',
    )
    await user.type(
      screen.getByLabelText('Description'),
      'New coffee shop',
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Save Money Out',
      }),
    )

    await waitFor(() => {
      expect(
        mocks.createTransactionWithOwed,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            description: 'New coffee shop',
            amount: '12.50',
            direction: 'out',
          }),
        }),
      )
    })

    expect(
      await screen.findByText('Transaction created.'),
    ).toBeInTheDocument()
  })

  it('edits an existing transaction', async () => {
    mocks.updateTransaction.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Edit' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: /Edit transaction/,
    })

    const descriptionInput =
      screen.getByDisplayValue('Grocery store')
    await user.clear(descriptionInput)
    await user.type(
      descriptionInput,
      'Grocery store (updated)',
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Save changes',
      }),
    )

    await waitFor(() => {
      expect(mocks.updateTransaction).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          description: 'Grocery store (updated)',
        }),
      )
    })

    expect(dialog).not.toBeInTheDocument()
    expect(
      await screen.findByText('Transaction updated.'),
    ).toBeInTheDocument()
  })

  it('closes the edit dialog on Escape without saving', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Edit' }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: /Edit transaction/,
    })

    await user.keyboard('{Escape}')

    expect(dialog).not.toBeInTheDocument()
    expect(mocks.updateTransaction).not.toHaveBeenCalled()
  })

  it('closes the delete dialog on Escape without deleting', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Delete' }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete transaction?',
    })

    await user.keyboard('{Escape}')

    expect(dialog).not.toBeInTheDocument()
    expect(mocks.deleteTransaction).not.toHaveBeenCalled()
    expect(
      mocks.deleteTransactionWithLinkedOwed,
    ).not.toHaveBeenCalled()
  })

  it('deletes an unlinked transaction after preview', async () => {
    mocks.deleteTransaction.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Delete' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Delete transaction?',
    })

    expect(
      await within(dialog).findByText(
        /No linked owed records were found/,
      ),
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Delete',
      }),
    )

    await waitFor(() => {
      expect(
        mocks.getTransactionDeletionPreview,
      ).toHaveBeenCalledWith(42)
      expect(mocks.deleteTransaction).toHaveBeenCalledWith(42)
    })

    expect(
      await screen.findByText('Transaction deleted.'),
    ).toBeInTheDocument()
  })

  it('deletes an unpaid linked obligation atomically', async () => {
    mocks.getTransactionDeletionPreview.mockResolvedValue(
      LINKED_DELETE_PREVIEW,
    )
    mocks.deleteTransactionWithLinkedOwed.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Delete' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Delete transaction?',
    })

    expect(
      await within(dialog).findByText('Alice'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('€20.00 remaining'),
    ).toBeInTheDocument()

    const inactiveConfirmButton = within(dialog).getByRole(
      'button',
      {
        name: 'Choose an action',
      },
    )

    expect(inactiveConfirmButton).toBeDisabled()
    expect(
      mocks.deleteTransactionWithLinkedOwed,
    ).not.toHaveBeenCalled()

    await user.click(
      within(dialog).getByRole('radio', {
        name: /Delete the transaction and linked owed obligations/,
      }),
    )

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Delete transaction and owed',
      }),
    )

    await waitFor(() => {
      expect(
        mocks.deleteTransactionWithLinkedOwed,
      ).toHaveBeenCalledWith(42, {
        strategy: 'delete_with_owed',
        expected_owed_item_ids: [7],
        expected_relationship_version: 'b'.repeat(64),
      })
    })

    expect(
      await screen.findByText(
        'Transaction and linked owed obligations deleted.',
      ),
    ).toBeInTheDocument()
    expect(mocks.deleteTransaction).not.toHaveBeenCalled()
  })

  it('preserves and reassigns a partially paid obligation', async () => {
    mocks.getTransactionDeletionPreview.mockResolvedValue(
      PARTIALLY_PAID_DELETE_PREVIEW,
    )
    mocks.deleteTransactionWithLinkedOwed.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Delete' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Delete transaction?',
    })

    expect(
      await within(dialog).findByText(
        /Paid or partially paid obligations must be preserved/,
      ),
    ).toBeInTheDocument()

    expect(
      within(dialog).getByRole('button', {
        name: 'Choose an action',
      }),
    ).toBeDisabled()

    await user.click(
      within(dialog).getByRole('radio', {
        name: /Keep the owed obligations/,
      }),
    )

    expect(
      within(dialog).getByRole('button', {
        name: 'Keep owed and delete',
      }),
    ).toBeDisabled()

    await user.selectOptions(
      within(dialog).getByLabelText(
        'Who should owe you now?',
      ),
      'Bob',
    )

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Keep owed and delete',
      }),
    )

    await waitFor(() => {
      expect(
        mocks.deleteTransactionWithLinkedOwed,
      ).toHaveBeenCalledWith(42, {
        strategy: 'preserve_owed',
        expected_owed_item_ids: [7],
        expected_relationship_version: 'c'.repeat(64),
        replacement_person: 'Bob',
      })
    })

    expect(
      await screen.findByText(
        'Transaction deleted and owed obligations preserved.',
      ),
    ).toBeInTheDocument()
  })


  it('preserves an unpaid obligation when explicitly selected', async () => {
    mocks.getTransactionDeletionPreview.mockResolvedValue(
      LINKED_DELETE_PREVIEW,
    )
    mocks.deleteTransactionWithLinkedOwed.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Delete' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Delete transaction?',
    })

    await user.click(
      await within(dialog).findByRole('radio', {
        name: /Keep the owed obligations/,
      }),
    )

    await user.selectOptions(
      within(dialog).getByLabelText(
        'Who should owe you now?',
      ),
      'Bob',
    )

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Keep owed and delete',
      }),
    )

    await waitFor(() => {
      expect(
        mocks.deleteTransactionWithLinkedOwed,
      ).toHaveBeenCalledWith(42, {
        strategy: 'preserve_owed',
        expected_owed_item_ids: [7],
        expected_relationship_version: 'b'.repeat(64),
        replacement_person: 'Bob',
      })
    })

    expect(mocks.deleteTransaction).not.toHaveBeenCalled()
  })

  it('blocks deletion when an owed payment is linked', async () => {
    mocks.getTransactionDeletionPreview.mockResolvedValue(
      LINKED_PAYMENT_DELETE_PREVIEW,
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Delete' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Delete transaction?',
    })

    expect(
      await within(dialog).findByText(
        'This transaction cannot be deleted here.',
      ),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Transaction has linked owed payment records.',
      ),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Linked owed payments: 1'),
    ).toBeInTheDocument()

    expect(
      within(dialog).queryByRole('button', {
        name: /^Delete/,
      }),
    ).not.toBeInTheDocument()
    expect(mocks.deleteTransaction).not.toHaveBeenCalled()
    expect(
      mocks.deleteTransactionWithLinkedOwed,
    ).not.toHaveBeenCalled()
  })

  it('keeps the dialog open when the preview becomes stale', async () => {
    mocks.getTransactionDeletionPreview.mockResolvedValue(
      LINKED_DELETE_PREVIEW,
    )
    mocks.deleteTransactionWithLinkedOwed.mockRejectedValue(
      new Error(
        'Linked owed records changed after the deletion preview. Refresh and review them again.',
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Delete' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Delete transaction?',
    })

    await user.click(
      await within(dialog).findByRole('radio', {
        name: /Delete the transaction and linked owed obligations/,
      }),
    )

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Delete transaction and owed',
      }),
    )

    expect(
      await within(dialog).findByRole('alert'),
    ).toHaveTextContent(
      'Linked owed records changed after the deletion preview.',
    )
    expect(dialog).toBeInTheDocument()
  })

  it('surfaces a deletion-preview failure without mutating', async () => {
    mocks.getTransactionDeletionPreview.mockRejectedValue(
      new Error('Deletion preview unavailable.'),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Delete' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Delete transaction?',
    })

    expect(
      await within(dialog).findByRole('alert'),
    ).toHaveTextContent('Deletion preview unavailable.')
    expect(mocks.deleteTransaction).not.toHaveBeenCalled()
    expect(
      mocks.deleteTransactionWithLinkedOwed,
    ).not.toHaveBeenCalled()
  })

  it('closes the owed split dialog on Escape without creating a split', async () => {
    const user = userEvent.setup()
    renderPage()

    const [owedButton] = await screen.findAllByRole(
      'button',
      { name: /^Owed /i },
    )
    await user.click(owedButton)
    const dialog = await screen.findByRole('dialog', {
      name: 'Split owed expense',
    })

    await user.keyboard('{Escape}')

    expect(dialog).not.toBeInTheDocument()
    expect(
      mocks.createOwedSplitForTransaction,
    ).not.toHaveBeenCalled()
  })
})
