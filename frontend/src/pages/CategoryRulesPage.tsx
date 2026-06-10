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
import type { CategoryRule, CategoryRuleSuggestion, Direction } from '../types/api'
import { formatMoney } from '../utils/format'

type MatchField = 'description' | 'raw_description' | 'merchant'

type RuleFormState = {
  name: string
  category: string
  subcategory: string
  match_text: string
  match_field: MatchField
  direction: Direction | ''
  source: string
  is_active: boolean
}

const INITIAL_RULE_FORM: RuleFormState = {
  name: '',
  category: '',
  subcategory: '',
  match_text: '',
  match_field: 'description',
  direction: '',
  source: '',
  is_active: true,
}

const SOURCE_OPTIONS = [
  '',
  'manual',
  'revolut',
  'activobank',
  'trading212',
]

function getSuggestionKey(suggestion: CategoryRuleSuggestion) {
  return `${suggestion.description}-${suggestion.source}-${suggestion.direction}`
}

export function CategoryRulesPage() {
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [suggestions, setSuggestions] = useState<CategoryRuleSuggestion[]>([])
  const [suggestionCategories, setSuggestionCategories] = useState<Record<string, string>>({})
  const [ruleForm, setRuleForm] = useState<RuleFormState>(INITIAL_RULE_FORM)
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

  function updateRuleForm(field: keyof RuleFormState, value: string | boolean) {
    setRuleForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateSuggestionCategory(suggestion: CategoryRuleSuggestion, category: string) {
    setSuggestionCategories((currentCategories) => ({
      ...currentCategories,
      [getSuggestionKey(suggestion)]: category,
    }))
  }

  async function handleCreateManualRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = ruleForm.name.trim()
    const category = ruleForm.category.trim()
    const matchText = ruleForm.match_text.trim()

    if (!name || !category || !matchText) {
      setError('Name, category, and match text are required.')
      return
    }

    setError(null)
    setMessage(null)

    try {
      await createCategoryRule({
        name,
        category,
        subcategory: ruleForm.subcategory.trim() || null,
        match_text: matchText,
        match_field: ruleForm.match_field,
        direction: ruleForm.direction || null,
        source: ruleForm.source.trim() || null,
        is_active: ruleForm.is_active,
      })

      setRuleForm(INITIAL_RULE_FORM)
      setMessage('Rule created.')
      loadData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create rule')
    }
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

      <h2>New Rule</h2>
      <form className="filter-panel" onSubmit={handleCreateManualRule}>
        <div className="form-grid">
          <label>
            Name
            <input
              value={ruleForm.name}
              onChange={(event) => updateRuleForm('name', event.target.value)}
              placeholder="Auchan groceries"
            />
          </label>

          <CategorySelect
            label="Category"
            value={ruleForm.category}
            onChange={(category) => updateRuleForm('category', category)}
          />

          <label>
            Subcategory
            <input
              value={ruleForm.subcategory}
              onChange={(event) => updateRuleForm('subcategory', event.target.value)}
              placeholder="Optional"
            />
          </label>

          <label>
            Match text
            <input
              value={ruleForm.match_text}
              onChange={(event) => updateRuleForm('match_text', event.target.value)}
              placeholder="AUCHAN"
            />
          </label>

          <label>
            Match field
            <select
              value={ruleForm.match_field}
              onChange={(event) => updateRuleForm('match_field', event.target.value as MatchField)}
            >
              <option value="description">description</option>
              <option value="raw_description">raw_description</option>
              <option value="merchant">merchant</option>
            </select>
          </label>

          <label>
            Direction
            <select
              value={ruleForm.direction}
              onChange={(event) => updateRuleForm('direction', event.target.value as Direction | '')}
            >
              <option value="">Any</option>
              <option value="in">in</option>
              <option value="out">out</option>
            </select>
          </label>

          <label>
            Source
            <select
              value={ruleForm.source}
              onChange={(event) => updateRuleForm('source', event.target.value)}
            >
              {SOURCE_OPTIONS.map((source) => (
                <option key={source || 'any'} value={source}>
                  {source || 'Any'}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={ruleForm.is_active}
              onChange={(event) => updateRuleForm('is_active', event.target.checked)}
            />
            Active
          </label>
        </div>

        <div className="toolbar">
          <button type="submit">Create rule</button>
          <button
            type="button"
            onClick={() => {
              setRuleForm(INITIAL_RULE_FORM)
              setError(null)
              setMessage(null)
            }}
          >
            Clear
          </button>
        </div>
      </form>

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
