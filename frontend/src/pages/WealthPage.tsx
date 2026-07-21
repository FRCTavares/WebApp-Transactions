import { Plus } from 'lucide-react'
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
import { Button, PageHeader } from '../components/ui'
import { WealthMonthlyChart } from '../components/wealth/WealthMonthlyChart'
import { WealthAccountsPanel } from '../components/wealth/WealthAccountsPanel'
import { WealthMobileAccounts } from '../components/wealth/WealthMobileAccounts'
import { WealthAccountFormPanel } from '../components/wealth/WealthAccountFormPanel'
import { WealthSnapshotFormPanel } from '../components/wealth/WealthSnapshotFormPanel'
import { WealthSnapshotsTablePanel } from '../components/wealth/WealthSnapshotsTablePanel'
import {
  getAccountGroups,
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
  WealthMonthlyTotal,
  WealthSnapshot,
} from '../types/api'
import { formatMoney } from '../utils/format'
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
      valueSource: account.value_source,
      valueReference: account.value_reference ?? '',
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
        value_source: accountForm.valueSource,
        value_reference:
          accountForm.valueSource === 'investment'
            ? accountForm.valueReference.trim().toUpperCase() || null
            : null,
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
        <Button type="button" size="sm" onClick={() => saveQuickSnapshot(account)}>
          Save
        </Button>
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
      <PageHeader
        title="Wealth"
        description="Bank, cash, savings, and other balances are manual snapshots. Owed money and investments are derived automatically."
        actions={(
          <>
            <Button type="button" size="sm" onClick={() => refreshWealthData(true)}>
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              iconLeft={isAccountFormOpen && editingAccountId === null ? undefined : Plus}
              onClick={() => {
                setEditingAccountId(null)
                setAccountForm(getInitialAccountForm())
                setIsAccountFormOpen((isOpen) => !isOpen)
              }}
            >
              {isAccountFormOpen && editingAccountId === null ? 'Close account' : 'Account'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isSnapshotFormOpen && editingSnapshotId === null ? 'secondary' : 'primary'}
              iconLeft={isSnapshotFormOpen && editingSnapshotId === null ? undefined : Plus}
              onClick={() => {
                setEditingSnapshotId(null)
                setSnapshotForm(getInitialSnapshotForm())
                setIsSnapshotFormOpen((isOpen) => !isOpen)
              }}
            >
              {isSnapshotFormOpen && editingSnapshotId === null ? 'Close snapshot' : 'Snapshot'}
            </Button>
          </>
        )}
      />

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
        <WealthAccountFormPanel
          accountForm={accountForm}
          isEditing={editingAccountId !== null}
          onUpdateField={updateAccountForm}
          onSubmit={submitAccountForm}
          onCancel={cancelAccountEdit}
        />
      ) : null}

      {isSnapshotFormOpen ? (
        <WealthSnapshotFormPanel
          snapshotForm={snapshotForm}
          isEditing={editingSnapshotId !== null}
          accounts={accounts}
          onUpdateField={updateSnapshotForm}
          onAccountChange={(accountId) => {
            const account = accounts.find((item) => String(item.id) === accountId)

            setSnapshotForm((currentForm) => ({
              ...currentForm,
              accountId,
              currency: account?.currency ?? currentForm.currency,
            }))
          }}
          onSubmit={submitSnapshotForm}
          onCancel={cancelSnapshotEdit}
        />
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

      <WealthSnapshotsTablePanel
        sortedSnapshots={sortedSnapshots}
        accounts={accounts}
        isOpen={isSnapshotsTableOpen}
        onToggleOpen={() => setIsSnapshotsTableOpen((isOpen) => !isOpen)}
        onStartEdit={startSnapshotEdit}
        onRemove={removeSnapshot}
      />
    </section>
  )
}
