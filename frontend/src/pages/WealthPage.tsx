import { Fragment, useEffect, useState } from 'react'
import { listInvestmentPositions } from '../api/investmentEvents'
import {
  createWealthAccount,
  createWealthSnapshot,
  deleteWealthAccount,
  deleteWealthSnapshot,
  getWealthSummary,
  listWealthAccounts,
  listWealthMonthlyTotals,
  listWealthSnapshots,
  updateWealthAccount,
  updateWealthSnapshot,
} from '../api/wealth'
import { StatusMessage } from '../components/StatusMessage'
import { WealthMonthlyChart } from '../components/wealth/WealthMonthlyChart'
import { WealthMobileAccounts } from '../components/wealth/WealthMobileAccounts'
import {
  accountTypeOptions,
  getAccountGroups,
  getAccountLabel,
  getAccountName,
  getAccountTypeLabel,
  getDerivedInvestmentValue,
  getInitialAccountForm,
  getInitialSnapshotForm,
  getLatestSnapshotByAccount,
  toOptionalPositiveAmount,
  toPositiveAmount,
  type AccountFormState,
  type SnapshotFormState,
} from '../utils/wealthPageUtils'
import type {
  InvestmentPosition,
  WealthAccount,
  WealthAccountType,
  WealthMonthlyTotal,
  WealthSnapshot,
  WealthSummary,
} from '../types/api'
import { formatDate, formatMoney } from '../utils/format'

type WealthPageProps = {
  onOpenInvestments?: () => void
}

