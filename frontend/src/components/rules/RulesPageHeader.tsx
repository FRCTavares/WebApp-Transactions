type RulesPageHeaderProps = {
  onApplyCategoryRules: () => void
  onApplyDescriptionRules: () => void
  onApplyCashflowRules: () => void
}

export function RulesPageHeader({
  onApplyCategoryRules,
  onApplyDescriptionRules,
  onApplyCashflowRules,
}: RulesPageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>Categories / Rules</h1>
        <p className="muted small">
          Clean descriptions, categorise transactions, and mark transfers or investments.
        </p>
      </div>

      <div className="action-group">
        <button type="button" onClick={onApplyCategoryRules}>
          Apply category rules
        </button>
        <button type="button" onClick={onApplyDescriptionRules}>
          Apply description rules
        </button>
        <button type="button" onClick={onApplyCashflowRules}>
          Apply cashflow rules
        </button>
      </div>
    </div>
  )
}
