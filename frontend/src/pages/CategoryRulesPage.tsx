import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  applyCategoryRules,
  createCategoryRule,
  deleteCategoryRule,
  listCategoryRuleSuggestions,
  listCategoryRules,
  updateCategoryRule,
} from '../api/categoryRules'
import {
  applyDescriptionRules,
  createDescriptionRule,
  listDescriptionRuleSuggestions,
  listDescriptionRules,
} from '../api/descriptionRules'
import {
  CategoryRuleForm,
  type RuleFormState,
} from '../components/CategoryRuleForm'
import { CategorySelect } from '../components/CategorySelect'
import { StatusMessage } from '../components/StatusMessage'
import type {
  CategoryRule,
  CategoryRuleSuggestion,
  DescriptionRule,
  DescriptionRuleSuggestion,
} from '../types/api'
import { formatMoney } from '../utils/format'

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

function getSuggestionKey(suggestion: CategoryRuleSuggestion) {
  return `${suggestion.description}-${suggestion.source}-${suggestion.direction}`
}

function getDescriptionSuggestionKey(suggestion: DescriptionRuleSuggestion) {
  return `${suggestion.raw_description}-${suggestion.source}-${suggestion.direction}`
}

function getRuleFormFromRule(rule: CategoryRule): RuleFormState {
  return {
    name: rule.name,
    category: rule.category,
    subcategory: rule.subcategory ?? '',
    match_text: rule.match_text,
    match_field: rule.match_field,
    direction: rule.direction ?? '',
    source: rule.source ?? '',
    is_active: rule.is_active,
  }
}

