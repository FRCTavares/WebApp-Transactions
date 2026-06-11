import type { CategoryRule } from '../../types/api'

type CategoryRulesTableProps = {
  rules: CategoryRule[]
  onEdit: (rule: CategoryRule) => void
  onToggle: (rule: CategoryRule) => void
  onDelete: (rule: CategoryRule) => void
}

export function CategoryRulesTable({
  rules,
  onEdit,
  onToggle,
  onDelete,
}: CategoryRulesTableProps) {
  if (rules.length === 0) {
    return <p className="muted">No category rules found.</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Match</th>
            <th>Category</th>
            <th>Direction</th>
            <th>Source</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.name}</td>
              <td>{rule.match_text}</td>
              <td>
                <span className="badge badge-neutral">{rule.category}</span>
              </td>
              <td>
                {rule.direction ? (
                  <span className={`badge badge-direction-${rule.direction}`}>
                    {rule.direction}
                  </span>
                ) : (
                  <span className="muted">-</span>
                )}
              </td>
              <td>
                {rule.source ? (
                  <span className="badge badge-source">{rule.source}</span>
                ) : (
                  <span className="muted">-</span>
                )}
              </td>
              <td>
                <span className={`badge ${rule.is_active ? 'badge-active' : 'badge-inactive'}`}>
                  {rule.is_active ? 'active' : 'inactive'}
                </span>
              </td>
              <td>
                <div className="action-group">
                  <button type="button" onClick={() => onEdit(rule)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => onToggle(rule)}>
                    {rule.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => onDelete(rule)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
