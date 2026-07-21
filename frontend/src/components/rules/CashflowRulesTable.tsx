import type { CashflowRule } from '../../types/api'
import { Badge } from '../ui'
import {
  formatCashflowType,
  formatDirection,
  formatSource,
  getCashflowTone,
  getDirectionTone,
} from '../../utils/badgeLabels'

type CashflowRulesTableProps = {
  rules: CashflowRule[]
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
                <Badge tone={getCashflowTone(rule.cashflow_type)}>
                  {formatCashflowType(rule.cashflow_type)}
                </Badge>
              </td>
              <td>
                {rule.direction ? (
                  <Badge tone={getDirectionTone(rule.direction)}>
                    {formatDirection(rule.direction)}
                  </Badge>
                ) : (
                  <span className="muted">-</span>
                )}
              </td>
              <td>
                {rule.source ? (
                  <Badge>{formatSource(rule.source)}</Badge>
                ) : (
                  <span className="muted">-</span>
                )}
              </td>
              <td>
                <Badge tone={rule.is_active ? 'positive' : 'neutral'}>
                  {rule.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
