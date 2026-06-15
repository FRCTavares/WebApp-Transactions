import { useEffect, useMemo, useState } from 'react'
import { getInvestmentMonthlyChange } from '../api/investmentEvents'
import { getCategorySummary, getMonthlySummary } from '../api/summary'
import type { CategorySummaryItem, CategorySummaryResponse, InvestmentMonthlyChange, MonthlySummary } from '../types/api'
import { formatMoney } from '../utils/format'
import { StatusMessage } from '../components/StatusMessage'
import { usePeriod } from '../context/PeriodContext'

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

function toNumber(value: string) {
  return Number(value)
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
    .filter((item) => item.personalTotal > 0)
    .sort((first, second) => second.personalTotal - first.personalTotal)
}

function isFullyReimbursed(item: CategorySummaryItem) {
  return toNumber(item.personal_total) === 0 && toNumber(item.owed_total) > 0
}

export function DashboardPage() {
  const { year, month } = usePeriod()
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [investmentMonthlyChange, setInvestmentMonthlyChange] =
    useState<InvestmentMonthlyChange | null>(null)
  const [categories, setCategories] = useState<CategorySummaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const categoryRollups = useMemo(
    () => buildCategoryRollups(categories?.items ?? []),
    [categories],
  )
  const topPersonalCategories = categoryRollups.slice(0, 5)

  useEffect(() => {
    setError(null)

    Promise.all([
      getMonthlySummary(year, month),
      getInvestmentMonthlyChange(year, month),
      getCategorySummary('out', year, month),
    ])
      .then(([summaryData, investmentMonthlyChangeData, categoryData]) => {
        setSummary(summaryData)
        setInvestmentMonthlyChange(investmentMonthlyChangeData)
        setCategories(categoryData)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load dashboard')
      })
  }, [year, month])

  return (
    <section>
      <h1>Dashboard</h1>

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

          <div className="dashboard-section-header">
            <div>
              <h2>Top Personal Expense Categories</h2>
              <p className="muted small">Personal is the real amount you paid after owed/reimbursable parts.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="right">Personal</th>
                  <th className="right">Owed</th>
                  <th className="right">Gross</th>
                </tr>
              </thead>
              <tbody>
                {topPersonalCategories.map((item) => (
                  <tr key={item.category}>
                    <td>{item.category}</td>
                    <td className="right amount-primary">{formatMoney(item.personalTotal.toFixed(2))}</td>
                    <td className="right amount-muted">{formatMoney(item.owedTotal.toFixed(2))}</td>
                    <td className="right amount-muted">{formatMoney(item.grossTotal.toFixed(2))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {categories && (
        <>
          <div className="dashboard-section-header">
            <div>
              <h2>All Expense Categories This Month</h2>
              <p className="muted small">Rows with 0 € personal cost were fully owed or reimbursed.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Subcategory</th>
                  <th>Count</th>
                  <th className="right">Personal</th>
                  <th className="right">Owed</th>
                  <th className="right">Gross</th>
                </tr>
              </thead>
              <tbody>
                {categories.items.map((item) => (
                  <tr
                    key={`${item.category}-${item.subcategory ?? ''}`}
                    className={isFullyReimbursed(item) ? 'fully-reimbursed-row' : undefined}
                  >
                    <td>{item.category}</td>
                    <td>{item.subcategory ?? '-'}</td>
                    <td>{item.count}</td>
                    <td className="right amount-primary">{formatMoney(item.personal_total)}</td>
                    <td className="right amount-muted">{formatMoney(item.owed_total)}</td>
                    <td className="right amount-muted">{formatMoney(item.gross_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
