import type { DescriptionRule } from '../../types/api'
import { Badge } from '../ui'
import {
  formatDirection,
  formatSource,
  getDirectionTone,
} from '../../utils/badgeLabels'

type DescriptionRulesTableProps = {
  rules: DescriptionRule[]
}

export function DescriptionRulesTable({ rules }: DescriptionRulesTableProps) {
  if (rules.length === 0) {
    return <p className="muted">No description rules found.</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Match</th>
            <th>Clean Description</th>
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
              <td>{rule.cleaned_description}</td>
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
