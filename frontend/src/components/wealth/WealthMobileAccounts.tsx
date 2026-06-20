import type { InvestmentPosition, WealthAccount, WealthSnapshot } from '../../types/api'
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

type WealthMobileAccountsProps = {
  accountGroups: WealthAccountGroup[]
  latestByAccount: Map<number, WealthSnapshot>
  investmentPositions: InvestmentPosition[]
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

export function WealthMobileAccounts({
  accountGroups,
  latestByAccount,
  investmentPositions,
}: WealthMobileAccountsProps) {
  if (accountGroups.length === 0) {
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

      {accountGroups.map((group) => (
        <article key={group.key} className="wealth-mobile-account-group">
          <div className="wealth-mobile-account-group-header">
            <div>
              <strong>{group.label}</strong>
              <span>{group.accounts.length} account{group.accounts.length === 1 ? '' : 's'}</span>
            </div>
            <strong>{formatMoney(getGroupTotal(group.accounts, latestByAccount, investmentPositions))}</strong>
          </div>

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
        </article>
      ))}
    </section>
  )
}
