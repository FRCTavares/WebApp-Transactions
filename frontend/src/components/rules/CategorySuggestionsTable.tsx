import { CategorySelect } from '../CategorySelect'
import type { CategoryRuleSuggestion } from '../../types/api'
import { formatMoney } from '../../utils/format'

type CategorySuggestionsTableProps = {
  suggestions: CategoryRuleSuggestion[]
  categoriesByKey: Record<string, string>
  getSuggestionKey: (suggestion: CategoryRuleSuggestion) => string
  onCategoryChange: (suggestion: CategoryRuleSuggestion, category: string) => void
  onAddRule: (suggestion: CategoryRuleSuggestion) => void
}

export function CategorySuggestionsTable({
  suggestions,
  categoriesByKey,
  getSuggestionKey,
  onCategoryChange,
  onAddRule,
}: CategorySuggestionsTableProps) {
  if (suggestions.length === 0) {
    return <p className="muted">No uncategorised suggestions found.</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Source</th>
            <th>Direction</th>
            <th>Count</th>
            <th className="right">Total</th>
            <th>Category</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.map((suggestion) => {
            const suggestionKey = getSuggestionKey(suggestion)
            const selectedCategory = categoriesByKey[suggestionKey] ?? ''

            return (
              <tr key={suggestionKey}>
                <td>{suggestion.description}</td>
                <td>
                  <span className="badge badge-source">{suggestion.source}</span>
                </td>
                <td>
                  <span className={`badge badge-direction-${suggestion.direction}`}>
                    {suggestion.direction}
                  </span>
                </td>
                <td>{suggestion.count}</td>
                <td className="right">{formatMoney(suggestion.total)}</td>
                <td>
                  <CategorySelect
                    label="Category"
                    value={selectedCategory}
                    onChange={(category) => onCategoryChange(suggestion, category)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!selectedCategory}
                    onClick={() => onAddRule(suggestion)}
                  >
                    Add rule
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
