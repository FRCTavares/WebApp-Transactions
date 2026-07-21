import type { BadgeTone } from '../components/ui'

/* Labels are produced here rather than by CSS `text-transform: capitalize`,
   which the legacy `.badge` relied on. Capitalising in CSS cannot know where
   word boundaries really are, so it turned "activobank" into "Activobank" and
   "trading212" into "Trading212".

   Shared rather than private to one table: the same source, direction and
   cashflow values are rendered by the transactions table, the import preview
   and history, and the three rules tables. */

const CASHFLOW_LABEL: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
}

const CASHFLOW_TONE: Record<string, BadgeTone> = {
  income: 'positive',
  expense: 'expense',
  transfer: 'accent',
}

const SOURCE_LABEL: Record<string, string> = {
  activobank: 'ActivoBank',
  revolut: 'Revolut',
  trading212: 'Trading 212',
  legacy_excel: 'Legacy Excel',
  manual: 'Manual',
}

const DIRECTION_LABEL: Record<string, string> = {
  in: 'In',
  out: 'Out',
}

const DIRECTION_TONE: Record<string, BadgeTone> = {
  in: 'positive',
  out: 'expense',
}

export function toSentenceCase(value: string) {
  const spaced = value.replaceAll('_', ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function formatCashflowType(cashflowType: string) {
  return CASHFLOW_LABEL[cashflowType] ?? toSentenceCase(cashflowType)
}

export function getCashflowTone(cashflowType: string): BadgeTone {
  return CASHFLOW_TONE[cashflowType] ?? 'neutral'
}

export function formatSource(source: string) {
  return SOURCE_LABEL[source] ?? toSentenceCase(source)
}

export function formatDirection(direction: string) {
  return DIRECTION_LABEL[direction] ?? toSentenceCase(direction)
}

export function getDirectionTone(direction: string): BadgeTone {
  return DIRECTION_TONE[direction] ?? 'neutral'
}
