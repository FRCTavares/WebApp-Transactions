import { usePeriod } from '../hooks/usePeriod'
import { formatMonthLabel } from '../utils/format'

function getMonthLabel(monthKey: string) {
  return formatMonthLabel(monthKey)
}

export function GlobalPeriodSelector() {
  const { monthKey, setMonthKey, shiftMonth, resetToCurrentMonth } = usePeriod()

  return (
    <div className="global-period-selector" aria-label="Global month selector">
      <button type="button" onClick={() => shiftMonth(-1)}>
        ‹
      </button>

      <label>
        <span>Period</span>
        <input
          type="month"
          value={monthKey}
          onChange={(event) => setMonthKey(event.target.value)}
          aria-label="Selected app period"
        />
      </label>

      <button type="button" onClick={() => shiftMonth(1)}>
        ›
      </button>

      <button type="button" onClick={resetToCurrentMonth}>
        Today
      </button>

      <strong>{getMonthLabel(monthKey)}</strong>
    </div>
  )
}
