import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportPage } from '../src/pages/ImportPage'

const mocks = vi.hoisted(() => ({
  commitImport: vi.fn(),
  listImportBatches: vi.fn(),
  previewImport: vi.fn(),
}))

vi.mock('../src/api/imports', () => ({
  commitImport: mocks.commitImport,
  deleteImportBatch: vi.fn(),
  listImportBatches: mocks.listImportBatches,
  listImportBatchInvestmentEvents: vi.fn(),
  listImportBatchTransactions: vi.fn(),
  previewImport: mocks.previewImport,
}))

describe('import preview workflow', () => {
  beforeEach(() => {
    mocks.commitImport.mockReset()
    mocks.previewImport.mockReset()
    mocks.listImportBatches.mockResolvedValue([])
  })

  it('shows duplicates and blocks commit when FX is pending', async () => {
    mocks.previewImport.mockResolvedValue({
      preview_id: 'preview-1',
      expires_at: '2026-07-19T16:00:00Z',
      source: 'revolut',
      rows_total: 2,
      rows_valid: 2,
      rows_duplicates: 1,
      rows_invalid: 0,
      invalid_rows: [],
      investment_events: [],
      transactions: [
        {
          row_number: 1,
          date: '2026-07-01',
          raw_description: 'CARD PAYMENT',
          description: 'Card payment',
          amount: '10.00',
          original_amount: '12.00',
          original_currency: 'USD',
          fx_rate_to_eur: null,
          fx_rate_source: 'pending',
          direction: 'out',
          cashflow_type: 'expense',
          source: 'revolut',
          account: null,
          currency: 'EUR',
          external_id: null,
          notes: null,
          dedupe_hash: 'new-row',
          is_duplicate: false,
          category: null,
        },
        {
          row_number: 2,
          date: '2026-07-02',
          raw_description: 'SHOP',
          description: 'Shop',
          amount: '5.00',
          original_amount: null,
          original_currency: null,
          fx_rate_to_eur: null,
          fx_rate_source: null,
          direction: 'out',
          cashflow_type: 'expense',
          source: 'revolut',
          account: null,
          currency: 'EUR',
          external_id: null,
          notes: null,
          dedupe_hash: 'duplicate-row',
          is_duplicate: true,
          category: null,
        },
      ],
    })

    const user = userEvent.setup()
    render(<ImportPage />)

    const file = new File(['date,amount'], 'transactions.csv', {
      type: 'text/csv',
    })

    await user.upload(screen.getByLabelText('File'), file)
    await user.click(screen.getByRole('button', { name: 'Preview file' }))

    expect(await screen.findByText('Duplicate transaction rows')).toBeInTheDocument()
    expect(screen.getByText(/Historical EUR conversion could not be resolved/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit 1 rows' })).toBeDisabled()
    expect(mocks.commitImport).not.toHaveBeenCalled()
  })
  it('commits a reviewed import with no blocking FX rows', async () => {
    mocks.previewImport.mockResolvedValue({
      preview_id: 'preview-2',
      expires_at: '2026-07-19T16:00:00Z',
      source: 'revolut',
      rows_total: 1,
      rows_valid: 1,
      rows_duplicates: 0,
      rows_invalid: 0,
      invalid_rows: [],
      investment_events: [],
      transactions: [
        {
          row_number: 1,
          date: '2026-07-01',
          raw_description: 'GROCERY STORE',
          description: 'Grocery store',
          amount: '20.00',
          original_amount: null,
          original_currency: null,
          fx_rate_to_eur: null,
          fx_rate_source: null,
          direction: 'out',
          cashflow_type: 'expense',
          source: 'revolut',
          account: null,
          currency: 'EUR',
          external_id: null,
          notes: null,
          dedupe_hash: 'new-row',
          is_duplicate: false,
          category: 'Groceries',
        },
      ],
    })
    mocks.commitImport.mockResolvedValue({})

    const user = userEvent.setup()
    render(<ImportPage />)

    const file = new File(['date,amount'], 'transactions.csv', {
      type: 'text/csv',
    })

    await user.upload(screen.getByLabelText('File'), file)
    await user.click(screen.getByRole('button', { name: 'Preview file' }))

    const commitButton = await screen.findByRole('button', {
      name: 'Commit 1 rows',
    })

    expect(commitButton).toBeDisabled()

    await user.click(
      screen.getByText(/I reviewed this exact preview/),
    )

    expect(commitButton).toBeEnabled()

    await user.click(commitButton)

    expect(mocks.commitImport).toHaveBeenCalledWith(
      'revolut',
      file,
      'preview-2',
    )
    expect(await screen.findByText('Import committed.')).toBeInTheDocument()
  })

})
