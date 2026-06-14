import type {
  InvestmentPosition,
  WealthAccount,
  WealthAccountType,
  WealthSnapshot,
} from '../types/api'
import { formatMoney } from './format'

export type AccountFormState = {
  name: string
  accountType: WealthAccountType
  currency: string
  institution: string
  notes: string
}

export type SnapshotFormState = {
  snapshotDate: string
  accountId: string
  balance: string
  currency: string
  fxRateToEur: string
  interestEarned: string
  notes: string
}

export type WealthAccountGroup = {
  key: string
  label: string
  accounts: WealthAccount[]
}

export const accountTypeOptions: Array<{ value: WealthAccountType; label: string }> = [
  { value: 'current_account', label: 'Current account' },
  { value: 'savings_account', label: 'Savings account' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

export function getInitialAccountForm(): AccountFormState {
  return {
    name: '',
    accountType: 'current_account',
    currency: 'EUR',
    institution: '',
    notes: '',
  }
}

export function getInitialSnapshotForm(): SnapshotFormState {
  return {
    snapshotDate: new Date().toISOString().slice(0, 10),
    accountId: '',
    balance: '',
    currency: 'EUR',
    fxRateToEur: '',
    interestEarned: '',
    notes: '',
  }
}

export function getAccountLabel(account: WealthAccount) {
  return `${account.name} (${account.currency})`
}

export function getAccountTypeLabel(accountType: WealthAccountType) {
  const labels: Record<WealthAccountType, string> = {
    current_account: 'Current',
    savings_account: 'Savings',
    brokerage: 'Brokerage',
    cash: 'Cash',
    other: 'Other',
  }

  return labels[accountType]
}

export function getAccountName(accounts: WealthAccount[], accountId: number) {
  return accounts.find((account) => account.id === accountId)?.name ?? `Account #${accountId}`
}

export function getLatestSnapshotByAccount(snapshots: WealthSnapshot[]) {
  const latestByAccount = new Map<number, WealthSnapshot>()

  for (const snapshot of [...snapshots].sort((left, right) => {
    return left.snapshot_date.localeCompare(right.snapshot_date) || left.id - right.id
  })) {
    latestByAccount.set(snapshot.account_id, snapshot)
  }

  return latestByAccount
}

export function getAccountGroups(accounts: WealthAccount[]) {
  const grouped = new Map<string, WealthAccount[]>()

  for (const account of accounts) {
    const key = account.institution?.trim() || account.name
    grouped.set(key, [...(grouped.get(key) ?? []), account])
  }

  return Array.from(grouped.entries())
    .map(([key, groupedAccounts]): WealthAccountGroup => ({
      key,
      label: key,
      accounts: groupedAccounts,
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

export function toPositiveAmount(value: string, fieldName: string) {
  const numberValue = Math.abs(Number(value))

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(`${fieldName} must be a positive number.`)
  }

  return numberValue.toFixed(2)
}

export function toOptionalPositiveAmount(value: string, fieldName: string) {
  if (!value.trim()) {
    return null
  }

  const numberValue = Math.abs(Number(value))

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`${fieldName} must be a positive number.`)
  }

  return numberValue.toFixed(2)
}

export function getInvestmentPositionSymbol(position: InvestmentPosition) {
  return [
    position.ticker,
    position.instrument_name,
    position.isin,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase()
}

export function getPositionMarketValueEur(position: InvestmentPosition) {
  if (!position.market_value) {
    return null
  }

  const marketValue = Number(position.market_value)

  if (!Number.isFinite(marketValue)) {
    return null
  }

  if (position.market_value_currency === 'EUR') {
    return marketValue
  }

  if (!position.market_fx_rate_to_eur) {
    return null
  }

  const fxRate = Number(position.market_fx_rate_to_eur)

  if (!Number.isFinite(fxRate)) {
    return null
  }

  return marketValue * fxRate
}

export function getDerivedInvestmentValue(
  account: WealthAccount,
  positions: InvestmentPosition[],
) {
  if (account.institution !== 'Trading 212') {
    return null
  }

  const accountName = account.name.toUpperCase()

  if (!accountName.includes('CSPX') && !accountName.includes('VWCE')) {
    return null
  }

  const targetSymbol = accountName.includes('CSPX') ? 'CSPX' : 'VWCE'
  const matchingPosition = positions.find((position) => {
    return getInvestmentPositionSymbol(position).includes(targetSymbol)
  })

  if (!matchingPosition) {
    return null
  }

  return getPositionMarketValueEur(matchingPosition)
}

export function formatDerivedOrSnapshotBalance(
  account: WealthAccount,
  latestSnapshot: WealthSnapshot | undefined,
  positions: InvestmentPosition[],
) {
  const derivedValue = getDerivedInvestmentValue(account, positions)

  if (derivedValue !== null) {
    return `${formatMoney(derivedValue.toFixed(2))} · derived`
  }

  return latestSnapshot ? formatMoney(latestSnapshot.balance_eur) : '-'
}
