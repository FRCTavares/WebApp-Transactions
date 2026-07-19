import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OwedPage } from '../src/pages/OwedPage'

const mocks = vi.hoisted(() => ({
  createOwedItem: vi.fn(),
  createOwedPayment: vi.fn(),
  deleteOwedItem: vi.fn(),
  listOwedItems: vi.fn(),
  updateOwedItem: vi.fn(),
  listTransactions: vi.fn(),
}))

vi.mock('../src/api/owed', () => ({
  createOwedItem: mocks.createOwedItem,
  createOwedPayment: mocks.createOwedPayment,
  deleteOwedItem: mocks.deleteOwedItem,
  exportOwedItemsCsv: vi.fn(),
  listOwedItems: mocks.listOwedItems,
  updateOwedItem: mocks.updateOwedItem,
}))

vi.mock('../src/api/transactions', () => ({
  listTransactions: mocks.listTransactions,
}))

const OPEN_OWED_ITEM = {
  id: 7,
  person: 'Maria',
  reason: 'Dinner split',
  amount_total: '40.00',
  amount_paid: '0.00',
  amount_remaining: '40.00',
  status: 'open' as const,
  due_date: null,
  linked_transaction_id: null,
  notes: null,
  created_at: '2026-07-01T00:00:00Z',
}

describe('owed page payment workflow', () => {
  beforeEach(() => {
    mocks.createOwedItem.mockReset()
    mocks.createOwedPayment.mockReset()
    mocks.deleteOwedItem.mockReset()
    mocks.updateOwedItem.mockReset()
    mocks.listTransactions.mockReset().mockResolvedValue([])
    mocks.listOwedItems.mockReset().mockResolvedValue([OPEN_OWED_ITEM])
  })

  it('records a payment with a manual allocation', async () => {
    mocks.createOwedPayment.mockResolvedValue({ unallocated_amount: '0.00' })
    const user = userEvent.setup()
    render(<OwedPage />)

    await user.click(await screen.findByRole('button', { name: 'Record Payment' }))

    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })

    await user.selectOptions(within(dialog).getByLabelText('Person'), 'Maria')
    await user.type(within(dialog).getByLabelText('Amount received'), '40')

    const allocationInput = await within(dialog).findByLabelText(
      /Dinner split/,
    )
    await user.type(allocationInput, '40')

    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    await waitFor(() => {
      expect(mocks.createOwedPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          person: 'Maria',
          amount: '40.00',
          allocations: [{ owed_item_id: 7, amount: '40.00' }],
        }),
      )
    })

    expect(screen.queryByRole('dialog', { name: 'Record payment' })).not.toBeInTheDocument()
  })

  it('closes the payment dialog on Escape without recording anything', async () => {
    const user = userEvent.setup()
    render(<OwedPage />)

    await user.click(await screen.findByRole('button', { name: 'Record Payment' }))
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })

    await user.keyboard('{Escape}')

    expect(dialog).not.toBeInTheDocument()
    expect(mocks.createOwedPayment).not.toHaveBeenCalled()
  })
})
