import { useEffect, useState } from 'react'
import { getMonthlySummary } from '../../api/summary'
import { usePeriod } from '../../hooks/usePeriod'
import { formatMoney, formatMonthLabel } from '../../utils/format'
import { Card } from '../ui'
import '../../styles/monthly-trend.css'

const MONTHS = 6

/** "€1.9K": the six columns are narrow on a phone, where full amounts run into each other. */
function formatCompact(value: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: value >= 1000 ? 1 : 0 }).format(value)
}

type TrendMonth = { year: number; month: number; key: string; moneyIn: number; spent: number }

function monthsEndingAt(year: number, month: number) {
  return Array.from({ length: MONTHS }, (_, index) => {
    const date = new Date(year, month - 1 - (MONTHS - 1 - index), 1)
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    return { year: y, month: m, key: `${y}-${String(m).padStart(2, '0')}` }
  })
}

/** Money in against personal spending for the six months ending at the chosen one; a column selects that month. */
export function MonthlyTrendPanel({ year, month }: { year: number; month: number }) {
  const { setPeriod } = usePeriod()
  const [months, setMonths] = useState<TrendMonth[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      monthsEndingAt(year, month).map(async (entry) => {
        try {
          const summary = await getMonthlySummary(entry.year, entry.month)
          return { ...entry, moneyIn: Number(summary.money_in), spent: Number(summary.personal_money_out) }
        } catch {
          return { ...entry, moneyIn: 0, spent: 0 }
        }
      }),
    ).then((loaded) => {
      if (!cancelled) setMonths(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [year, month])

  if (!months || months.every((entry) => entry.moneyIn === 0 && entry.spent === 0)) return null
  // One unusual month (a big purchase) would flatten the rest, so bars are scaled to about twice a typical month and
  // anything above is cut off with a break mark; the exact spending is printed under every column.
  const peaks = months.map((entry) => Math.max(entry.moneyIn, entry.spent)).sort((a, b) => a - b)
  const median = ((peaks[Math.floor((peaks.length - 1) / 2)] ?? 0) + (peaks[Math.ceil((peaks.length - 1) / 2)] ?? 0)) / 2
  const cap = Math.max(median * 2, 1)
  const scale = Math.min(Math.max(...peaks, 1), cap)
  const heightOf = (value: number) => `${Math.min(value / scale, 1) * 100}%`
  const isCut = (value: number) => value > scale

  return (
    <Card as="section" padding="md" className="monthly-trend" aria-label="Last six months">
      <div className="monthly-trend-header">
        <h2>Last 6 months</h2>
        <span className="monthly-trend-legend">
          <i className="monthly-trend-dot is-in" /> In
          <i className="monthly-trend-dot is-out" /> Spent
        </span>
      </div>
      <div className="monthly-trend-columns">
        {months.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={`monthly-trend-column${entry.year === year && entry.month === month ? ' is-selected' : ''}`}
            aria-label={`${formatMonthLabel(entry.key, 'long')}: in ${formatMoney(entry.moneyIn.toFixed(2))}, spent ${formatMoney(entry.spent.toFixed(2))}`}
            onClick={() => setPeriod(entry.year, entry.month)}
          >
            <span className="monthly-trend-bars">
              <span className={`monthly-trend-bar is-in${isCut(entry.moneyIn) ? ' is-cut' : ''}`} style={{ height: heightOf(entry.moneyIn) }} />
              <span className={`monthly-trend-bar is-out${isCut(entry.spent) ? ' is-cut' : ''}`} style={{ height: heightOf(entry.spent) }} />
            </span>
            <span className="monthly-trend-spent monthly-trend-full">{formatMoney(entry.spent.toFixed(0))}</span>
            <span className="monthly-trend-spent monthly-trend-compact">{formatCompact(entry.spent)}</span>
            <span className="monthly-trend-label">{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(entry.year, entry.month - 1, 1))}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}
