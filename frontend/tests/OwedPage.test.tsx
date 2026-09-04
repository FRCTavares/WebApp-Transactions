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

  it('uses the View selector for status filtering and keeps Refresh separate', async () => {
    const user = userEvent.setup()
    render(<OwedPage />)

    const viewSelect = await screen.findByLabelText('View')

    expect(screen.queryByRole('button', { name: 'Current' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Paid history' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'All history' })).not.toBeInTheDocument()

    await user.selectOptions(viewSelect, 'paid')

    await waitFor(() => {
      expect(mocks.listOwedItems).toHaveBeenLastCalledWith({
        status: 'paid',
        limit: 100,
      })
    })

    const callsBeforeRefresh = mocks.listOwedItems.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      expect(mocks.listOwedItems.mock.calls.length).toBeGreaterThan(callsBeforeRefresh)
    })

    expect(mocks.listOwedItems).toHaveBeenLastCalledWith({
      status: 'paid',
      limit: 100,
    })
  })

  it('records a payment with a manual allocation', async () => {
    mocks.createOwedPayment.mockResolvedValue({ unallocated_amount: '0.00' })
    const user = userEvent.setup()
    render(<OwedPage />)

    await user.click(await screen.findByRole('button', { name: 'Record Payment' }))

    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })

    await user.selectOptions(within(dialog).getByLabelText('Who paid you?'), 'Maria')
    await user.type(within(dialog).getByLabelText('Amount received'), '40')

    await user.click(within(dialog).getByText('Adjust which items are paid'))

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

  it('can stop automatic allocation before a later item', async () => {
    mocks.createOwedPayment.mockResolvedValue({ unallocated_amount: '0.00' })
    mocks.listOwedItems.mockResolvedValue([
      OPEN_OWED_ITEM,
      {
        ...OPEN_OWED_ITEM,
        id: 8,
        reason: 'Japan Flights',
        amount_total: '748.21',
        amount_remaining: '748.21',
        created_at: '2026-08-01T00:00:00Z',
      },
    ])
    const user = userEvent.setup()
    render(<OwedPage />)

    await user.click(await screen.findByRole('button', { name: 'Record Payment' }))
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })

    await user.selectOptions(within(dialog).getByLabelText('Who paid you?'), 'Maria')
    await user.type(within(dialog).getByLabelText('Amount received'), '700')
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Automatic payment ends before' }),
      '8',
    )

    expect(
      within(dialog).getByRole('combobox', { name: 'Automatic payment ends before' }),
    ).toHaveValue('8')
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    await waitFor(() => {
      expect(mocks.createOwedPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          person: 'Maria',
          amount: '700.00',
          allocation_stop_before_id: 8,
        }),
      )
    })
  })

  it('blocks a double click while the payment is being recorded', async () => {
    let resolvePayment: ((value: { unallocated_amount: string }) => void) | undefined
    mocks.createOwedPayment.mockImplementation(
      () => new Promise((resolve) => { resolvePayment = resolve }),
    )
    const user = userEvent.setup()
    render(<OwedPage />)

    await user.click(await screen.findByRole('button', { name: 'Record Payment' }))
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })
    await user.selectOptions(within(dialog).getByLabelText('Who paid you?'), 'Maria')
    await user.type(within(dialog).getByLabelText('Amount received'), '40')

    const submitButton = within(dialog).getByRole('button', { name: 'Record payment' })
    await user.dblClick(submitButton)

    expect(mocks.createOwedPayment).toHaveBeenCalledTimes(1)
    expect(within(dialog).getByRole('button', { name: 'Recording payment' })).toBeDisabled()

    resolvePayment?.({ unallocated_amount: '0.00' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Record payment' })).not.toBeInTheDocument()
    })
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
