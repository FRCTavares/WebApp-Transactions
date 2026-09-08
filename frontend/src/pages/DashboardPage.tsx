import { useEffect, useMemo, useState } from 'react'
import { getInvestmentMonthlyChange } from '../api/investmentEvents'
import { listTransactions } from '../api/transactions'
import { getCategorySummary, getMonthlySummary } from '../api/summary'
import type {
  CategorySummaryItem,
  CategorySummaryResponse,
  InvestmentMonthlyChange,
  MonthlySummary,
  Transaction,
} from '../types/api'
import { formatMonthLabel } from '../utils/format'
import { isFullyOwedTransaction } from '../utils/dashboardTransactions'
import { StatusMessage } from '../components/StatusMessage'
import { ExpenseCategoryDonutChart } from '../components/dashboard/ExpenseCategoryDonutChart'
import { MonthlyCashflowPanel } from '../components/dashboard/MonthlyCashflowPanel'
import { RecentTransactionsList } from '../components/dashboard/RecentTransactionsList'
import { CategoryDetailPanel } from '../components/dashboard/CategoryDetailPanel'
import { Card, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { usePeriod } from '../hooks/usePeriod'

type CategoryRollup = {
  category: string
  count: number
  personalTotal: number
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

function buildCategoryRollups(items: CategorySummaryItem[]): CategoryRollup[] {
  const rollups = new Map<string, CategoryRollup>()

  for (const item of items) {
    const current = rollups.get(item.category) ?? {
      category: item.category,
      count: 0,
      personalTotal: 0,
    }

    current.count += item.count
    current.personalTotal += toNumber(item.personal_total)

    rollups.set(item.category, current)
  }

  return Array.from(rollups.values()).sort((first, second) => {
    const difference = second.personalTotal - first.personalTotal

    return difference !== 0
      ? difference
      : first.category.localeCompare(second.category)
  })
}

type DashboardPageProps = {
  greeting: string
  displayName: string
}

export function DashboardPage({ greeting, displayName }: DashboardPageProps) {
  const { year, month } = usePeriod()
  const { accessToken, isAuthEnabled, isLoading: isAuthLoading } = useAuth()
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [investmentMonthlyChange, setInvestmentMonthlyChange] =
    useState<InvestmentMonthlyChange | null>(null)
  const [categories, setCategories] = useState<CategorySummaryResponse | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryTransactions, setCategoryTransactions] = useState<Transaction[]>([])
  const [categoryDetailsLoading, setCategoryDetailsLoading] = useState(false)
  const [isDashboardLoading, setIsDashboardLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataWarning, setDataWarning] = useState<string | null>(null)

  const sortedCategoryRollups = useMemo(
    () => buildCategoryRollups(categories?.items ?? []),
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
      setCategoryError(null)
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
          limit: 500,
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
          setCategoryError(null)
        } else {
          const categoryMessage =
            categoryResult.reason instanceof Error
              ? categoryResult.reason.message
              : 'Failed to load category summary'

          setCategoryError(categoryMessage)
          requiredErrors.push(categoryMessage)
        }

        if (recentTransactionsResult.status === 'fulfilled') {
          setRecentTransactions(
            recentTransactionsResult.value
              .filter((transaction) => !isFullyOwedTransaction(transaction))
              .slice(0, 6),
          )
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
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load category details',
        )
      })
      .finally(() => {
        setCategoryDetailsLoading(false)
      })
  }

  const monthLabel = formatMonthLabel(
    `${year}-${String(month).padStart(2, '0')}`,
    'long',
  )

  return (
    <section className="app-page dashboard-page">
      <PageHeader
        eyebrow={`${greeting}, ${displayName}`}
        title="Dashboard"
        meta={
          <p className="muted small" role="status">
            {monthLabel}
          </p>
        }
      />

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
          <Card padding="md" aria-hidden="true">
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="block" height="8rem" />
          </Card>

          <div className="dashboard-main-grid" aria-hidden="true">
            <Card padding="md">
              <Skeleton variant="text" width="40%" height="1.25rem" />
              <Skeleton variant="block" height="12rem" />
            </Card>
            <Card padding="md">
              <Skeleton variant="text" width="40%" height="1.25rem" />
              <Skeleton variant="block" height="12rem" />
            </Card>
          </div>
        </>
      )}

      {summary && (
        <>
          <MonthlyCashflowPanel
            summary={summary}
            monthLabel={monthLabel}
            investmentChange={investmentMonthlyChange}
          />

          <div className="dashboard-main-grid">
            <Card as="section" padding="md" className="dashboard-spending-panel">
              <ExpenseCategoryDonutChart
                items={sortedCategoryRollups}
                title="Spending breakdown"
                description="Personal spending by category."
                emptyMessage="No personal spending found for this month."
                error={categoryError}
                isLoading={isDashboardLoading && categories === null}
                onSelectCategory={handleCategoryClick}
              />
            </Card>

            <RecentTransactionsList
              transactions={recentTransactions}
              monthLabel={monthLabel}
            />
          </div>

          {selectedCategory && (
            <CategoryDetailPanel
              category={selectedCategory}
              transactions={categoryTransactions}
              isLoading={categoryDetailsLoading}
              onClose={() => handleCategoryClick(selectedCategory)}
            />
          )}
        </>
      )}
    </section>
  )
}
