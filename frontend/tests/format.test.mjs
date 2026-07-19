import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  configureFormatters,
  formatDate,
  formatMoney,
  formatMonthLabel,
} from '../src/utils/format.ts'

test('formatters follow persisted presentation preferences', () => {
  configureFormatters({
    locale: 'en-GB',
    currency: 'GBP',
    time_zone: 'UTC',
    date_format: 'long',
    language: 'en',
  })

  assert.equal(formatMoney(1234.5), '£1,234.50')
  assert.equal(formatMoney(1234.5, 'EUR'), '€1,234.50')
  assert.equal(formatDate('2026-07-19'), '19 July 2026')
  assert.equal(formatMonthLabel('2026-07'), 'Jul 2026')
})

test('Portuguese locale changes currency and date presentation', () => {
  configureFormatters({
    locale: 'pt-PT',
    currency: 'EUR',
    time_zone: 'Europe/Lisbon',
    date_format: 'short',
    language: 'pt',
  })

  assert.match(formatMoney(1234.5), /1\.?234,50\s?€/)
  assert.equal(formatDate('2026-07-19'), '19/07/26')
  assert.match(formatMonthLabel('2026-07', 'long'), /julho de 2026/i)
})
