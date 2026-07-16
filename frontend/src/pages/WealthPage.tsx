import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { listInvestmentPositions } from '../api/investmentEvents'
import { listOwedItems } from '../api/owed'
import {
  createWealthAccount,
  createWealthSnapshot,
  deleteWealthAccount,
  deleteWealthSnapshot,
  listWealthAccounts,
  listWealthMonthlyTotals,
  listWealthSnapshots,
  updateWealthAccount,
  updateWealthSnapshot,
} from '../api/wealth'
import { StatusMessage } from '../components/StatusMessage'
import { WealthMonthlyChart } from '../components/wealth/WealthMonthlyChart'
import { WealthAccountsPanel } from '../components/wealth/WealthAccountsPanel'
import { WealthMobileAccounts } from '../components/wealth/WealthMobileAccounts'
import {
  accountTypeOptions,
  getAccountGroups,
  getAccountLabel,
  getAccountName,
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
  OwedItem,
  WealthAccount,
  WealthAccountType,
  WealthMonthlyTotal,
  WealthSnapshot,
} from '../types/api'
import { formatDate, formatMoney } from '../utils/format'
import {
  buildHistoricalCacheKey,
  invalidateHistoricalData,
  loadHistoricalData,
  readHistoricalData,
} from '../utils/historicalDataCache'

type WealthPageProps = {
  onOpenInvestments?: () => void
}

