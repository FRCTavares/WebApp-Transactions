import { useEffect, useState } from 'react'
import { getCategorySummary, getMonthlySummary } from '../api/summary'
import type { CategorySummaryResponse, MonthlySummary } from '../types/api'
import { formatMoney } from '../utils/format'
import { StatusMessage } from '../components/StatusMessage'

const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

function getCurrentYearMonth() {
  const now = new Date()

  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }
}

export function DashboardPage() {
  const currentYearMonth = getCurrentYearMonth()
  const [year, setYear] = useState(currentYearMonth.year)
  const [month, setMonth] = useState(currentYearMonth.month)
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [categories, setCategories] = useState<CategorySummaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)

    Promise.all([getMonthlySummary(year, month), getCategorySummary('out', year, month)])
      .then(([summaryData, categoryData]) => {
        setSummary(summaryData)
        setCategories(categoryData)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load dashboard')
      })
  }, [year, month])

  return (
    <section>
      <h1>Dashboard</h1>
      <p className="muted page-subtitle">
        Showing {String(month).padStart(2, '0')}/{year}
      </p>

      <div className="filter-panel">
        <h2>Period</h2>

        <div className="form-row">
          <label>
            Month
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Year
            <input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </label>
        </div>
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
              <span>Money Out</span>
              <strong>{formatMoney(summary.money_out)}</strong>
            </div>
            <div className="card">
              <span>Net</span>
              <strong>{formatMoney(summary.net)}</strong>
            </div>
            <div className="card">
              <span>Open Owed</span>
              <strong>{formatMoney(summary.open_owed_amount)}</strong>
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
