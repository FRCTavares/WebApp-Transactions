import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getInvestmentMonthlyChange } from '../api/investmentEvents'
import { listTransactions } from '../api/transactions'
import { getCategorySummary, getMonthlySummary } from '../api/summary'
import type { CategorySummaryItem, CategorySummaryResponse, InvestmentMonthlyChange, MonthlySummary, Transaction } from '../types/api'
import { formatMoney, formatMonthLabel } from '../utils/format'
import { ArrowDownLeft, ArrowUpRight, Equal, Receipt, TrendingUp } from 'lucide-react'
import { StatusMessage } from '../components/StatusMessage'
import { ExpenseCategoryDonutChart } from '../components/dashboard/ExpenseCategoryDonutChart'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableMessageRow,
  TableRow,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { usePeriod } from '../hooks/usePeriod'

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
  return formatMonthLabel(`${year}-${String(month).padStart(2, '0')}`, 'long')
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

/**
 * The reason line only earns its space when it says something the description
 * does not. With no notes and a raw_description equal to the description, the
 * fallback above returns the description itself, which rendered every recent
 * transaction twice ("Prenda de Anos Ze / Prenda de Anos Ze").
 */
function getSecondaryReasonText(transaction: Transaction) {
  const reason = getReasonText(transaction)

  return reason === transaction.description ? null : reason
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
  const [dataWarning, setDataWarning] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const sortedCategoryRollups = useMemo(
    () => sortCategoryRollups(buildCategoryRollups(categories?.items ?? [])),
    [categories],
  )

  useEffect(() => {
    if (isAuthLoading || (isAuthEnabled && !accessToken)) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const { startDate, endDate } = getDateRange(year, month)

      setError(null)
      setDataWarning(null)
      setSelectedCategory(null)
      setCategoryTransactions([])
      setSummary(null)
      setInvestmentMonthlyChange(null)
      setCategories(null)
      setRecentTransactions([])
      setIsDashboardLoading(true)

      void Promise.allSettled([
        getMonthlySummary(year, month),
        getInvestmentMonthlyChange(year, month),
        getCategorySummary('out', year, month),
        listTransactions({
          direction: 'out',
          date_from: startDate,
          date_to: endDate,
          limit: 5,
        }),
      ]).then(([
        summaryResult,
        investmentMonthlyChangeResult,
        categoryResult,
        recentTransactionsResult,
      ]) => {
        const requiredErrors: string[] = []

        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value)
        } else {
          requiredErrors.push(
            summaryResult.reason instanceof Error
              ? summaryResult.reason.message
              : 'Failed to load monthly summary',
          )
        }

        if (investmentMonthlyChangeResult.status === 'fulfilled') {
          setInvestmentMonthlyChange(investmentMonthlyChangeResult.value)
        } else {
          setDataWarning(
            'Investment monthly change could not be loaded. Other dashboard data remains available.',
          )
        }

        if (categoryResult.status === 'fulfilled') {
          setCategories(categoryResult.value)
        } else {
          requiredErrors.push(
            categoryResult.reason instanceof Error
              ? categoryResult.reason.message
              : 'Failed to load category summary',
          )
        }

        if (recentTransactionsResult.status === 'fulfilled') {
          setRecentTransactions(recentTransactionsResult.value)
        } else {
          requiredErrors.push(
            recentTransactionsResult.reason instanceof Error
              ? recentTransactionsResult.reason.message
              : 'Failed to load recent transactions',
          )
        }

        if (requiredErrors.length > 0) {
          setError(requiredErrors.join(' '))
        }

        setIsDashboardLoading(false)
        setLastUpdatedAt(new Date())
      })
    }, 0)

    return () => window.clearTimeout(timeoutId)
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
      <PageHeader eyebrow={`${greeting}, ${displayName}`} title="Dashboard" />

      {lastUpdatedAt && (
        <p className="muted small dashboard-refreshed-at" role="status">
          Data refreshed at{' '}
          {lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
        </p>
      )}

      <StatusMessage error={error} />

      {dataWarning && (
        <p className="status status-info" role="status">
          {dataWarning}
        </p>
      )}

      {isDashboardLoading && summary === null && (
        <>
          <p className="dashboard-loading-note" role="status" aria-live="polite">
            <strong>Preparing dashboard</strong>
            <span>The hosted backend may need a few seconds to wake up.</span>
          </p>

          {/* Skeletons stand at the real height of what replaces them, so
              nothing reflows when the data lands. */}
          <div className="dashboard-summary-grid" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <Card key={index} padding="md" className="dashboard-metric-card">
                <Skeleton variant="text" width="45%" />
                <Skeleton variant="text" width="70%" height="1.5rem" />
                <Skeleton variant="text" width="85%" />
              </Card>
            ))}
          </div>

          <div className="dashboard-main-grid" aria-hidden="true">
            <Card padding="md">
              <Skeleton variant="text" width="40%" height="1.25rem" />
              <Skeleton variant="block" height="9rem" />
            </Card>
            <Card padding="md">
              <Skeleton variant="text" width="40%" height="1.25rem" />
              <Skeleton variant="block" height="9rem" />
            </Card>
          </div>
        </>
      )}

      {summary && (
        <>
          <div className="dashboard-summary-grid" role="list" aria-label="Monthly key metrics">
            <Card
              as="article"
              padding="md"
              className="dashboard-metric-card dashboard-metric-income"
              role="listitem"
              aria-label={`Money in: ${formatMoney(summary.money_in)}. Income received.`}
            >
              <span className="dashboard-metric-icon" aria-hidden="true">
                <ArrowDownLeft size={16} />
              </span>
              <div>
                <p>Money In</p>
                <strong>{formatMoney(summary.money_in)}</strong>
                <small>Income received</small>
              </div>
            </Card>

            <Card
              as="article"
              padding="md"
              className="dashboard-metric-card dashboard-metric-spent"
              role="listitem"
              aria-label={`Money out: ${formatMoney(summary.personal_money_out)}. Excludes owed or reimbursable spending.`}
            >
              <span className="dashboard-metric-icon" aria-hidden="true">
                <ArrowUpRight size={16} />
              </span>
              <div>
                <p>Money Out</p>
                <strong>{formatMoney(summary.personal_money_out)}</strong>
                <small>Excludes owed/reimbursable spending</small>
              </div>
            </Card>

            <Card
              as="article"
              padding="md"
              aria-label={`Investment change: ${investmentChange ? formatMoney(investmentChange) : 'unavailable'}. ${investmentMonthlyChange?.is_estimated ? 'Estimated from the nearest available historical market and foreign exchange prices.' : 'Calculated from available market and foreign exchange prices.'}`}
              className={`dashboard-metric-card dashboard-metric-${getMetricTone(investmentChange)}`}
              role="listitem"
            >
              <span className="dashboard-metric-icon" aria-hidden="true">
                <TrendingUp size={16} />
              </span>
              <div>
                <p>Investments</p>
                <strong>{investmentChange ? formatMoney(investmentChange) : '-'}</strong>
                <small>
                  {investmentMonthlyChange?.is_estimated
                    ? 'Estimated using nearest available historical market/FX prices'
                    : 'Unrealised monthly gain/loss'}
                </small>
              </div>
            </Card>

            <Card
              as="article"
              padding="md"
              aria-label={`Net: ${formatMoney(netAmount)}. Income minus personal spending plus investment change.`}
              className={`dashboard-metric-card dashboard-metric-${getMetricTone(netAmount)}`}
              role="listitem"
            >
              <span className="dashboard-metric-icon" aria-hidden="true">
                <Equal size={16} />
              </span>
              <div>
                <p>Net</p>
                <strong>{formatMoney(netAmount)}</strong>
                <small>Income - spent + investments</small>
              </div>
            </Card>
          </div>

          <div className="dashboard-main-grid">
            <Card as="section" padding="md" className="dashboard-monthly-summary">
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
                      style={{
                        width: getSummaryBarWidth(summary.personal_money_out, summaryMaxValue),
                      }}
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
            </Card>

            <Card as="section" padding="md" className="dashboard-spending-panel">
              {categories && (
                <ExpenseCategoryDonutChart
                  items={sortedCategoryRollups}
                  title="Spending breakdown"
                  description="Personal spending by category."
                  emptyMessage="No personal spending found for this month."
                  onSelectCategory={handleCategoryClick}
                />
              )}
            </Card>
          </div>

          {selectedCategory && (
            <Card as="section" padding="md" className="category-detail-panel">
              <div className="category-detail-header">
                <div>
                  <h3>{selectedCategory} details</h3>
                  <p className="muted small">Transactions behind the selected category.</p>
                </div>
                <Button size="sm" onClick={() => handleCategoryClick(selectedCategory)}>
                  Close
                </Button>
              </div>

              {categoryDetailsLoading ? (
                <Skeleton variant="text" lines={4} />
              ) : (
                <>
                  <div className="dashboard-mobile-category-transactions">
                    {categoryTransactions.map((transaction) => (
                      <article
                        key={transaction.id}
                        className="dashboard-mobile-category-transaction"
                      >
                        <div className="dashboard-mobile-category-transaction-main">
                          <div>
                            <strong>{transaction.description}</strong>
                            <p>{transaction.date}</p>
                          </div>
                          <strong>
                            {formatMoney(getTransactionPersonalAmount(transaction).toFixed(2))}
                          </strong>
                        </div>

                        <div className="dashboard-mobile-category-transaction-meta">
                          {getTransactionOwedAmount(transaction) > 0 && (
                            <Badge tone="neutral" size="sm">
                              Owed{' '}
                              {formatMoney(getTransactionOwedAmount(transaction).toFixed(2))}
                            </Badge>
                          )}
                          <span className="muted small">
                            Gross {formatMoney(transaction.amount)}
                          </span>
                        </div>

                        <p className="muted small">{getReasonText(transaction)}</p>
                      </article>
                    ))}

                    {categoryTransactions.length === 0 && (
                      <EmptyState
                        size="sm"
                        icon={Receipt}
                        title="No transactions found for this category."
                      />
                    )}
                  </div>

                  <div className="dashboard-category-detail-table-wrap">
                    <Table label={`${selectedCategory} transactions`} minWidth="52rem">
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Date</TableHeaderCell>
                          <TableHeaderCell>Description</TableHeaderCell>
                          <TableHeaderCell align="right">Personal</TableHeaderCell>
                          <TableHeaderCell align="right">Owed</TableHeaderCell>
                          <TableHeaderCell align="right">Gross</TableHeaderCell>
                          <TableHeaderCell>Reason</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {categoryTransactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{transaction.date}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell align="right" numeric>
                              {formatMoney(getTransactionPersonalAmount(transaction).toFixed(2))}
                            </TableCell>
                            <TableCell align="right" numeric>
                              <span className="amount-muted">
                                {formatMoney(getTransactionOwedAmount(transaction).toFixed(2))}
                              </span>
                            </TableCell>
                            <TableCell align="right" numeric>
                              <span className="amount-muted">
                                {formatMoney(transaction.amount)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="muted small">{getReasonText(transaction)}</span>
                              {transaction.owed_person && (
                                <Badge tone="neutral" size="sm">
                                  owed by {transaction.owed_person}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}

                        {categoryTransactions.length === 0 && (
                          <TableMessageRow colSpan={6}>
                            No transactions found for this category.
                          </TableMessageRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </Card>
          )}

          <Card as="section" padding="md" className="dashboard-recent-panel">
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
                    {getSecondaryReasonText(transaction) && (
                      <span>{getSecondaryReasonText(transaction)}</span>
                    )}
                  </div>
                  <span className="dashboard-recent-category">
                    {getCategoryLabel(transaction)}
                  </span>
                  <span className="dashboard-recent-date">{transaction.date}</span>
                  <strong className="dashboard-recent-amount">
                    {formatMoney(getRecentTransactionAmount(transaction).toFixed(2))}
                  </strong>
                </article>
              ))}

              {recentTransactions.length === 0 && (
                <EmptyState
                  size="sm"
                  icon={Receipt}
                  title="No recent spending found for this month."
                  description="Spending you record this month will appear here."
                />
              )}
            </div>
          </Card>
        </>
      )}
    </section>
  )
}
