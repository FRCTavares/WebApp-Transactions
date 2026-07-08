import type { InvestmentPosition, OwedItem, WealthAccount, WealthSnapshot } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'
import {
  getAccountTypeLabel,
  getDerivedInvestmentValue,
} from '../../utils/wealthPageUtils'

type WealthAccountGroup = {
  key: string
  label: string
  accounts: WealthAccount[]
}

type OwedReceivableGroup = {
  person: string
  amount: number
  count: number
}

type WealthMobileAccountsProps = {
  accountGroups: WealthAccountGroup[]
  latestByAccount: Map<number, WealthSnapshot>
  investmentPositions: InvestmentPosition[]
  owedItems?: OwedItem[]
}

function getAccountBalance(
  account: WealthAccount,
  latestSnapshot: WealthSnapshot | undefined,
  investmentPositions: InvestmentPosition[],
) {
  const derivedValue = getDerivedInvestmentValue(account, investmentPositions)

  if (derivedValue !== null) {
    return {
      label: formatMoney(derivedValue.toFixed(2)),
      detail: 'Derived from investments',
    }
  }

  if (latestSnapshot) {
    return {
      label: formatMoney(latestSnapshot.balance_eur),
      detail: formatDate(latestSnapshot.snapshot_date),
    }
  }

  return {
    label: '-',
    detail: 'No snapshot yet',
  }
}

function getGroupTotal(
  accounts: WealthAccount[],
  latestByAccount: Map<number, WealthSnapshot>,
  investmentPositions: InvestmentPosition[],
) {
  return accounts
    .reduce((total, account) => {
      const derivedValue = getDerivedInvestmentValue(account, investmentPositions)

      if (derivedValue !== null) {
        return total + derivedValue
      }

      const latestSnapshot = latestByAccount.get(account.id)

      if (latestSnapshot) {
        return total + Number(latestSnapshot.balance_eur)
      }

      return total
    }, 0)
    .toFixed(2)
}

function getOwedReceivableTotal(owedItems: OwedItem[]) {
  return owedItems.reduce((total, item) => total + Number(item.amount_remaining), 0)
}

function getOwedReceivableGroups(owedItems: OwedItem[]): OwedReceivableGroup[] {
  const groups = new Map<string, OwedReceivableGroup>()

  for (const item of owedItems) {
    const person = item.person.trim() || 'Unknown'
    const currentGroup = groups.get(person) ?? {
      person,
      amount: 0,
      count: 0,
    }

    currentGroup.amount += Number(item.amount_remaining)
    currentGroup.count += 1
    groups.set(person, currentGroup)
  }

  return [...groups.values()].sort((first, second) => second.amount - first.amount)
}

export function WealthMobileAccounts({
  accountGroups,
  latestByAccount,
  investmentPositions,
  owedItems = [],
}: WealthMobileAccountsProps) {
  const owedReceivableTotal = getOwedReceivableTotal(owedItems)
  const owedReceivableGroups = getOwedReceivableGroups(owedItems)
  if (accountGroups.length === 0 && owedReceivableTotal <= 0) {
    return (
      <section className="wealth-mobile-accounts">
        <div className="wealth-mobile-empty">
          <strong>No wealth accounts yet.</strong>
          <p className="muted small">Create accounts from the desktop view for now.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="wealth-mobile-accounts">
      <h2>Accounts</h2>

      {owedReceivableTotal > 0 ? (
        <details className="wealth-mobile-account-group wealth-mobile-account-group-receivable">
          <summary className="wealth-mobile-account-group-header">
            <div>
              <strong>Owed to me</strong>
              <span>
                Derived · {owedItems.length} active item{owedItems.length === 1 ? '' : 's'}
              </span>
            </div>
            <strong>{formatMoney(owedReceivableTotal.toFixed(2))}</strong>
          </summary>

          <div className="wealth-mobile-account-list">
            {owedReceivableGroups.map((group) => (
              <div key={group.person} className="wealth-mobile-account-item">
                <div>
                  <strong>{group.person}</strong>
                  <span>{group.count} item{group.count === 1 ? '' : 's'}</span>
                </div>
                <div>{formatMoney(group.amount.toFixed(2))}</div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {accountGroups.map((group) => (
        <details key={group.key} className="wealth-mobile-account-group">
          <summary className="wealth-mobile-account-group-header">
            <div>
              <strong>{group.label}</strong>
              <span>{group.accounts.length} account{group.accounts.length === 1 ? '' : 's'}</span>
            </div>
            <strong>{formatMoney(getGroupTotal(group.accounts, latestByAccount, investmentPositions))}</strong>
          </summary>

          <div className="wealth-mobile-account-list">
            {group.accounts.map((account) => {
              const latestSnapshot = latestByAccount.get(account.id)
              const balance = getAccountBalance(account, latestSnapshot, investmentPositions)

              return (
                <div key={account.id} className="wealth-mobile-account-item">
                  <div>
                    <strong>{account.name}</strong>
                    <span>{account.institution ?? getAccountTypeLabel(account.account_type)}</span>
                  </div>
                  <div>
                    <strong>{balance.label}</strong>
                    <span>{balance.detail}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      ))}
    </section>
  )
}
