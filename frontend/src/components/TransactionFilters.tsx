import { CategorySelect } from './CategorySelect'

export type TransactionFilterState = {
  search: string
  category: string
  source: string
  dateFrom: string
  dateTo: string
}

const sourceOptions = [
  { value: '', label: 'All sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'revolut', label: 'Revolut' },
  { value: 'activobank', label: 'ActivoBank' },
  { value: 'trading212', label: 'Trading 212' },
]

type TransactionFiltersProps = {
  filters: TransactionFilterState
  onChange: (field: keyof TransactionFilterState, value: string) => void
  onApply: () => void
  onClear: () => void
}

export function TransactionFilters({
  filters,
  onChange,
  onApply,
  onClear,
}: TransactionFiltersProps) {
  return (
    <div className="filter-panel">
      <h2>Filters</h2>

      <div className="form-row">
        <label>
          Search
          <input
            value={filters.search}
            onChange={(event) => onChange('search', event.target.value)}
            placeholder="Search description"
          />
        </label>

        <CategorySelect
          label="Category"
          value={filters.category}
          onChange={(value) => onChange('category', value)}
        />

        <label>
          Source
          <select
            value={filters.source}
            onChange={(event) => onChange('source', event.target.value)}
          >
            {sourceOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Date From
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => onChange('dateFrom', event.target.value)}
          />
        </label>

        <label>
          Date To
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => onChange('dateTo', event.target.value)}
          />
        </label>
      </div>

      <div className="action-group">
        <button type="button" onClick={onApply}>
          Apply Filters
        </button>
        <button type="button" onClick={onClear}>
          Clear Filters
        </button>
      </div>
    </div>
  )
}
