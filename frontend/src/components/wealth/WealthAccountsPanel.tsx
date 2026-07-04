import type { ReactNode } from 'react'
import type { InvestmentPosition, WealthAccount, WealthSnapshot } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'
import {
  getAccountTypeLabel,
  getDerivedInvestmentValue,
  type WealthAccountGroup,
} from '../../utils/wealthPageUtils'

type WealthAccountsPanelProps = {
  accountGroups: WealthAccountGroup[]
  latestByAccount: Map<number, WealthSnapshot>
  investmentPositions: InvestmentPosition[]
  showInactiveAccounts: boolean
  expandedAccountGroups: Set<string>
  onShowInactiveAccountsChange: (showInactive: boolean) => void
  onToggleAccountGroup: (groupKey: string) => void
  onStartAccountEdit: (account: WealthAccount) => void
  onToggleAccountActive: (account: WealthAccount) => void
  onRemoveAccount: (account: WealthAccount) => void
  renderAccountBalanceCell: (
    account: WealthAccount,
    latestSnapshot: WealthSnapshot | undefined,
  ) => ReactNode
}

function getAccountTotal(
  account: WealthAccount,
  latestByAccount: Map<number, WealthSnapshot>,
  investmentPositions: InvestmentPosition[],
) {
  const derivedValue = getDerivedInvestmentValue(account, investmentPositions)

  if (derivedValue !== null) {
    return derivedValue
  }

  const latestSnapshot = latestByAccount.get(account.id)

  if (!latestSnapshot) {
    return 0
  }

  return Number(latestSnapshot.balance_eur)
}

function getGroupTotal(
  group: WealthAccountGroup,
  latestByAccount: Map<number, WealthSnapshot>,
  investmentPositions: InvestmentPosition[],
) {
  return group.accounts
    .reduce((total, account) => {
      return total + getAccountTotal(account, latestByAccount, investmentPositions)
    }, 0)
    .toFixed(2)
}

function getGroupLatestDate(
  group: WealthAccountGroup,
  latestByAccount: Map<number, WealthSnapshot>,
) {
  return group.accounts
    .map((account) => latestByAccount.get(account.id)?.snapshot_date)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1)
}

function getAccountDisplayName(account: WealthAccount, group: WealthAccountGroup) {
  return account.name.replace(`${group.label} `, '')
}

function AccountActions({
  account,
  onStartAccountEdit,
  onToggleAccountActive,
  onRemoveAccount,
}: {
  account: WealthAccount
  onStartAccountEdit: (account: WealthAccount) => void
  onToggleAccountActive: (account: WealthAccount) => void
  onRemoveAccount: (account: WealthAccount) => void
}) {
  return (
    <div className="wealth-account-actions">
      <button type="button" onClick={() => onStartAccountEdit(account)}>
        Edit
      </button>
      <button type="button" onClick={() => onToggleAccountActive(account)}>
        {account.is_active ? 'Archive' : 'Restore'}
      </button>
      <button
        type="button"
        className="wealth-account-action-danger"
        onClick={() => onRemoveAccount(account)}
      >
        Delete
      </button>
    </div>
  )
}

export function WealthAccountsPanel({
  accountGroups,
  latestByAccount,
  investmentPositions,
  showInactiveAccounts,
  expandedAccountGroups,
  onShowInactiveAccountsChange,
  onToggleAccountGroup,
  onStartAccountEdit,
  onToggleAccountActive,
  onRemoveAccount,
  renderAccountBalanceCell,
}: WealthAccountsPanelProps) {
  return (
    <section className="content-card panel-card wealth-accounts-panel">
      <div className="section-header wealth-accounts-header">
        <div>
          <h2>Accounts</h2>
          <p className="muted small">
            Grouped balances with the latest snapshot per account.
          </p>
        </div>

        <label className="checkbox-label wealth-inactive-toggle">
          <input
            type="checkbox"
            checked={showInactiveAccounts}
            onChange={(event) => onShowInactiveAccountsChange(event.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {accountGroups.length === 0 ? (
        <div className="wealth-empty-state">
          <strong>No wealth accounts yet.</strong>
          <p className="muted small">Create accounts first, then add monthly snapshots.</p>
        </div>
      ) : (
        <div className="wealth-account-card-grid">
          {accountGroups.map((group) => {
            const hasSubAccounts = group.accounts.length > 1
            const isExpanded = expandedAccountGroups.has(group.key)
            const groupLatestDate = getGroupLatestDate(group, latestByAccount)

            if (!hasSubAccounts) {
              const account = group.accounts[0]
              const latestSnapshot = latestByAccount.get(account.id)

              return (
                <article key={account.id} className="wealth-account-card wealth-account-card-single">
                  <div className="wealth-account-card-main">
                    <div>
                      <span className="wealth-account-type">
                        {getAccountTypeLabel(account.account_type)}
                      </span>
                      <h3>{account.name}</h3>
                      <p>{account.institution ?? account.currency}</p>
                    </div>

                    <div className="wealth-account-balance-block">
                      {renderAccountBalanceCell(account, latestSnapshot)}
                      <span>{latestSnapshot ? formatDate(latestSnapshot.snapshot_date) : 'No snapshot'}</span>
                    </div>
                  </div>

                  <div className="wealth-account-card-footer">
                    <span className={account.is_active ? 'badge badge-active' : 'badge badge-inactive'}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>

                    <AccountActions
                      account={account}
                      onStartAccountEdit={onStartAccountEdit}
                      onToggleAccountActive={onToggleAccountActive}
                      onRemoveAccount={onRemoveAccount}
                    />
                  </div>
                </article>
              )
            }

            return (
              <article key={group.key} className="wealth-account-card wealth-account-card-group">
                <button
                  type="button"
                  className="wealth-account-card-main wealth-account-group-button"
                  onClick={() => onToggleAccountGroup(group.key)}
                >
                  <div>
                    <span className="wealth-account-type">Group</span>
                    <h3>{group.label}</h3>
                    <p>
                      {group.accounts.length} sub-accounts
                      {groupLatestDate ? ` · latest ${formatDate(groupLatestDate)}` : ''}
                    </p>
                  </div>

                  <div className="wealth-account-balance-block">
                    <strong>{formatMoney(getGroupTotal(group, latestByAccount, investmentPositions))}</strong>
                    <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="wealth-subaccount-list">
                    {group.accounts.map((account) => {
                      const latestSnapshot = latestByAccount.get(account.id)

                      return (
                        <div key={account.id} className="wealth-subaccount-row">
                          <div>
                            <strong>{getAccountDisplayName(account, group)}</strong>
                            <span>{account.institution ?? getAccountTypeLabel(account.account_type)}</span>
                          </div>

                          <div className="wealth-subaccount-balance">
                            {renderAccountBalanceCell(account, latestSnapshot)}
                            <span>{latestSnapshot ? formatDate(latestSnapshot.snapshot_date) : 'No snapshot'}</span>
                          </div>

                          <span className={account.is_active ? 'badge badge-active' : 'badge badge-inactive'}>
                            {account.is_active ? 'Active' : 'Inactive'}
                          </span>

                          <AccountActions
                            account={account}
                            onStartAccountEdit={onStartAccountEdit}
                            onToggleAccountActive={onToggleAccountActive}
                            onRemoveAccount={onRemoveAccount}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
