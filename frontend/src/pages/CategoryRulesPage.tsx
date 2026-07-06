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
  applyCashflowRules,
  createCashflowRule,
  listCashflowRules,
} from '../api/cashflowRules'
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
import { StatusMessage } from '../components/StatusMessage'
import { CashflowRuleForm, type CashflowRuleFormState } from '../components/rules/CashflowRuleForm'
import { CashflowRulesTable } from '../components/rules/CashflowRulesTable'
import { CategorySuggestionsTable } from '../components/rules/CategorySuggestionsTable'
import { CategoryRulesTable } from '../components/rules/CategoryRulesTable'
import { DescriptionSuggestionsTable } from '../components/rules/DescriptionSuggestionsTable'
import { DescriptionRulesTable } from '../components/rules/DescriptionRulesTable'
import { RulesPageHeader } from '../components/rules/RulesPageHeader'
import type {
  CashflowRule,
  CategoryRule,
  CategoryRuleSuggestion,
  DescriptionRule,
  DescriptionRuleSuggestion,
} from '../types/api'

const INITIAL_RULE_FORM: RuleFormState = {
  name: '',
  category: '',
  match_text: '',
  match_field: 'description',
  direction: '',
  source: '',
  is_active: true,
}

const INITIAL_CASHFLOW_RULE_FORM: CashflowRuleFormState = {
  name: '',
  cashflow_type: 'transfer',
  match_text: '',
  match_field: 'raw_description',
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
  const [cashflowRules, setCashflowRules] = useState<CashflowRule[]>([])
  const [suggestions, setSuggestions] = useState<CategoryRuleSuggestion[]>([])
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<DescriptionRuleSuggestion[]>([])
  const [suggestionCategories, setSuggestionCategories] = useState<Record<string, string>>({})
  const [suggestionDescriptions, setSuggestionDescriptions] = useState<Record<string, string>>({})
  const [ruleForm, setRuleForm] = useState<RuleFormState>(INITIAL_RULE_FORM)
  const [cashflowRuleForm, setCashflowRuleForm] = useState<CashflowRuleFormState>(INITIAL_CASHFLOW_RULE_FORM)
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
      listCashflowRules(),
    ])
      .then(([rulesData, suggestionData, descriptionRulesData, descriptionSuggestionData, cashflowRulesData]) => {
        setRules(rulesData)
        setSuggestions(suggestionData)
        setDescriptionRules(descriptionRulesData)
        setDescriptionSuggestions(descriptionSuggestionData)
        setCashflowRules(cashflowRulesData)
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

  function updateCashflowRuleForm(
    field: keyof CashflowRuleFormState,
    value: string | boolean,
  ) {
    setCashflowRuleForm((currentForm) => ({
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

  async function handleCreateCashflowRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = cashflowRuleForm.name.trim()
    const matchText = cashflowRuleForm.match_text.trim()

    if (!name || !matchText) {
      setError('Name and match text are required for cashflow rules.')
      return
    }

    setError(null)
    setMessage(null)

    try {
      await createCashflowRule({
        name,
        cashflow_type: cashflowRuleForm.cashflow_type,
        match_text: matchText,
        match_field: cashflowRuleForm.match_field,
        direction: cashflowRuleForm.direction || null,
        source: cashflowRuleForm.source.trim() || null,
        is_active: cashflowRuleForm.is_active,
      })

      setCashflowRuleForm(INITIAL_CASHFLOW_RULE_FORM)
      setMessage('Cashflow rule created.')
      loadData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create cashflow rule')
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

  async function handleApplyCashflowRules() {
    setError(null)
    setMessage(null)

    try {
      await applyCashflowRules()
      setMessage('Cashflow rules applied.')
      loadData()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to apply cashflow rules')
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
    <section className="rules-page">
      <RulesPageHeader
        onApplyCategoryRules={handleApplyRules}
        onApplyDescriptionRules={handleApplyDescriptionRules}
        onApplyCashflowRules={handleApplyCashflowRules}
      />

      <StatusMessage error={error} message={message} />

      <section className="panel-card">
        <div className="section-header">
          <div>
            <h2>Description Suggestions</h2>
          </div>
        </div>

        <DescriptionSuggestionsTable
          suggestions={descriptionSuggestions}
          descriptionsByKey={suggestionDescriptions}
          getSuggestionKey={getDescriptionSuggestionKey}
          onDescriptionChange={updateSuggestionDescription}
          onAddRule={addDescriptionRuleFromSuggestion}
        />
      </section>

      <section className="panel-card">
        <div className="section-header">
          <div>
            <h2>Description Rules</h2>
            <p className="muted small">
              Existing rules that normalise raw descriptions.
            </p>
          </div>
        </div>

        <DescriptionRulesTable rules={descriptionRules} />
      </section>

      <section className="panel-card">
        <div className="section-header">
          <div>
            <h2>New Cashflow Rule</h2>
            <p className="muted small">
              Mark matching transactions as income, expense, or transfer.
            </p>
          </div>
        </div>

        <CashflowRuleForm
          form={cashflowRuleForm}
          onSubmit={handleCreateCashflowRule}
          onChange={updateCashflowRuleForm}
          onClear={() => {
            setCashflowRuleForm(INITIAL_CASHFLOW_RULE_FORM)
            setError(null)
            setMessage(null)
          }}
        />
      </section>

      <section className="panel-card">
        <div className="section-header">
          <div>
            <h2>Cashflow Rules</h2>
            <p className="muted small">
              Existing rules that control whether transactions count as normal cashflow.
            </p>
          </div>
        </div>

        <CashflowRulesTable rules={cashflowRules} />
      </section>

      <section className="panel-card">
        <div className="section-header">
          <div>
            <h2>New Category Rule</h2>
            <p className="muted small">
              Create a manual category rule from a known match text.
            </p>
          </div>
        </div>

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
      </section>

      {editingRule && (
        <section className="panel-card">
          <div className="section-header">
            <div>
              <h2>Edit Category Rule</h2>
              <p className="muted small">
                Update the selected category rule.
              </p>
            </div>
          </div>

          <CategoryRuleForm
            form={editRuleForm}
            submitLabel="Save changes"
            editingRuleId={editingRule.id}
            onSubmit={handleSaveEditRule}
            onChange={updateEditRuleForm}
            onCancel={handleCancelEditRule}
          />
        </section>
      )}

      <section className="panel-card">
        <div className="section-header">
          <div>
            <h2>Category Suggestions</h2>
            <p className="muted small">
              Create category rules from repeated uncategorised descriptions.
            </p>
          </div>
        </div>

        <CategorySuggestionsTable
          suggestions={suggestions}
          categoriesByKey={suggestionCategories}
          getSuggestionKey={getSuggestionKey}
          onCategoryChange={updateSuggestionCategory}
          onAddRule={addRuleFromSuggestion}
        />
      </section>

      <section className="panel-card">
        <div className="section-header">
          <div>
            <h2>Category Rules</h2>
            <p className="muted small">
              Existing rules that assign categories.
            </p>
          </div>
        </div>

        <CategoryRulesTable
          rules={rules}
          onEdit={handleStartEditRule}
          onToggle={handleToggleRule}
          onDelete={handleDeleteRule}
        />
      </section>
    </section>
  )
}
