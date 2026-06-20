import { useEffect, useMemo, useState } from 'react'
import { getInvestmentMonthlyChange } from '../api/investmentEvents'
import { listTransactions } from '../api/transactions'
import { getCategorySummary, getMonthlySummary } from '../api/summary'
import type { CategorySummaryItem, CategorySummaryResponse, InvestmentMonthlyChange, MonthlySummary, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'
import { StatusMessage } from '../components/StatusMessage'
import { ExpenseCategoryDonutChart } from '../components/dashboard/ExpenseCategoryDonutChart'
import { usePeriod } from '../context/PeriodContext'

type CategoryRollup = {
  category: string
  count: number
  grossTotal: number
  owedTotal: number
  personalTotal: number
}

type CategorySortField = 'category' | 'count' | 'personal' | 'owed' | 'gross'
type SortDirection = 'asc' | 'desc'
type DashboardChartMode = 'income' | 'expenses'

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

function getTransactionOwedAmount(transaction: Transaction) {
  return Number(transaction.owed_amount_total ?? 0)
}

function getTransactionPersonalAmount(transaction: Transaction) {
  return Number(transaction.amount) - getTransactionOwedAmount(transaction)
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

function isFullyReimbursed(item: CategoryRollup) {
  return item.personalTotal === 0 && item.owedTotal > 0
}

function getCategorySortValue(item: CategoryRollup, sortField: CategorySortField) {
  if (sortField === 'category') {
    return item.category.toLowerCase()
  }

  if (sortField === 'count') {
    return item.count
  }

  if (sortField === 'owed') {
    return item.owedTotal
  }

  if (sortField === 'gross') {
    return item.grossTotal
  }

  return item.personalTotal
}

function sortCategoryRollups(
  items: CategoryRollup[],
  sortField: CategorySortField,
  sortDirection: SortDirection,
) {
  return [...items].sort((firstItem, secondItem) => {
    const firstValue = getCategorySortValue(firstItem, sortField)
    const secondValue = getCategorySortValue(secondItem, sortField)

    let comparison = 0

    if (typeof firstValue === 'string' && typeof secondValue === 'string') {
      comparison = firstValue.localeCompare(secondValue)
    } else {
      comparison = Number(firstValue) - Number(secondValue)
    }

    if (comparison === 0) {
      comparison = firstItem.category.localeCompare(secondItem.category)
    }

    return sortDirection === 'asc' ? comparison : -comparison
  })
}

type DashboardPageProps = {
  greeting: string
  displayName: string
}

export function DashboardPage({ greeting, displayName }: DashboardPageProps) {
  const { year, month } = usePeriod()
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [investmentMonthlyChange, setInvestmentMonthlyChange] =
    useState<InvestmentMonthlyChange | null>(null)
  const [categories, setCategories] = useState<CategorySummaryResponse | null>(null)
  const [incomeCategories, setIncomeCategories] =
    useState<CategorySummaryResponse | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryTransactions, setCategoryTransactions] = useState<Transaction[]>([])
  const [categoryDetailsLoading, setCategoryDetailsLoading] = useState(false)
  const [categorySortField, setCategorySortField] = useState<CategorySortField>('personal')
  const [categorySortDirection, setCategorySortDirection] = useState<SortDirection>('desc')
  const [dashboardChartMode, setDashboardChartMode] =
    useState<DashboardChartMode>('expenses')
  const [error, setError] = useState<string | null>(null)

  const categoryRollups = useMemo(
    () => buildCategoryRollups(categories?.items ?? []),
    [categories],
  )
  const sortedCategoryRollups = useMemo(
    () => sortCategoryRollups(categoryRollups, categorySortField, categorySortDirection),
    [categoryRollups, categorySortField, categorySortDirection],
  )
  const incomeCategoryRollups = useMemo(
    () => buildCategoryRollups(incomeCategories?.items ?? []),
    [incomeCategories],
  )
  const sortedIncomeCategoryRollups = useMemo(
    () => sortCategoryRollups(incomeCategoryRollups, 'personal', 'desc'),
    [incomeCategoryRollups],
  )

  useEffect(() => {
    setError(null)
    setSelectedCategory(null)
    setCategoryTransactions([])

    Promise.all([
      getMonthlySummary(year, month),
      getInvestmentMonthlyChange(year, month),
      getCategorySummary('out', year, month),
      getCategorySummary('in', year, month),
    ])
      .then(([
        summaryData,
        investmentMonthlyChangeData,
        categoryData,
        incomeCategoryData,
      ]) => {
        setSummary(summaryData)
        setInvestmentMonthlyChange(investmentMonthlyChangeData)
        setCategories(categoryData)
        setIncomeCategories(incomeCategoryData)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load dashboard')
      })
  }, [year, month])

  function toggleCategorySort(nextSortField: CategorySortField) {
    if (categorySortField === nextSortField) {
      setCategorySortDirection((currentDirection) => currentDirection === 'asc' ? 'desc' : 'asc')
      return
    }

    setCategorySortField(nextSortField)
    setCategorySortDirection(nextSortField === 'category' ? 'asc' : 'desc')
  }

  function getCategorySortLabel(sortField: CategorySortField) {
    if (categorySortField !== sortField) {
      return '↕'
    }

    return categorySortDirection === 'asc' ? '↑' : '↓'
  }

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

  return (
    <section>
      <div className="dashboard-hero">
        <p>{greeting}, {displayName}</p>
        <h1>Dashboard</h1>
      </div>

      <StatusMessage error={error} />

      {summary && (
        <>
          <div className="cards">
            <div className="card">
              <span>Money In</span>
              <strong>{formatMoney(summary.money_in)}</strong>
            </div>
            <div className="card">
              <span>Money Spent</span>
              <strong>{formatMoney(summary.personal_money_out)}</strong>
              <p className="muted small">Excludes owed/reimbursable spending</p>
            </div>
            <div className="card">
              <span>Investments</span>
              <strong>
                {investmentMonthlyChange?.unrealised_monthly_change
                  ? formatMoney(investmentMonthlyChange.unrealised_monthly_change)
                  : '-'}
              </strong>
              <p className="muted small">Unrealised monthly gain/loss</p>
            </div>
            <div className="card">
              <span>Net</span>
              <strong>{formatMoney(calculateDashboardNet(summary, investmentMonthlyChange))}</strong>
              <p className="muted small">Income - spent + investments</p>
            </div>
          </div>

        </>
      )}


          {selectedCategory && (
            <div className="category-detail-panel">
              <div className="category-detail-header">
                <div>
                  <h3>{selectedCategory} details</h3>
                  <p className="muted small">These are the transactions behind the selected category.</p>
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
            </div>
          )}

      {categories && (
        <>
          <div className="dashboard-section-header">
            <div>
              <h2>Money Breakdown This Month</h2>
              <p className="muted small">
                Switch between income and expenses. Expense values are personal spending after owed/reimbursable parts.
              </p>
            </div>
          </div>

          <ExpenseCategoryDonutChart
            items={
              dashboardChartMode === 'income'
                ? sortedIncomeCategoryRollups
                : sortedCategoryRollups
            }
            title={dashboardChartMode === 'income' ? 'Money in split' : 'Expense split'}
            description={
              dashboardChartMode === 'income'
                ? 'Incoming money by category.'
                : 'Personal spending by category.'
            }
            emptyMessage={
              dashboardChartMode === 'income'
                ? 'No incoming money found for this month.'
                : 'No personal spending found for this month.'
            }
            onSelectCategory={
              dashboardChartMode === 'expenses' ? handleCategoryClick : undefined
            }
            actions={
              <div className="dashboard-chart-toggle" aria-label="Dashboard chart type">
                <button
                  type="button"
                  className={dashboardChartMode === 'income' ? 'active' : ''}
                  onClick={() => {
                    setDashboardChartMode('income')
                    setSelectedCategory(null)
                    setCategoryTransactions([])
                  }}
                >
                  Money In
                </button>
                <button
                  type="button"
                  className={dashboardChartMode === 'expenses' ? 'active' : ''}
                  onClick={() => setDashboardChartMode('expenses')}
                >
                  Expenses
                </button>
              </div>
            }
          />

          {dashboardChartMode === 'expenses' && (
            <div className="dashboard-mobile-category-list">
            {sortedCategoryRollups.map((item) => (
              <button
                key={item.category}
                type="button"
                className={`dashboard-mobile-category-card ${isFullyReimbursed(item) ? 'fully-reimbursed-row' : ''}`}
                onClick={() => handleCategoryClick(item.category)}
              >
                <div>
                  <strong>{item.category}</strong>
                  <span>{item.count} {item.count === 1 ? 'transaction' : 'transactions'}</span>
                </div>
                <div>
                  <strong>{formatMoney(item.personalTotal.toFixed(2))}</strong>
                  {item.owedTotal > 0 && (
                    <span>Owed {formatMoney(item.owedTotal.toFixed(2))}</span>
                  )}
                </div>
              </button>
            ))}
            </div>
          )}

          {dashboardChartMode === 'expenses' && (
            <div className="table-wrap dashboard-category-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="table-sort-button"
                      onClick={() => toggleCategorySort('category')}
                    >
                      Category <span>{getCategorySortLabel('category')}</span>
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort-button"
                      onClick={() => toggleCategorySort('count')}
                    >
                      Count <span>{getCategorySortLabel('count')}</span>
                    </button>
                  </th>
                  <th className="right">
                    <button
                      type="button"
                      className="table-sort-button table-sort-button-right"
                      onClick={() => toggleCategorySort('personal')}
                    >
                      Personal <span>{getCategorySortLabel('personal')}</span>
                    </button>
                  </th>
                  <th className="right">
                    <button
                      type="button"
                      className="table-sort-button table-sort-button-right"
                      onClick={() => toggleCategorySort('owed')}
                    >
                      Owed <span>{getCategorySortLabel('owed')}</span>
                    </button>
                  </th>
                  <th className="right">
                    <button
                      type="button"
                      className="table-sort-button table-sort-button-right"
                      onClick={() => toggleCategorySort('gross')}
                    >
                      Gross <span>{getCategorySortLabel('gross')}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCategoryRollups.map((item) => (
                  <tr
                    key={item.category}
                    className={`${isFullyReimbursed(item) ? 'fully-reimbursed-row' : ''} clickable-row`}
                    onClick={() => handleCategoryClick(item.category)}
                  >
                    <td>
                      <button type="button" className="category-drilldown-button">
                        {item.category}
                      </button>
                    </td>
                    <td>{item.count}</td>
                    <td className="right amount-primary">{formatMoney(item.personalTotal.toFixed(2))}</td>
                    <td className="right amount-muted">{formatMoney(item.owedTotal.toFixed(2))}</td>
                    <td className="right amount-muted">{formatMoney(item.grossTotal.toFixed(2))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
