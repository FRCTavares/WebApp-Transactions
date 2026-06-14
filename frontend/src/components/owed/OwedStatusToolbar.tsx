import type { OwedStatusFilter } from '../../types/api'

const statusOptions: Array<{ value: '' | OwedStatusFilter; label: string }> = [
  { value: 'active', label: 'Current owed' },
  { value: '', label: 'All history' },
  { value: 'open', label: 'Open' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
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
    <div className="toolbar">
      <select
        value={statusFilter}
        onChange={(event) => onStatusFilterChange(event.target.value as '' | OwedStatusFilter)}
      >
        {statusOptions.map((option) => (
          <option key={option.value || 'all'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button type="button" onClick={onRefresh}>
        Refresh
      </button>

      <button type="button" onClick={() => onStatusFilterChange('active')}>
        Current
      </button>

      <button type="button" onClick={() => onStatusFilterChange('')}>
        All History
      </button>

      <button type="button" onClick={() => onStatusFilterChange('open')}>
        Open
      </button>

      <button type="button" onClick={() => onStatusFilterChange('partially_paid')}>
        Partially Paid
      </button>

      <button type="button" onClick={() => onStatusFilterChange('paid')}>
        Paid
      </button>
    </div>
  )
}