export function WealthPage({ onOpenInvestments }: WealthPageProps) {
  const [accounts, setAccounts] = useState<WealthAccount[]>([])
  const [snapshots, setSnapshots] = useState<WealthSnapshot[]>([])
  const [summary, setSummary] = useState<WealthSummary | null>(null)
  const [monthlyTotals, setMonthlyTotals] = useState<WealthMonthlyTotal[]>([])
  const [investmentPositions, setInvestmentPositions] = useState<InvestmentPosition[]>([])
  const [quickSnapshotBalances, setQuickSnapshotBalances] = useState<Record<number, string>>({})
  const [accountForm, setAccountForm] = useState<AccountFormState>(getInitialAccountForm)
  const [snapshotForm, setSnapshotForm] = useState<SnapshotFormState>(getInitialSnapshotForm)
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null)
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(null)
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false)
  const [isSnapshotFormOpen, setIsSnapshotFormOpen] = useState(false)
  const [isSnapshotsTableOpen, setIsSnapshotsTableOpen] = useState(false)
  const [showInactiveAccounts, setShowInactiveAccounts] = useState(false)
  const [expandedAccountGroups, setExpandedAccountGroups] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadWealthData() {
    setError(null)

    Promise.all([
      listWealthAccounts({ active_only: !showInactiveAccounts, limit: 500 }),
      listWealthSnapshots({ limit: 500 }),
      getWealthSummary(),
      listWealthMonthlyTotals(),
      listInvestmentPositions(),
    ])
      .then(([
        loadedAccounts,
        loadedSnapshots,
        loadedSummary,
        loadedMonthlyTotals,
        loadedInvestmentPositions,
      ]) => {
        setAccounts(loadedAccounts)
        setSnapshots(loadedSnapshots)
        setSummary(loadedSummary)
        setMonthlyTotals(loadedMonthlyTotals)
        setInvestmentPositions(loadedInvestmentPositions)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load wealth data')
      })
  }

  useEffect(() => {
    loadWealthData()
  }, [showInactiveAccounts])

  function updateAccountForm(field: keyof AccountFormState, value: string) {
    setAccountForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateSnapshotForm(field: keyof SnapshotFormState, value: string) {
    setSnapshotForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function startAccountEdit(account: WealthAccount) {
    setEditingAccountId(account.id)
    setAccountForm({
      name: account.name,
      accountType: account.account_type,
      currency: account.currency,
      institution: account.institution ?? '',
      notes: account.notes ?? '',
    })
    setIsAccountFormOpen(true)
    setError(null)
    setMessage(null)
  }

  function cancelAccountEdit() {
    setEditingAccountId(null)
    setAccountForm(getInitialAccountForm())
    setIsAccountFormOpen(false)
  }

  async function submitAccountForm() {
    setError(null)
    setMessage(null)

    if (!accountForm.name.trim()) {
      setError('Account name is required.')
      return
    }

    if (!accountForm.currency.trim()) {
      setError('Currency is required.')
      return
    }

    try {
      const payload = {
        name: accountForm.name.trim(),
        account_type: accountForm.accountType,
        currency: accountForm.currency.trim().toUpperCase(),
        institution: accountForm.institution.trim() || null,
        is_active: true,
        notes: accountForm.notes.trim() || null,
      }

      if (editingAccountId === null) {
        await createWealthAccount(payload)
        setMessage('Wealth account created.')
      } else {
        await updateWealthAccount(editingAccountId, payload)
        setMessage('Wealth account updated.')
      }

      cancelAccountEdit()
      loadWealthData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save wealth account')
    }
  }

  async function toggleAccountActive(account: WealthAccount) {
    setError(null)
    setMessage(null)

    try {
      await updateWealthAccount(account.id, {
        is_active: !account.is_active,
      })

      setMessage(account.is_active ? 'Wealth account archived.' : 'Wealth account reactivated.')
      loadWealthData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update wealth account')
    }
  }

  async function removeAccount(account: WealthAccount) {
    const confirmed = window.confirm(`Delete wealth account "${account.name}"?`)

    if (!confirmed) {
      return
    }

    setError(null)
    setMessage(null)

    try {
      await deleteWealthAccount(account.id)
      setMessage('Wealth account deleted.')
      loadWealthData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to delete wealth account')
    }
  }

  function startSnapshotEdit(snapshot: WealthSnapshot) {
    setEditingSnapshotId(snapshot.id)
    setSnapshotForm({
      snapshotDate: snapshot.snapshot_date,
      accountId: String(snapshot.account_id),
      balance: snapshot.balance,
      currency: snapshot.currency,
      fxRateToEur: snapshot.fx_rate_to_eur === '1.00000000' ? '' : snapshot.fx_rate_to_eur,
      interestEarned: snapshot.interest_earned ?? '',
      notes: snapshot.notes ?? '',
    })
    setIsSnapshotFormOpen(true)
    setError(null)
    setMessage(null)
  }

  function cancelSnapshotEdit() {
    setEditingSnapshotId(null)
    setSnapshotForm(getInitialSnapshotForm())
    setIsSnapshotFormOpen(false)
  }

  async function submitSnapshotForm() {
    setError(null)
    setMessage(null)

    if (!snapshotForm.snapshotDate) {
      setError('Snapshot date is required.')
      return
    }

    const accountId = Number(snapshotForm.accountId)

    if (!Number.isInteger(accountId) || accountId <= 0) {
      setError('Choose a wealth account.')
      return
    }

    const currency = snapshotForm.currency.trim().toUpperCase()

    if (!currency) {
      setError('Currency is required.')
      return
    }

    try {
      const balance = toPositiveAmount(snapshotForm.balance, 'Balance')
      const interestEarned = toOptionalPositiveAmount(
        snapshotForm.interestEarned,
        'Interest earned',
      )
      const fxRateToEur = snapshotForm.fxRateToEur.trim() || null

      if (currency !== 'EUR' && !fxRateToEur) {
        setError('FX rate to EUR is required for non-EUR snapshots.')
        return
      }

      const payload = {
        snapshot_date: snapshotForm.snapshotDate,
        account_id: accountId,
        balance,
        currency,
        fx_rate_to_eur: fxRateToEur,
        interest_earned: interestEarned,
        notes: snapshotForm.notes.trim() || null,
      }

      if (editingSnapshotId === null) {
        await createWealthSnapshot(payload)
        setMessage('Wealth snapshot created.')
      } else {
        await updateWealthSnapshot(editingSnapshotId, payload)
        setMessage('Wealth snapshot updated.')
      }

      cancelSnapshotEdit()
      loadWealthData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save wealth snapshot')
    }
  }

  async function removeSnapshot(snapshot: WealthSnapshot) {
    const confirmed = window.confirm(
      `Delete ${snapshot.snapshot_date} snapshot for ${getAccountName(accounts, snapshot.account_id)}?`,
    )

    if (!confirmed) {
      return
    }

    setError(null)
    setMessage(null)

    try {
      await deleteWealthSnapshot(snapshot.id)
      setMessage('Wealth snapshot deleted.')
      loadWealthData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to delete wealth snapshot')
    }
  }

  function updateQuickSnapshotBalance(accountId: number, value: string) {
    setQuickSnapshotBalances((currentBalances) => ({
      ...currentBalances,
      [accountId]: value,
    }))
  }

  async function saveQuickSnapshot(account: WealthAccount) {
    setError(null)
    setMessage(null)

    if (account.currency !== 'EUR') {
      setError('Quick snapshots currently support EUR accounts only.')
      return
    }

    try {
      const balance = toPositiveAmount(
        quickSnapshotBalances[account.id] ?? '',
        'Balance',
      )

      await createWealthSnapshot({
        snapshot_date: new Date().toISOString().slice(0, 10),
        account_id: account.id,
        balance,
        currency: account.currency,
        fx_rate_to_eur: null,
        interest_earned: null,
        notes: 'Manual quick snapshot from accounts table.',
      })

      setQuickSnapshotBalances((currentBalances) => {
        const nextBalances = { ...currentBalances }
        delete nextBalances[account.id]
        return nextBalances
      })

      setMessage(`Snapshot saved for ${account.name}.`)
      loadWealthData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save quick snapshot')
    }
  }

  function renderAccountBalanceCell(
    account: WealthAccount,
    latestSnapshot: WealthSnapshot | undefined,
  ) {
    const derivedValue = getDerivedInvestmentValue(account, investmentPositions)

    if (derivedValue !== null) {
      return <span>{formatMoney(derivedValue.toFixed(2))} · derived</span>
    }

    return (
      <div className="wealth-quick-snapshot">
        <input
          type="number"
          min="0"
          step="0.01"
          value={quickSnapshotBalances[account.id] ?? ''}
          onChange={(event) => updateQuickSnapshotBalance(account.id, event.target.value)}
          placeholder={latestSnapshot?.balance_eur ?? '0.00'}
        />
        <button type="button" className="small-button" onClick={() => saveQuickSnapshot(account)}>
          Save
        </button>
      </div>
    )
  }

  function toggleAccountGroup(groupKey: string) {
    setExpandedAccountGroups((currentGroups) => {
      const nextGroups = new Set(currentGroups)

      if (nextGroups.has(groupKey)) {
        nextGroups.delete(groupKey)
      } else {
        nextGroups.add(groupKey)
      }

      return nextGroups
    })
  }

  const latestByAccount = getLatestSnapshotByAccount(snapshots)
  const accountGroups = getAccountGroups(accounts)
  const sortedSnapshots = [...snapshots].sort((left, right) => {
    return right.snapshot_date.localeCompare(left.snapshot_date) || right.id - left.id
  })

  return (
    <section className="wealth-page">
      <div className="page-header">
        <div>
          <h1>Wealth</h1>
        </div>

        <div className="action-group">
          <button type="button" onClick={loadWealthData}>
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingAccountId(null)
              setAccountForm(getInitialAccountForm())
              setIsAccountFormOpen((isOpen) => !isOpen)
            }}
          >
            {isAccountFormOpen && editingAccountId === null ? 'Close account form' : '+ Account'}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setEditingSnapshotId(null)
              setSnapshotForm(getInitialSnapshotForm())
              setIsSnapshotFormOpen((isOpen) => !isOpen)
            }}
          >
            {isSnapshotFormOpen && editingSnapshotId === null ? 'Close snapshot form' : '+ Snapshot'}
          </button>
        </div>
      </div>

      <StatusMessage error={error} message={message} />

      <div className="wealth-summary-grid">
        <article className="wealth-summary-card wealth-summary-card-primary">
          <span>Total wealth</span>
          <strong>{formatMoney(summary?.current_total_wealth_eur ?? '0')}</strong>
          <small>Latest snapshot per account</small>
        </article>

        <article className="wealth-summary-card wealth-owed-summary-card">
          <span>Money Owed To Me</span>
          <strong>{formatMoney(summary?.money_owed_to_me_eur ?? '0')}</strong>
          <small>Live total from active owed items</small>
        </article>

        <article className="wealth-summary-card wealth-active-summary-card">
          <span>Active accounts</span>
          <strong>{summary?.account_count ?? 0}</strong>
          <small>{showInactiveAccounts ? 'Showing active and inactive' : 'Showing active only'}</small>
        </article>

        <article
          className={`wealth-summary-card wealth-investments-summary-card wealth-investments-shortcut ${onOpenInvestments ? 'wealth-summary-card-button' : ''}`}
          onClick={onOpenInvestments}
        >
          <span>Investments</span>
          <strong>
            {formatMoney(
              investmentPositions
                .reduce((total, position) => total + Number(position.market_value ?? 0), 0)
                .toFixed(2),
            )}
          </strong>
          <small>{investmentPositions.length} open positions. Tap to inspect investments.</small>
        </article>
      </div>

      <WealthMobileAccounts
        accountGroups={accountGroups}
        latestByAccount={latestByAccount}
        investmentPositions={investmentPositions}
      />

      {isAccountFormOpen ? (
        <section className="panel-card">
          <div className="section-header">
            <div>
              <h2>{editingAccountId === null ? 'Add wealth account' : 'Edit wealth account'}</h2>
              <p className="muted small">
                Create one record per account whose balance you want to track monthly.
              </p>
            </div>
          </div>

          <div className="form-row">
            <label>
              Name
              <input
                value={accountForm.name}
                onChange={(event) => updateAccountForm('name', event.target.value)}
                placeholder="ActivoBank Savings"
              />
            </label>

            <label>
              Type
              <select
                value={accountForm.accountType}
                onChange={(event) => updateAccountForm('accountType', event.target.value as WealthAccountType)}
              >
                {accountTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Currency
              <input
                value={accountForm.currency}
                onChange={(event) => updateAccountForm('currency', event.target.value)}
                placeholder="EUR"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Institution
              <input
                value={accountForm.institution}
                onChange={(event) => updateAccountForm('institution', event.target.value)}
                placeholder="ActivoBank"
              />
            </label>

            <label>
              Notes
              <input
                value={accountForm.notes}
                onChange={(event) => updateAccountForm('notes', event.target.value)}
                placeholder="Emergency fund, broker, cash, etc."
              />
            </label>
          </div>

          <div className="action-group">
            <button type="button" className="primary-button" onClick={submitAccountForm}>
              {editingAccountId === null ? 'Create account' : 'Save account'}
            </button>
            <button type="button" onClick={cancelAccountEdit}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {isSnapshotFormOpen ? (
        <section className="panel-card">
          <div className="section-header">
            <div>
              <h2>{editingSnapshotId === null ? 'Add wealth snapshot' : 'Edit wealth snapshot'}</h2>
              <p className="muted small">
                Enter the balance shown by the account for a specific month-end or checkpoint date.
              </p>
            </div>
          </div>

          <div className="form-row">
            <label>
              Snapshot date
              <input
                type="date"
                value={snapshotForm.snapshotDate}
                onChange={(event) => updateSnapshotForm('snapshotDate', event.target.value)}
              />
            </label>

            <label>
              Account
              <select
                value={snapshotForm.accountId}
                onChange={(event) => {
                  const accountId = event.target.value
                  const account = accounts.find((item) => String(item.id) === accountId)

                  setSnapshotForm((currentForm) => ({
                    ...currentForm,
                    accountId,
                    currency: account?.currency ?? currentForm.currency,
                  }))
                }}
              >
                <option value="">Choose account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {getAccountLabel(account)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Balance
              <input
                type="number"
                min="0"
                step="0.01"
                value={snapshotForm.balance}
                onChange={(event) => updateSnapshotForm('balance', event.target.value)}
                placeholder="2150.00"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Currency
              <input
                value={snapshotForm.currency}
                onChange={(event) => updateSnapshotForm('currency', event.target.value)}
                placeholder="EUR"
              />
            </label>

            <label>
              FX rate to EUR
              <input
                type="number"
                min="0"
                step="0.00000001"
                value={snapshotForm.fxRateToEur}
                onChange={(event) => updateSnapshotForm('fxRateToEur', event.target.value)}
                placeholder="Only needed outside EUR"
              />
            </label>

            <label>
              Interest earned
              <input
                type="number"
                min="0"
                step="0.01"
                value={snapshotForm.interestEarned}
                onChange={(event) => updateSnapshotForm('interestEarned', event.target.value)}
                placeholder="3.40"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Notes
              <input
                value={snapshotForm.notes}
                onChange={(event) => updateSnapshotForm('notes', event.target.value)}
                placeholder="Monthly update"
              />
            </label>
          </div>

          <div className="action-group">
            <button type="button" className="primary-button" onClick={submitSnapshotForm}>
              {editingSnapshotId === null ? 'Create snapshot' : 'Save snapshot'}
            </button>
            <button type="button" onClick={cancelSnapshotEdit}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel-card wealth-accounts-panel">
        <div className="section-header">
          <div>
            <h2>Accounts</h2>
            <p className="muted small">
              Accounts define what you track. Snapshots define the balances.
            </p>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showInactiveAccounts}
              onChange={(event) => setShowInactiveAccounts(event.target.checked)}
            />
            Show inactive
          </label>
        </div>

        <div className="table-wrap wealth-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th className="right">Latest balance</th>
                <th>Latest date</th>
                <th>Status</th>
                <th className="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accountGroups.map((group) => {
                const hasSubAccounts = group.accounts.length > 1

                if (!hasSubAccounts) {
                  const account = group.accounts[0]
                  const latestSnapshot = latestByAccount.get(account.id)

                  return (
                    <tr key={account.id}>
                      <td>
                        <div className="wealth-account-cell">
                          <strong>{account.name}</strong>
                          <span>{account.institution ?? account.currency}</span>
                        </div>
                      </td>
                      <td>{getAccountTypeLabel(account.account_type)}</td>
                      <td className="right">
                        {renderAccountBalanceCell(account, latestSnapshot)}
                      </td>
                      <td>{latestSnapshot ? formatDate(latestSnapshot.snapshot_date) : '-'}</td>
                      <td>
                        <span className={account.is_active ? 'badge badge-active' : 'badge badge-inactive'}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="table-action-group">
                          <button type="button" className="small-button" onClick={() => startAccountEdit(account)}>
                            Edit
                          </button>
                          <button type="button" className="small-button" onClick={() => toggleAccountActive(account)}>
                            {account.is_active ? 'Archive' : 'Restore'}
                          </button>
                          <button type="button" className="small-button danger-button" onClick={() => removeAccount(account)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                const isExpanded = expandedAccountGroups.has(group.key)
                const groupBalance = group.accounts
                  .reduce((total, account) => {
                    const derivedValue = getDerivedInvestmentValue(account, investmentPositions)
                    const latestSnapshot = latestByAccount.get(account.id)

                    if (derivedValue !== null) {
                      return total + derivedValue
                    }

                    if (latestSnapshot) {
                      return total + Number(latestSnapshot.balance_eur)
                    }

                    return total
                  }, 0)
                  .toFixed(2)
                const latestSnapshots = group.accounts
                  .map((account) => latestByAccount.get(account.id))
                  .filter((snapshot): snapshot is WealthSnapshot => Boolean(snapshot))
                const groupLatestDate = latestSnapshots
                  .map((snapshot) => snapshot.snapshot_date)
                  .sort()
                  .at(-1)

                return (
                  <Fragment key={group.key}>
                    <tr className="wealth-account-group-row">
                      <td>
                        <button
                          type="button"
                          className="wealth-group-toggle"
                          onClick={() => toggleAccountGroup(group.key)}
                        >
                          <span>{isExpanded ? '▾' : '▸'}</span>
                          <strong>{group.label}</strong>
                        </button>
                        <div className="wealth-group-meta">
                          {group.accounts.length} sub-accounts
                        </div>
                      </td>
                      <td>Group</td>
                      <td className="right">{formatMoney(groupBalance)}</td>
                      <td>{groupLatestDate ? formatDate(groupLatestDate) : '-'}</td>
                      <td>
                        <span className="badge badge-active">Active</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="small-button"
                          onClick={() => toggleAccountGroup(group.key)}
                        >
                          {isExpanded ? 'Hide' : 'Show'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded
                      ? group.accounts.map((account) => {
                          const latestSnapshot = latestByAccount.get(account.id)

                          return (
                            <tr key={account.id} className="wealth-sub-account-row">
                              <td>
                                <div className="wealth-account-cell">
                                  <strong>{account.name.replace(`${group.label} `, '')}</strong>
                                  <span>{account.institution ?? account.currency}</span>
                                </div>
                              </td>
                              <td>{getAccountTypeLabel(account.account_type)}</td>
                              <td className="right">
                                {renderAccountBalanceCell(account, latestSnapshot)}
                              </td>
                              <td>{latestSnapshot ? formatDate(latestSnapshot.snapshot_date) : '-'}</td>
                              <td>
                                <span className={account.is_active ? 'badge badge-active' : 'badge badge-inactive'}>
                                  {account.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td>
                                <div className="table-action-group">
                                  <button type="button" className="small-button" onClick={() => startAccountEdit(account)}>
                                    Edit
                                  </button>
                                  <button type="button" className="small-button" onClick={() => toggleAccountActive(account)}>
                                    {account.is_active ? 'Archive' : 'Restore'}
                                  </button>
                                  <button type="button" className="small-button danger-button" onClick={() => removeAccount(account)}>
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      : null}
                  </Fragment>
                )
              })}


              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="wealth-empty-state">
                      <strong>No wealth accounts yet.</strong>
                      <p className="muted small">Create accounts first, then add monthly snapshots.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-card wealth-monthly-panel">
        <div className="section-header">
          <div>
            <h2>Monthly totals</h2>
            <p className="muted small">
              Uses the latest snapshot per account inside each month.
            </p>
          </div>
        </div>

        <WealthMonthlyChart monthlyTotals={monthlyTotals} />
      </section>

      <section className="panel-card wealth-snapshots-panel">
        <div className="section-header">
          <div>
            <h2>Snapshots</h2>
            <p className="muted small">
              Manual account balances, newest first. Hidden by default.
            </p>
          </div>

          <button
            type="button"
            className="small-button"
            onClick={() => setIsSnapshotsTableOpen((isOpen) => !isOpen)}
          >
            {isSnapshotsTableOpen ? 'Hide snapshots' : 'Show snapshots'}
          </button>
        </div>

        {isSnapshotsTableOpen ? (
          <div className="table-wrap wealth-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th className="right">Balance</th>
                <th>Currency</th>
                <th className="right">Balance EUR</th>
                <th>FX rate</th>
                <th className="right">Interest</th>
                <th>Notes</th>
                <th className="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedSnapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>{formatDate(snapshot.snapshot_date)}</td>
                  <td>{getAccountName(accounts, snapshot.account_id)}</td>
                  <td className="right">{formatMoney(snapshot.balance, snapshot.currency)}</td>
                  <td>{snapshot.currency}</td>
                  <td className="right">{formatMoney(snapshot.balance_eur)}</td>
                  <td>{snapshot.fx_rate_to_eur}</td>
                  <td className="right">
                    {snapshot.interest_earned ? formatMoney(snapshot.interest_earned) : '-'}
                  </td>
                  <td>{snapshot.notes ?? '-'}</td>
                  <td>
                    <div className="table-action-group">
                      <button type="button" className="small-button" onClick={() => startSnapshotEdit(snapshot)}>
                        Edit
                      </button>
                      <button type="button" className="small-button danger-button" onClick={() => removeSnapshot(snapshot)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {sortedSnapshots.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="wealth-empty-state">
                      <strong>No snapshots yet.</strong>
                      <p className="muted small">Add your first month-end balance snapshot.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        ) : null}
      </section>
    </section>
  )
}
