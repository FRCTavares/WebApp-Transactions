import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  buildTransactionFilterUrl,
  getFiltersFromUrl,
} from '../src/utils/transactionFilterUrl.ts'

test('transaction filters round-trip through the URL', () => {
  const filters = {
    search: 'coffee & lunch',
    category: 'Eating Out',
    source: 'revolut',
    cashflowType: 'expense',
    month: '2026-07',
    dateFrom: '2026-07-01',
    dateTo: '2026-07-19',
    showFullyOwed: true,
  }

  const params = buildTransactionFilterUrl(filters, 'out')
  assert.deepEqual(getFiltersFromUrl(params), filters)
  assert.equal(params.get('q'), 'coffee & lunch')
})

test('invalid URL values fall back safely', () => {
  const filters = getFiltersFromUrl(new URLSearchParams('type=invalid&fully_owed=no'))
  assert.equal(filters.cashflowType, '')
  assert.equal(filters.showFullyOwed, false)
})