export function WealthPage(_props: WealthPageProps) {
  void _props

  const { user } = useAuth()
  const cacheUserId = user?.id ?? 'local-default-user'
  const monthlyCacheKey = buildHistoricalCacheKey(
    'wealth-monthly',
    cacheUserId,
  )

  const [accounts, setAccounts] = useState<WealthAccount[]>([])
  const [snapshots, setSnapshots] = useState<WealthSnapshot[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<WealthMonthlyTotal[]>(
    () => readHistoricalData<WealthMonthlyTotal[]>(monthlyCacheKey) ?? [],
  )
  const [investmentPositions, setInvestmentPositions] = useState<InvestmentPosition[]>([])
  const [owedItems, setOwedItems] = useState<OwedItem[]>([])
  const [quickSnapshotBalances, setQuickSnapshotBalances] = useState<Record<number, string>>({})
  const [accountForm, setAccountForm] = useState<AccountFormState>(getInitialAccountForm)
  const [snapshotForm, setSnapshotForm] = useState<SnapshotFormState>(getInitialSnapshotForm)
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null)
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(null)
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false)
  const [isSnapshotFormOpen, setIsSnapshotFormOpen] = useState(false)
  const [isSnapshotsTableOpen, setIsSnapshotsTableOpen] = useState(false)
  const [showInactiveAccounts, setShowInactiveAccounts] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dataWarning, setDataWarning] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isCurrentDataLoading, setIsCurrentDataLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(
    () => readHistoricalData<WealthMonthlyTotal[]>(monthlyCacheKey) === undefined,
  )

  const loadCurrentWealthData = useCallback(async () => {
    setError(null)
    setDataWarning(null)
    setIsCurrentDataLoading(true)

    const [
      accountsResult,
      snapshotsResult,
      investmentPositionsResult,
      owedItemsResult,
    ] = await Promise.allSettled([
      listWealthAccounts({ active_only: !showInactiveAccounts, limit: 500 }),
      listWealthSnapshots({ limit: 500 }),
      listInvestmentPositions(),
      listOwedItems({ status: 'active', limit: 500 }),
    ])

    const requiredErrors: string[] = []
    const optionalErrors: string[] = []

    if (accountsResult.status === 'fulfilled') {
      setAccounts(accountsResult.value)
    } else {
      requiredErrors.push(
        accountsResult.reason instanceof Error
          ? accountsResult.reason.message
          : 'Failed to load wealth accounts',
      )
    }

    if (snapshotsResult.status === 'fulfilled') {
      setSnapshots(snapshotsResult.value)
    } else {
      requiredErrors.push(
        snapshotsResult.reason instanceof Error
          ? snapshotsResult.reason.message
          : 'Failed to load wealth snapshots',
      )
    }

    if (investmentPositionsResult.status === 'fulfilled') {
      setInvestmentPositions(investmentPositionsResult.value)
    } else {
      optionalErrors.push('Investment values could not be refreshed.')
    }

    if (owedItemsResult.status === 'fulfilled') {
      setOwedItems(owedItemsResult.value)
    } else {
      optionalErrors.push('Owed receivables could not be refreshed.')
    }

    if (requiredErrors.length > 0) {
      setError(requiredErrors.join(' '))
    }

    if (optionalErrors.length > 0) {
      setDataWarning(optionalErrors.join(' '))
    }

    setIsCurrentDataLoading(false)
  }, [showInactiveAccounts])

  const loadWealthHistory = useCallback((force = false) => {
    const cachedTotals = readHistoricalData<WealthMonthlyTotal[]>(
      monthlyCacheKey,
    )

    setHistoryError(null)

    if (cachedTotals !== undefined && !force) {
      setMonthlyTotals(cachedTotals)
      setIsHistoryLoading(false)
      return Promise.resolve(cachedTotals)
    }

    if (monthlyTotals.length === 0) {
      setIsHistoryLoading(true)
    }

    return loadHistoricalData(
      monthlyCacheKey,
      listWealthMonthlyTotals,
      { force },
    )
      .then((loadedMonthlyTotals) => {
        setMonthlyTotals(loadedMonthlyTotals)
        return loadedMonthlyTotals
      })
      .catch((caughtError: unknown) => {
        setHistoryError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load wealth history',
        )
        return monthlyTotals
      })
      .finally(() => {
        setIsHistoryLoading(false)
      })
  }, [monthlyCacheKey, monthlyTotals])

  const refreshWealthData = useCallback((invalidateHistory = false) => {
    if (invalidateHistory) {
      invalidateHistoricalData()
    }

    void loadCurrentWealthData()
    void loadWealthHistory(invalidateHistory)
  }, [loadCurrentWealthData, loadWealthHistory])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCurrentWealthData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadCurrentWealthData])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWealthHistory()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadWealthHistory])

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
      refreshWealthData(true)
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
      refreshWealthData(true)
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
      refreshWealthData(true)
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
      refreshWealthData(true)
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
      refreshWealthData(true)
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
      refreshWealthData(true)
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


  const latestByAccount = getLatestSnapshotByAccount(snapshots)
  const accountGroups = getAccountGroups(accounts)
  const sortedSnapshots = [...snapshots].sort((left, right) => {
    return right.snapshot_date.localeCompare(left.snapshot_date) || right.id - left.id
  })

  return (
    <section className="app-page wealth-page wealth-page-polished">
      <div className="page-header wealth-page-header">
        <div className="page-title-block">
          <h1>Wealth</h1>
          <p className="muted small">
            Bank, cash, savings, and other balances are manual snapshots. Owed money and investments are derived automatically.
          </p>
        </div>

        <div className="action-group">
          <button type="button" onClick={() => refreshWealthData(true)}>
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

      {dataWarning && (
        <p className="status status-info" role="status">
          {dataWarning}
        </p>
      )}

      {historyError && (
        <p className="status status-info" role="status">
          Wealth history could not be refreshed: {historyError}
        </p>
      )}

      {isCurrentDataLoading && accounts.length === 0 && snapshots.length === 0 ? (
        <p className="status status-info" role="status" aria-live="polite">
          Loading wealth data...
        </p>
      ) : (
        <WealthMobileAccounts
          accountGroups={accountGroups}
          latestByAccount={latestByAccount}
          investmentPositions={investmentPositions}
          owedItems={owedItems}
        />
      )}

      {isAccountFormOpen ? (
        <section className="content-card panel-card">
          <div className="section-header">
            <div>
              <h2>{editingAccountId === null ? 'Add wealth account' : 'Edit wealth account'}</h2>
              <p className="muted small">
                Create manual balance accounts for banks, cash, savings, and other non-investment balances.
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
        <section className="content-card panel-card">
          <div className="section-header">
            <div>
              <h2>{editingSnapshotId === null ? 'Add wealth snapshot' : 'Edit wealth snapshot'}</h2>
              <p className="muted small">
                Enter the manual balance shown by the account at the start or end of a month.
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


      <section className="content-card panel-card wealth-monthly-panel wealth-trend-panel">
        {isHistoryLoading && monthlyTotals.length === 0 ? (
          <p className="status status-info" role="status" aria-live="polite">
            Loading wealth history...
          </p>
        ) : historyError && monthlyTotals.length === 0 ? (
          <p className="muted">Wealth history is currently unavailable.</p>
        ) : (
          <WealthMonthlyChart monthlyTotals={monthlyTotals} />
        )}
      </section>

      {isCurrentDataLoading && accounts.length === 0 && snapshots.length === 0 ? null : (
        <WealthAccountsPanel
          accountGroups={accountGroups}
          latestByAccount={latestByAccount}
          investmentPositions={investmentPositions}
          showInactiveAccounts={showInactiveAccounts}
          onShowInactiveAccountsChange={setShowInactiveAccounts}
          onStartAccountEdit={startAccountEdit}
          onToggleAccountActive={toggleAccountActive}
          onRemoveAccount={removeAccount}
          renderAccountBalanceCell={renderAccountBalanceCell}
        />
      )}

      <section className="content-card panel-card wealth-snapshots-panel">
        <div className="section-header">
          <div>
            <h2>Snapshots</h2>
            <p className="muted small">
              Manual bank, cash, savings, and other account balances, newest first. Derived owed and investment values are not entered here.
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
                      <p className="muted small">Add your first manual month-start or month-end balance snapshot.</p>
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
