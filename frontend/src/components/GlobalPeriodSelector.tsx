import { usePeriod } from '../hooks/usePeriod'
import './GlobalPeriodSelector.css'

/**
 * Month switcher for the pages that are about one month (Dashboard, Transactions).
 * It sits in the page header's actions; "Today" only shows once you have moved away from the current month.
 */
export function GlobalPeriodSelector() {
  const { monthKey, setMonthKey, shiftMonth, resetToCurrentMonth } = usePeriod()
  const now = new Date()
  const isCurrentMonth = monthKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="period-switcher" role="group" aria-label="Month">
      <button type="button" className="period-switcher-step" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
        ‹
      </button>
      <input
        className="period-switcher-month"
        type="month"
        value={monthKey}
        onChange={(event) => event.target.value && setMonthKey(event.target.value)}
        aria-label="Selected app period"
      />
      <button type="button" className="period-switcher-step" aria-label="Next month" onClick={() => shiftMonth(1)}>
        ›
      </button>
      {!isCurrentMonth && (
        <button type="button" className="period-switcher-today" onClick={resetToCurrentMonth}>
          Today
        </button>
      )}
    </div>
  )
}
