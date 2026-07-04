import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getInvestmentMonthlyChange } from '../api/investmentEvents'
import { listTransactions } from '../api/transactions'
import { getCategorySummary, getMonthlySummary } from '../api/summary'
import type { CategorySummaryItem, CategorySummaryResponse, InvestmentMonthlyChange, MonthlySummary, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'
import { StatusMessage } from '../components/StatusMessage'
import { ExpenseCategoryDonutChart } from '../components/dashboard/ExpenseCategoryDonutChart'
import { usePeriod } from '../context/PeriodContext'
import { useAuth } from '../auth/AuthProvider'

type CategoryRollup = {
  category: string
  count: number
  grossTotal: number
  owedTotal: number
  personalTotal: number
}

function calculateDashboardNet(
  summary: MonthlySummary,
  investmentMonthlyChange: InvestmentMonthlyChange | null,
) {
  const investmentChange = Number(investmentMonthlyChange?.unrealised_monthly_change ?? 0)

  return (
    Number(summary.money_in)
    - Number(summary.personal_money_out)
    + investmentChange
  ).toFixed(2)
}

function getMetricTone(value: string | number | null | undefined) {
  const amount = Number(value ?? 0)

  if (amount > 0) {
    return 'positive'
  }

  if (amount < 0) {
    return 'negative'
  }

  return 'neutral'
}

function toNumber(value: string) {
  return Number(value)
}

function getDateRange(year: number, month: number) {
  const paddedMonth = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const paddedLastDay = String(lastDay).padStart(2, '0')

  return {
    startDate: `${year}-${paddedMonth}-01`,
    endDate: `${year}-${paddedMonth}-${paddedLastDay}`,
  }
}

function getMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

function getTransactionOwedAmount(transaction: Transaction) {
  return Number(transaction.owed_amount_total ?? 0)
}

function getTransactionPersonalAmount(transaction: Transaction) {
  return Number(transaction.amount) - getTransactionOwedAmount(transaction)
}

function getRecentTransactionAmount(transaction: Transaction) {
  if (transaction.direction === 'out') {
    return -getTransactionPersonalAmount(transaction)
  }

  return getTransactionPersonalAmount(transaction)
}

function getReasonText(transaction: Transaction) {
  if (transaction.notes) {
    return transaction.notes
  }

  if (transaction.raw_description && transaction.raw_description !== transaction.description) {
    return transaction.raw_description
  }

  return transaction.description
}

function buildCategoryRollups(items: CategorySummaryItem[]) {
  const rollups = new Map<string, CategoryRollup>()

  for (const item of items) {
    const current = rollups.get(item.category) ?? {
      category: item.category,
      count: 0,
      grossTotal: 0,
      owedTotal: 0,
      personalTotal: 0,
    }

    current.count += item.count
    current.grossTotal += toNumber(item.gross_total)
    current.owedTotal += toNumber(item.owed_total)
    current.personalTotal += toNumber(item.personal_total)

    rollups.set(item.category, current)
  }

  return Array.from(rollups.values())
}

function sortCategoryRollups(items: CategoryRollup[]) {
  return [...items].sort((firstItem, secondItem) => {
    const personalDifference = secondItem.personalTotal - firstItem.personalTotal

    if (personalDifference !== 0) {
      return personalDifference
    }

    return firstItem.category.localeCompare(secondItem.category)
  })
}

function getSummaryBarWidth(value: string | number, maxValue: number) {
  if (maxValue <= 0) {
    return '0%'
  }

  return `${Math.max(4, Math.min(100, (Number(value) / maxValue) * 100))}%`
}

function getNetSummaryBarStyle(value: string | number, maxValue: number): CSSProperties {
  const amount = Number(value)

  if (maxValue <= 0 || amount === 0) {
    return {
      left: '50%',
      width: '0%',
    }
  }

  const width = Math.max(4, Math.min(50, (Math.abs(amount) / maxValue) * 50))

  if (amount < 0) {
    return {
      right: '50%',
      width: `${width}%`,
    }
  }

  return {
    left: '50%',
    width: `${width}%`,
  }
}

function getCategoryLabel(transaction: Transaction) {
  return transaction.category || 'Uncategorised'
}

type DashboardPageProps = {
  greeting: string
  displayName: string
}

export function DashboardPage({ greeting, displayName }: DashboardPageProps) {
  const { year, month } = usePeriod()
  const {
    accessToken,
    isAuthEnabled,
    isLoading: isAuthLoading,
  } = useAuth()
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [investmentMonthlyChange, setInvestmentMonthlyChange] =
    useState<InvestmentMonthlyChange | null>(null)
  const [categories, setCategories] = useState<CategorySummaryResponse | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryTransactions, setCategoryTransactions] = useState<Transaction[]>([])
  const [categoryDetailsLoading, setCategoryDetailsLoading] = useState(false)
  const [isDashboardLoading, setIsDashboardLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sortedCategoryRollups = useMemo(
    () => sortCategoryRollups(buildCategoryRollups(categories?.items ?? [])),
    [categories],
  )

  useEffect(() => {
    if (isAuthLoading) {
      setIsDashboardLoading(true)
      return
    }

    if (isAuthEnabled && !accessToken) {
      setIsDashboardLoading(false)
      return
    }

    const { startDate, endDate } = getDateRange(year, month)

    setError(null)
    setSelectedCategory(null)
    setCategoryTransactions([])
    setSummary(null)
    setInvestmentMonthlyChange(null)
    setCategories(null)
    setRecentTransactions([])
    setIsDashboardLoading(true)

    Promise.all([
      getMonthlySummary(year, month),
      getInvestmentMonthlyChange(year, month),
      getCategorySummary('out', year, month),
      listTransactions({
        direction: 'out',
        date_from: startDate,
        date_to: endDate,
        limit: 5,
      }),
    ])
      .then(([
        summaryData,
        investmentMonthlyChangeData,
        categoryData,
        recentTransactionData,
      ]) => {
        setSummary(summaryData)
        setInvestmentMonthlyChange(investmentMonthlyChangeData)
        setCategories(categoryData)
        setRecentTransactions(recentTransactionData)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load dashboard')
      })
      .finally(() => {
        setIsDashboardLoading(false)
      })
  }, [accessToken, isAuthEnabled, isAuthLoading, year, month])

  function handleCategoryClick(category: string) {
    if (selectedCategory === category) {
      setSelectedCategory(null)
      setCategoryTransactions([])
      return
    }

    const { startDate, endDate } = getDateRange(year, month)

    setSelectedCategory(category)
    setCategoryDetailsLoading(true)
    setError(null)

    listTransactions({
      direction: 'out',
      cashflow_type: 'expense',
      category,
      date_from: startDate,
      date_to: endDate,
      limit: 500,
    })
      .then((transactions: Transaction[]) => {
        setCategoryTransactions(transactions)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load category details')
      })
      .finally(() => {
        setCategoryDetailsLoading(false)
      })
  }

  const monthLabel = getMonthLabel(year, month)
  const netAmount = summary ? calculateDashboardNet(summary, investmentMonthlyChange) : '0.00'
  const investmentChange = investmentMonthlyChange?.unrealised_monthly_change ?? null
  const summaryMaxValue = summary
    ? Math.max(
        Number(summary.money_in),
        Number(summary.personal_money_out),
        Math.abs(Number(netAmount)),
      )
    : 0

  return (
    <section className="app-page dashboard-page">
      <div className="page-title-block dashboard-hero">
        <p>{greeting}, {displayName}</p>
        <h1>Dashboard</h1>
      </div>

      <StatusMessage error={error} />

      {isDashboardLoading && summary === null && (
        <section className="dashboard-loading-panel" role="status" aria-live="polite">
          <div className="dashboard-loading-spinner" aria-hidden="true" />
          <div>
            <p className="eyebrow">Loading data</p>
            <h2>Preparing dashboard</h2>
            <p>The hosted backend may need a few seconds to wake up.</p>
          </div>
        </section>
      )}

      {summary && (
        <>
          <div className="dashboard-summary-grid">
            <article className="dashboard-metric-card dashboard-metric-income">
              <span className="dashboard-metric-icon" aria-hidden="true">↓</span>
              <div>
                <p>Money In</p>
                <strong>{formatMoney(summary.money_in)}</strong>
                <small>Income received</small>
              </div>
            </article>

            <article className="dashboard-metric-card dashboard-metric-spent">
              <span className="dashboard-metric-icon" aria-hidden="true">↑</span>
              <div>
                <p>Money Out</p>
                <strong>{formatMoney(summary.personal_money_out)}</strong>
                <small>Excludes owed/reimbursable spending</small>
              </div>
            </article>

            <article
              className={`dashboard-metric-card dashboard-metric-${getMetricTone(
                investmentChange,
              )}`}
            >
              <span className="dashboard-metric-icon" aria-hidden="true">↗</span>
              <div>
                <p>Investments</p>
                <strong>{investmentChange ? formatMoney(investmentChange) : '-'}</strong>
                <small>Unrealised monthly gain/loss</small>
              </div>
            </article>

            <article
              className={`dashboard-metric-card dashboard-metric-${getMetricTone(netAmount)}`}
            >
              <span className="dashboard-metric-icon" aria-hidden="true">=</span>
              <div>
                <p>Net</p>
                <strong>{formatMoney(netAmount)}</strong>
                <small>Income - spent + investments</small>
              </div>
            </article>
          </div>

          <div className="dashboard-main-grid">
            <section className="dashboard-panel dashboard-monthly-summary">
              <div className="dashboard-panel-header">
                <div>
                  <h2>Monthly summary</h2>
                  <p>Income vs spending over {monthLabel}</p>
                </div>
              </div>

              <div className="dashboard-summary-bars">
                <div className="dashboard-summary-bar-row">
                  <div>
                    <span className="dashboard-dot dashboard-dot-income" />
                    <span>Income</span>
                  </div>
                  <strong>{formatMoney(summary.money_in)}</strong>
                  <div className="dashboard-summary-bar-track">
                    <span
                      className="dashboard-summary-bar dashboard-summary-bar-income"
                      style={{ width: getSummaryBarWidth(summary.money_in, summaryMaxValue) }}
                    />
                  </div>
                </div>

                <div className="dashboard-summary-bar-row">
                  <div>
                    <span className="dashboard-dot dashboard-dot-spent" />
                    <span>Spent</span>
                  </div>
                  <strong>{formatMoney(summary.personal_money_out)}</strong>
                  <div className="dashboard-summary-bar-track">
                    <span
                      className="dashboard-summary-bar dashboard-summary-bar-spent"
                      style={{ width: getSummaryBarWidth(summary.personal_money_out, summaryMaxValue) }}
                    />
                  </div>
                </div>

                <div className="dashboard-summary-bar-row">
                  <div>
                    <span className="dashboard-dot dashboard-dot-net" />
                    <span>Net</span>
                  </div>
                  <strong>{formatMoney(netAmount)}</strong>
                  <div className="dashboard-summary-bar-track dashboard-summary-bar-track-net">
                    <span
                      className={`dashboard-summary-bar dashboard-summary-bar-net ${
                        Number(netAmount) < 0 ? 'dashboard-summary-bar-net-negative' : ''
                      }`}
                      style={getNetSummaryBarStyle(netAmount, summaryMaxValue)}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="dashboard-panel dashboard-spending-panel">
              {categories && (
                <ExpenseCategoryDonutChart
                  items={sortedCategoryRollups}
                  title="Spending breakdown"
                  description="Personal spending by category."
                  emptyMessage="No personal spending found for this month."
                  onSelectCategory={handleCategoryClick}
                />
              )}
            </section>
          </div>

          {selectedCategory && (
            <section className="dashboard-panel category-detail-panel">
              <div className="category-detail-header">
                <div>
                  <h3>{selectedCategory} details</h3>
                  <p className="muted small">Transactions behind the selected category.</p>
                </div>
                <button type="button" onClick={() => handleCategoryClick(selectedCategory)}>
                  Close
                </button>
              </div>

              {categoryDetailsLoading ? (
                <p className="muted">Loading category details...</p>
              ) : (
                <>
                  <div className="dashboard-mobile-category-transactions">
                    {categoryTransactions.map((transaction) => (
                      <article key={transaction.id} className="dashboard-mobile-category-transaction">
                        <div className="dashboard-mobile-category-transaction-main">
                          <div>
                            <strong>{transaction.description}</strong>
                            <p>{transaction.date}</p>
                          </div>
                          <strong>{formatMoney(getTransactionPersonalAmount(transaction).toFixed(2))}</strong>
                        </div>

                        <div className="dashboard-mobile-category-transaction-meta">
                          {getTransactionOwedAmount(transaction) > 0 && (
                            <span className="badge badge-neutral">
                              Owed {formatMoney(getTransactionOwedAmount(transaction).toFixed(2))}
                            </span>
                          )}
                          <span className="muted small">Gross {formatMoney(transaction.amount)}</span>
                        </div>

                        <p className="muted small">{getReasonText(transaction)}</p>
                      </article>
                    ))}

                    {categoryTransactions.length === 0 && (
                      <div className="dashboard-mobile-category-empty">
                        <p className="muted">No transactions found for this category.</p>
                      </div>
                    )}
                  </div>

                  <div className="table-wrap dashboard-category-detail-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th className="right">Personal</th>
                          <th className="right">Owed</th>
                          <th className="right">Gross</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryTransactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td>{transaction.date}</td>
                            <td>{transaction.description}</td>
                            <td className="right amount-primary">
                              {formatMoney(getTransactionPersonalAmount(transaction).toFixed(2))}
                            </td>
                            <td className="right amount-muted">
                              {formatMoney(getTransactionOwedAmount(transaction).toFixed(2))}
                            </td>
                            <td className="right amount-muted">{formatMoney(transaction.amount)}</td>
                            <td>
                              <span className="muted small">{getReasonText(transaction)}</span>
                              {transaction.owed_person && (
                                <span className="badge badge-neutral category-detail-badge">
                                  owed by {transaction.owed_person}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}

                        {categoryTransactions.length === 0 && (
                          <tr>
                            <td colSpan={6}>
                              <p className="muted">No transactions found for this category.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          <section className="dashboard-panel dashboard-recent-panel">
            <div className="dashboard-panel-header">
              <div>
                <h2>Recent transactions</h2>
                <p>Latest spending in {monthLabel}</p>
              </div>
            </div>

            <div className="dashboard-recent-list">
              {recentTransactions.map((transaction) => (
                <article key={transaction.id} className="dashboard-recent-row">
                  <div className="dashboard-recent-main">
                    <strong>{transaction.description}</strong>
                    <span>{getReasonText(transaction)}</span>
                  </div>
                  <span className="dashboard-recent-category">{getCategoryLabel(transaction)}</span>
                  <span className="dashboard-recent-date">{transaction.date}</span>
                  <strong className="dashboard-recent-amount">
                    {formatMoney(getRecentTransactionAmount(transaction).toFixed(2))}
                  </strong>
                </article>
              ))}

              {recentTransactions.length === 0 && (
                <p className="muted">No recent spending found for this month.</p>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  )
}
