import type { CashflowRule } from '../../types/api'

type CashflowRulesTableProps = {
  rules: CashflowRule[]
}

function formatCashflowType(cashflowType: string) {
  return cashflowType.replaceAll('_', ' ')
}

export function CashflowRulesTable({ rules }: CashflowRulesTableProps) {
  if (rules.length === 0) {
    return <p className="muted">No cashflow rules found.</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Match</th>
            <th>Type</th>
            <th>Direction</th>
            <th>Source</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.name}</td>
              <td>{rule.match_text}</td>
              <td>
                <span className={`badge badge-${rule.cashflow_type.replaceAll('_', '-')}`}>
                  {formatCashflowType(rule.cashflow_type)}
                </span>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
