import { Button } from '../ui'
type InvestmentFiltersPanelProps = {
  activeFilterCount: number
  eventType: string
  source: string
  month: string
  dateFrom: string
  dateTo: string
  onEventTypeChange: (value: string) => void
  onSourceChange: (value: string) => void
  onMonthChange: (value: string) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onApplyFilters: () => void
  onClearFilters: () => void
}

export function InvestmentFiltersPanel({
  activeFilterCount,
  eventType,
  source,
  month,
  dateFrom,
  dateTo,
  onEventTypeChange,
  onSourceChange,
  onMonthChange,
  onDateFromChange,
  onDateToChange,
  onApplyFilters,
  onClearFilters,
}: InvestmentFiltersPanelProps) {
  return (
    <details className="filter-panel compact-filter-panel">
      <summary>
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className="filter-count">{activeFilterCount} active</span>
        )}
      </summary>

      <div className="form-row">
        <label>
          Event Type
          <select
            value={eventType}
            onChange={(event) => onEventTypeChange(event.target.value)}
          >
            <option value="">All event types</option>
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="market_buy">Market Buy</option>
            <option value="market_sell">Market Sell</option>
            <option value="dividend">Dividend</option>
            <option value="interest">Interest</option>
            <option value="fx_conversion">FX Conversion</option>
          </select>
        </label>

        <label>
          Source
          <select
            value={source}
            onChange={(event) => onSourceChange(event.target.value)}
          >
            <option value="">All sources</option>
            <option value="trading212">Trading 212</option>
            <option value="manual">Manual</option>
          </select>
        </label>

        <label>
          Month
          <input
            type="month"
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
          />
        </label>

        <label>
          Date From
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
          />
        </label>

        <label>
          Date To
          <input
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
          />
        </label>
      </div>

      <div className="action-group">
        <Button type="button" variant="primary" onClick={onApplyFilters}>
          Apply Filters
        </Button>
        <Button type="button" onClick={onClearFilters}>
          Clear Filters
        </Button>
      </div>
    </details>
  )
}
