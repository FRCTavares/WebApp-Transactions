import type { OwedStatusFilter } from '../../types/api'
import { Button } from '../ui'

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
        <Button type="button" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </div>
  )
}
