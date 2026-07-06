import type { OwedItem } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'

const UNALLOCATED_CATEGORY_OPTIONS = [
  { value: '', label: 'Unclassified' },
  { value: 'Gift', label: 'Gift' },
  { value: 'Allowance', label: 'Allowance' },
  { value: 'Income', label: 'Income' },
  { value: 'Other', label: 'Other' },
]

type TransactionCreateRepaymentSectionProps = {
  isEnabled: boolean
  person: string
  personOptions: string[]
  items: OwedItem[]
  allocations: Record<number, string>
  transactionAmount: string
  unallocatedCategory: string
  currency?: string
  onToggle: (isEnabled: boolean) => void
  onPersonChange: (person: string) => void
  onAllocationChange: (owedItemId: number, amount: string) => void
  onUnallocatedCategoryChange: (category: string) => void
}

function parseMoneyInput(value: string) {
  return Math.abs(Number(value.replace(',', '.')))
}

function getAllocationTotal(allocations: Record<number, string>) {
  return Object.values(allocations).reduce((total, value) => {
    const amount = parseMoneyInput(value)

    if (!amount || Number.isNaN(amount)) {
      return total
    }

    return total + amount
  }, 0)
}

export function TransactionCreateRepaymentSection({
  isEnabled,
  person,
  personOptions,
  items,
  allocations,
  transactionAmount,
  unallocatedCategory,
  currency = 'EUR',
  onToggle,
  onPersonChange,
  onAllocationChange,
  onUnallocatedCategoryChange,
}: TransactionCreateRepaymentSectionProps) {
  const paymentAmount = parseMoneyInput(transactionAmount)
  const allocatedAmount = getAllocationTotal(allocations)
  const leftoverAmount = Math.max(paymentAmount - allocatedAmount, 0)
  const normalisedPerson = person.trim().toLowerCase()
  const filteredPersonOptions = personOptions
    .filter((personOption) =>
      normalisedPerson
        ? personOption.toLowerCase().includes(normalisedPerson)
        : true,
    )
    .filter((personOption) => personOption !== person)
    .slice(0, 6)

  return (
    <section className="transaction-repayment-panel">
      <label className="transaction-repayment-toggle">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span>
          <strong>Pays owed expenses</strong>
          <small>Match this incoming payment to specific expenses.</small>
        </span>
      </label>

      {isEnabled && (
        <div className="transaction-repayment-body">
          <div className="transaction-repayment-totals">
            <div>
              <span>Allocated</span>
              <strong>{formatMoney(allocatedAmount.toFixed(2), currency)}</strong>
            </div>
            <div>
              <span>Leftover</span>
              <strong>{formatMoney(leftoverAmount.toFixed(2), currency)}</strong>
            </div>
          </div>

          <div className="transaction-repayment-field">
            <label htmlFor="repayment-person">Paid by</label>
            <input
              id="repayment-person"
              value={person}
              onChange={(event) => onPersonChange(event.target.value)}
              placeholder="Search person"
            />
          </div>

          {filteredPersonOptions.length > 0 && (
            <div className="transaction-repayment-person-options">
              {filteredPersonOptions.map((personOption) => (
                <button
                  key={personOption}
                  type="button"
                  onClick={() => onPersonChange(personOption)}
                >
                  {personOption}
                </button>
              ))}
            </div>
          )}

          {person && items.length === 0 && (
            <p className="muted small">
              No active owed expenses found for this person.
            </p>
          )}

          {items.length > 0 && (
            <div className="transaction-repayment-expenses">
              <p className="transaction-repayment-section-label">Expenses being repaid</p>

              {items.map((item) => (
                <div key={item.id} className="transaction-repayment-expense-row">
                  <div className="transaction-repayment-expense-copy">
                    <strong>{item.reason}</strong>
                    <span>
                      Remaining {formatMoney(item.amount_remaining)}
                      {item.due_date ? ` · due ${formatDate(item.due_date)}` : ''}
                    </span>
                  </div>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={item.amount_remaining}
                    value={allocations[item.id] ?? ''}
                    onChange={(event) => onAllocationChange(item.id, event.target.value)}
                    placeholder="0.00"
                    aria-label={`Amount paid for ${item.reason}`}
                  />
                </div>
              ))}
            </div>
          )}

          {leftoverAmount > 0 && (
            <div className="transaction-repayment-leftover">
              <p className="transaction-repayment-section-label">Leftover</p>

              <div className="transaction-repayment-category-options">
                {UNALLOCATED_CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.value || 'empty'}
                    type="button"
                    className={option.value === unallocatedCategory ? 'active' : undefined}
                    onClick={() => onUnallocatedCategoryChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
