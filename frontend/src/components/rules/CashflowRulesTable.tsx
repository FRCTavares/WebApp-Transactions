import type { CashflowRule } from '../../types/api'

type CashflowRulesTableProps = {
  rules: CashflowRule[]
}

function formatCashflowType(cashflowType: string) {
  return cashflowType.replace('_', ' ')
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
              <td>{formatCashflowType(rule.cashflow_type)}</td>
              <td>{rule.direction ?? '-'}</td>
              <td>{rule.source ?? '-'}</td>
              <td>{rule.is_active ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
