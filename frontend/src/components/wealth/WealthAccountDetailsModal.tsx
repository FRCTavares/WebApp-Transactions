import type { ReactNode } from 'react'
import type { InvestmentPosition, WealthAccount, WealthSnapshot } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'
import {
  getAccountTypeLabel,
  getDerivedInvestmentValue,
  type WealthAccountGroup,
} from '../../utils/wealthPageUtils'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'

type WealthAccountDetailsModalProps = {
  group: WealthAccountGroup
  latestByAccount: Map<number, WealthSnapshot>
  investmentPositions: InvestmentPosition[]
  onClose: () => void
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

  return latestSnapshot ? Number(latestSnapshot.balance_eur) : 0
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
  onClose,
}: {
  account: WealthAccount
  onStartAccountEdit: (account: WealthAccount) => void
  onToggleAccountActive: (account: WealthAccount) => void
  onRemoveAccount: (account: WealthAccount) => void
  onClose: () => void
}) {
  return (
    <div className="wealth-account-actions wealth-modal-actions">
      <button
        type="button"
        onClick={() => {
          onClose()
          onStartAccountEdit(account)
        }}
      >
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

export function WealthAccountDetailsModal({
  group,
  latestByAccount,
  investmentPositions,
  onClose,
  onStartAccountEdit,
  onToggleAccountActive,
  onRemoveAccount,
  renderAccountBalanceCell,
}: WealthAccountDetailsModalProps) {
  const dialogRef = useDialogAccessibility<HTMLElement>({ onClose })
  const groupLatestDate = getGroupLatestDate(group, latestByAccount)

  return (
    <div className="wealth-modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="wealth-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wealth-account-details-title"
        tabIndex={-1}
      >
        <header className="wealth-modal-header">
          <div>
            <p className="eyebrow">Group details</p>
            <h2 id="wealth-account-details-title">{group.label}</h2>
            <p>
              {group.accounts.length} sub-accounts
              {groupLatestDate ? ` · latest ${formatDate(groupLatestDate)}` : ''}
            </p>
          </div>

          <div className="wealth-modal-total">
            <span>Total</span>
            <strong>{formatMoney(getGroupTotal(group, latestByAccount, investmentPositions))}</strong>
          </div>

          <button type="button" className="wealth-modal-close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="wealth-modal-subaccount-list">
          {group.accounts.map((account) => {
            const latestSnapshot = latestByAccount.get(account.id)

            return (
              <article key={account.id} className="wealth-modal-subaccount-row">
                <div className="wealth-modal-subaccount-main">
                  <span>{getAccountTypeLabel(account.account_type)}</span>
                  <strong>{getAccountDisplayName(account, group)}</strong>
                  <p>{account.institution ?? account.currency}</p>
                </div>

                <div className="wealth-subaccount-balance wealth-modal-balance">
                  {renderAccountBalanceCell(account, latestSnapshot)}
                  <span>{latestSnapshot ? formatDate(latestSnapshot.snapshot_date) : 'No snapshot'}</span>
                </div>

                <span className={account.is_active ? 'badge badge-active' : 'badge badge-inactive'}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </span>

                <AccountActions
                  account={account}
                  onClose={onClose}
                  onStartAccountEdit={onStartAccountEdit}
                  onToggleAccountActive={onToggleAccountActive}
                  onRemoveAccount={onRemoveAccount}
                />
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
