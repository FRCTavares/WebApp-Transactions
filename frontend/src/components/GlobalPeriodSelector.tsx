import { usePeriod } from '../hooks/usePeriod'

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)

  return date.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })
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