export function CategoryRulesPage() {
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [descriptionRules, setDescriptionRules] = useState<DescriptionRule[]>([])
  const [suggestions, setSuggestions] = useState<CategoryRuleSuggestion[]>([])
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<DescriptionRuleSuggestion[]>([])
  const [suggestionCategories, setSuggestionCategories] = useState<Record<string, string>>({})
  const [suggestionDescriptions, setSuggestionDescriptions] = useState<Record<string, string>>({})
  const [ruleForm, setRuleForm] = useState<RuleFormState>(INITIAL_RULE_FORM)
  const [editRuleForm, setEditRuleForm] = useState<RuleFormState>(INITIAL_RULE_FORM)
  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadData() {
    Promise.all([
      listCategoryRules(),
      listCategoryRuleSuggestions(),
      listDescriptionRules(),
      listDescriptionRuleSuggestions('out'),
    ])
      .then(([rulesData, suggestionData, descriptionRulesData, descriptionSuggestionData]) => {
        setRules(rulesData)
        setSuggestions(suggestionData)
        setDescriptionRules(descriptionRulesData)
        setDescriptionSuggestions(descriptionSuggestionData)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load rules')
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

  function updateEditRuleForm(field: keyof RuleFormState, value: string | boolean) {
    setEditRuleForm((currentForm) => ({
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

  function updateSuggestionDescription(
    suggestion: DescriptionRuleSuggestion,
    cleanedDescription: string,
  ) {
    setSuggestionDescriptions((currentDescriptions) => ({
      ...currentDescriptions,
      [getDescriptionSuggestionKey(suggestion)]: cleanedDescription,
    }))
  }

  async function handleCreateManualRule(event: FormEvent<HTMLFormElement>) {
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

  function handleStartEditRule(rule: CategoryRule) {
    setEditingRule(rule)
    setEditRuleForm(getRuleFormFromRule(rule))
    setError(null)
    setMessage(null)
  }

  function handleCancelEditRule() {
    setEditingRule(null)
    setEditRuleForm(INITIAL_RULE_FORM)
  }

  async function handleSaveEditRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingRule) {
      return
    }

    const name = editRuleForm.name.trim()
    const category = editRuleForm.category.trim()
    const matchText = editRuleForm.match_text.trim()

    if (!name || !category || !matchText) {
      setError('Name, category, and match text are required.')
      return
    }

    setError(null)
    setMessage(null)

    try {
      await updateCategoryRule(editingRule.id, {
        name,
        category,
        subcategory: editRuleForm.subcategory.trim() || null,
        match_text: matchText,
        match_field: editRuleForm.match_field,
        direction: editRuleForm.direction || null,
        source: editRuleForm.source.trim() || null,
        is_active: editRuleForm.is_active,
      })

      handleCancelEditRule()
      setMessage('Rule updated.')
      loadData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update rule')
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

  async function addDescriptionRuleFromSuggestion(suggestion: DescriptionRuleSuggestion) {
    const suggestionKey = getDescriptionSuggestionKey(suggestion)
    const cleanedDescription = suggestionDescriptions[suggestionKey]?.trim()

    if (!cleanedDescription) {
      setError('Write a cleaned description before creating the rule.')
      return
    }

    setError(null)
    setMessage(null)

    try {
      await createDescriptionRule({
        name: cleanedDescription,
        cleaned_description: cleanedDescription,
        match_text: suggestion.raw_description,
        match_field: 'raw_description',
        direction: suggestion.direction,
        source: suggestion.source,
        is_active: true,
      })

      setSuggestionDescriptions((currentDescriptions) => {
        const nextDescriptions = { ...currentDescriptions }
        delete nextDescriptions[suggestionKey]
        return nextDescriptions
      })

      setMessage('Description rule created.')
      loadData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create description rule')
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

  async function handleApplyDescriptionRules() {
    setError(null)
    setMessage(null)

    try {
      await applyDescriptionRules()
      setMessage('Description rules applied.')
      loadData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to apply description rules')
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

      if (editingRule?.id === rule.id) {
        handleCancelEditRule()
      }

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
          Apply category rules
        </button>
        <button type="button" onClick={handleApplyDescriptionRules}>
          Apply description rules
        </button>
      </div>

      <StatusMessage error={error} message={message} />

      <h2>Description Suggestions</h2>
      {descriptionSuggestions.length === 0 ? (
        <p className="muted">No description suggestions found.</p>
      ) : (
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
              {descriptionSuggestions.map((suggestion) => {
                const suggestionKey = getDescriptionSuggestionKey(suggestion)
                const cleanedDescription = suggestionDescriptions[suggestionKey] ?? ''

                return (
                  <tr key={suggestionKey}>
                    <td>{suggestion.raw_description}</td>
                    <td>{suggestion.description}</td>
                    <td>{suggestion.source}</td>
                    <td>{suggestion.direction}</td>
                    <td>{suggestion.count}</td>
                    <td className="right">{formatMoney(suggestion.total)}</td>
                    <td>
                      <input
                        value={cleanedDescription}
                        onChange={(event) => updateSuggestionDescription(suggestion, event.target.value)}
                        placeholder={suggestion.description}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={!cleanedDescription}
                        onClick={() => addDescriptionRuleFromSuggestion(suggestion)}
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

      <h2>Description Rules</h2>
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
            {descriptionRules.map((rule) => (
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

      <h2>New Category Rule</h2>
      <CategoryRuleForm
        form={ruleForm}
        submitLabel="Create rule"
        onSubmit={handleCreateManualRule}
        onChange={updateRuleForm}
        onClear={() => {
          setRuleForm(INITIAL_RULE_FORM)
          setError(null)
          setMessage(null)
        }}
      />

      {editingRule && (
        <>
          <h2>Edit Category Rule</h2>
          <CategoryRuleForm
            form={editRuleForm}
            submitLabel="Save changes"
            editingRuleId={editingRule.id}
            onSubmit={handleSaveEditRule}
            onChange={updateEditRuleForm}
            onCancel={handleCancelEditRule}
          />
        </>
      )}

      <h2>Category Suggestions</h2>
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

      <h2>Category Rules</h2>
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
                    <button type="button" onClick={() => handleStartEditRule(rule)}>
                      Edit
                    </button>
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
