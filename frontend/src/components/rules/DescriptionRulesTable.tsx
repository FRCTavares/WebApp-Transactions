import type { DescriptionRule } from '../../types/api'

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
