import { useEffect, useState } from 'react'
import { getInvestmentMonthlyChange } from '../api/investmentEvents'
import { getCategorySummary, getMonthlySummary } from '../api/summary'
import type { CategorySummaryResponse, InvestmentMonthlyChange, MonthlySummary } from '../types/api'
import { formatMoney } from '../utils/format'
import { StatusMessage } from '../components/StatusMessage'
import { usePeriod } from '../context/PeriodContext'

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

export function DashboardPage() {
  const { year, month } = usePeriod()
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [investmentMonthlyChange, setInvestmentMonthlyChange] =
    useState<InvestmentMonthlyChange | null>(null)
  const [categories, setCategories] = useState<CategorySummaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

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

          <h2>Top Expense Categories</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.top_expense_categories.map((item) => (
                  <tr key={item.category}>
                    <td>{item.category}</td>
                    <td className="right">{formatMoney(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {categories && (
        <>
          <h2>All Expense Categories This Month</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Subcategory</th>
                  <th>Count</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {categories.items.map((item) => (
                  <tr key={`${item.category}-${item.subcategory ?? ''}`}>
                    <td>{item.category}</td>
                    <td>{item.subcategory ?? '-'}</td>
                    <td>{item.count}</td>
                    <td className="right">{formatMoney(item.total)}</td>
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
