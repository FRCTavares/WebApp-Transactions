import type { DescriptionRuleSuggestion } from '../../types/api'
import { formatMoney } from '../../utils/format'
import { Badge, Button } from '../ui'
import {
  formatDirection,
  formatSource,
  getDirectionTone,
} from '../../utils/badgeLabels'

type DescriptionSuggestionsTableProps = {
  suggestions: DescriptionRuleSuggestion[]
  descriptionsByKey: Record<string, string>
  getSuggestionKey: (suggestion: DescriptionRuleSuggestion) => string
  onDescriptionChange: (
    suggestion: DescriptionRuleSuggestion,
    cleanedDescription: string,
  ) => void
  onAddRule: (suggestion: DescriptionRuleSuggestion) => void
}

export function DescriptionSuggestionsTable({
  suggestions,
  descriptionsByKey,
  getSuggestionKey,
  onDescriptionChange,
  onAddRule,
}: DescriptionSuggestionsTableProps) {
  if (suggestions.length === 0) {
    return <p className="muted">No description suggestions found.</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Raw Description</th>
            <th>Current Description</th>
            <th>Source</th>
            <th>Direction</th>
            <th>Count</th>
            <th className="right">Total</th>
            <th>Clean Description</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.map((suggestion) => {
            const suggestionKey = getSuggestionKey(suggestion)
            const cleanedDescription = descriptionsByKey[suggestionKey] ?? ''

            return (
              <tr key={suggestionKey}>
                <td>{suggestion.raw_description}</td>
                <td>{suggestion.description}</td>
                <td>
                  <Badge>{formatSource(suggestion.source)}</Badge>
                </td>
                <td>
                  <Badge tone={getDirectionTone(suggestion.direction)}>
                    {formatDirection(suggestion.direction)}
                  </Badge>
                </td>
                <td>{suggestion.count}</td>
                <td className="right">{formatMoney(suggestion.total)}</td>
                <td>
                  <input
                    className="table-input"
                    value={cleanedDescription}
                    onChange={(event) => onDescriptionChange(suggestion, event.target.value)}
                    placeholder={suggestion.description}
                  />
                </td>
                <td>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={!cleanedDescription}
                    onClick={() => onAddRule(suggestion)}
                  >
                    Add rule
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
