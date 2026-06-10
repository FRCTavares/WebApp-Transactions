import { useEffect, useState } from 'react'
import {
  applyCategoryRules,
  createCategoryRule,
  deleteCategoryRule,
  listCategoryRuleSuggestions,
  listCategoryRules,
  updateCategoryRule,
} from '../api/categoryRules'
import { CategorySelect } from '../components/CategorySelect'
import { StatusMessage } from '../components/StatusMessage'
import type { CategoryRule, CategoryRuleSuggestion } from '../types/api'
import { formatMoney } from '../utils/format'

function getSuggestionKey(suggestion: CategoryRuleSuggestion) {
  return `${suggestion.description}-${suggestion.source}-${suggestion.direction}`
}

export function CategoryRulesPage() {
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [suggestions, setSuggestions] = useState<CategoryRuleSuggestion[]>([])
  const [suggestionCategories, setSuggestionCategories] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadData() {
    Promise.all([listCategoryRules(), listCategoryRuleSuggestions()])
      .then(([rulesData, suggestionData]) => {
        setRules(rulesData)
        setSuggestions(suggestionData)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load category rules')
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  function updateSuggestionCategory(suggestion: CategoryRuleSuggestion, category: string) {
    setSuggestionCategories((currentCategories) => ({
      ...currentCategories,
      [getSuggestionKey(suggestion)]: category,
    }))
  }

  async function addRuleFromSuggestion(suggestion: CategoryRuleSuggestion) {
    const suggestionKey = getSuggestionKey(suggestion)
    const category = suggestionCategories[suggestionKey]?.trim()

    if (!category) {
      setError('Choose a category before creating the rule.')
      return
    }

    setError(null)
    setMessage(null)

    try {
      await createCategoryRule({
        name: `${category} - ${suggestion.description}`,
        category,
        match_text: suggestion.description,
        match_field: 'description',
        direction: suggestion.direction,
        source: suggestion.source,
        is_active: true,
      })

      setSuggestionCategories((currentCategories) => {
        const nextCategories = { ...currentCategories }
        delete nextCategories[suggestionKey]
        return nextCategories
      })

      setMessage('Rule created.')
      loadData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create rule')
    }
  }

  async function handleApplyRules() {
    setError(null)
    setMessage(null)

    try {
      await applyCategoryRules()
      setMessage('Rules applied.')
      loadData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to apply rules')
    }
  }

  async function handleToggleRule(rule: CategoryRule) {
    setError(null)
    setMessage(null)

    try {
      await updateCategoryRule(rule.id, {
        is_active: !rule.is_active,
      })

      setMessage(rule.is_active ? 'Rule deactivated.' : 'Rule activated.')
      loadData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update rule')
    }
  }

  async function handleDeleteRule(rule: CategoryRule) {
    const confirmed = window.confirm(`Delete rule "${rule.name}"?`)

    if (!confirmed) {
      return
    }

    setError(null)
    setMessage(null)

    try {
      await deleteCategoryRule(rule.id)
      setMessage('Rule deleted.')
      loadData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to delete rule')
    }
  }

  return (
    <section>
      <h1>Categories / Rules</h1>

      <div className="toolbar">
        <button type="button" onClick={handleApplyRules}>
          Apply rules to existing transactions
        </button>
      </div>

      <StatusMessage error={error} message={message} />

      <h2>Suggestions</h2>
      {suggestions.length === 0 ? (
        <p className="muted">No uncategorised suggestions found.</p>
      ) : (
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
                const selectedCategory = suggestionCategories[suggestionKey] ?? ''

                return (
                  <tr key={suggestionKey}>
                    <td>{suggestion.description}</td>
                    <td>{suggestion.source}</td>
                    <td>{suggestion.direction}</td>
                    <td>{suggestion.count}</td>
                    <td className="right">{formatMoney(suggestion.total)}</td>
                    <td>
                      <CategorySelect
                        label="Category"
                        value={selectedCategory}
                        onChange={(category) => updateSuggestionCategory(suggestion, category)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={!selectedCategory}
                        onClick={() => addRuleFromSuggestion(suggestion)}
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
      )}

      <h2>Rules</h2>
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
                <td>{rule.category}</td>
                <td>{rule.direction ?? '-'}</td>
                <td>{rule.source ?? '-'}</td>
                <td>{rule.is_active ? 'yes' : 'no'}</td>
                <td>
                  <div className="action-group">
                    <button type="button" onClick={() => handleToggleRule(rule)}>
                      {rule.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleDeleteRule(rule)}
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
    </section>
  )
}
