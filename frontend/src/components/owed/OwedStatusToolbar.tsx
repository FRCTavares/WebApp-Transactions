import type { OwedStatusFilter } from '../../types/api'

const statusOptions: Array<{ value: '' | OwedStatusFilter; label: string }> = [
  { value: 'active', label: 'Current owed' },
  { value: '', label: 'All history' },
  { value: 'open', label: 'Open only' },
  { value: 'partially_paid', label: 'Partially paid only' },
  { value: 'paid', label: 'Paid history' },
  { value: 'cancelled', label: 'Cancelled' },
]

type OwedStatusToolbarProps = {
  statusFilter: '' | OwedStatusFilter
  onStatusFilterChange: (status: '' | OwedStatusFilter) => void
  onRefresh: () => void
}

export function OwedStatusToolbar({
  statusFilter,
  onStatusFilterChange,
  onRefresh,
}: OwedStatusToolbarProps) {
  return (
    <div className="owed-toolbar">
      <div>
        <label className="owed-toolbar-label" htmlFor="owed-status-filter">
          View
        </label>
        <select
          id="owed-status-filter"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as '' | OwedStatusFilter)}
        >
          {statusOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="owed-toolbar-actions">
        <button type="button" onClick={() => onStatusFilterChange('active')}>
          Current
        </button>

        <button type="button" onClick={() => onStatusFilterChange('paid')}>
          Paid history
        </button>

        <button type="button" onClick={() => onStatusFilterChange('')}>
          All history
        </button>

        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>
    </div>
  )
}
