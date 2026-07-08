import type { OwedSplitRowState } from './TransactionOwedSplitDialog'
import { formatMoney } from '../../utils/format'

type TransactionCreateOwedSectionProps = {
  isEnabled: boolean
  rows: OwedSplitRowState[]
  transactionAmount: string
  personOptions: string[]
  currency?: string
  onToggle: (isEnabled: boolean) => void
  onAddRow: () => void
  onRemoveRow: (rowId: string) => void
  onUpdateRow: <K extends keyof OwedSplitRowState>(
    rowId: string,
    field: K,
    value: OwedSplitRowState[K],
  ) => void
}

function parseMoneyInput(value: string) {
  return Math.abs(Number(value.replace(',', '.')))
}

function getRowsTotal(rows: OwedSplitRowState[]) {
  return rows.reduce((total, row) => {
    const amount = parseMoneyInput(row.amount)

    if (!amount || Number.isNaN(amount)) {
      return total
    }

    return total + amount
  }, 0)
}

export function TransactionCreateOwedSection({
  isEnabled,
  rows,
  transactionAmount,
  personOptions,
  currency = 'EUR',
  onToggle,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
}: TransactionCreateOwedSectionProps) {
  const totalAmount = parseMoneyInput(transactionAmount)
  const splitTotal = getRowsTotal(rows)
  const remainingAmount = Math.max(totalAmount - splitTotal, 0)

  return (
    <section className="transaction-create-owed-section">
      <label className="transaction-create-owed-toggle">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span>
          <strong>Someone owes me for this</strong>
          <small>Choose an existing person or type a new name.</small>
        </span>
      </label>

      {isEnabled && (
        <div className="transaction-create-owed-body">
          <div className="transaction-create-owed-summary">
            <span>Owed: {formatMoney(splitTotal.toFixed(2), currency)}</span>
            <span>Left: {formatMoney(remainingAmount.toFixed(2), currency)}</span>
          </div>

          <div className="transaction-create-owed-rows">
            {rows.map((row) => {
              const normalisedPerson = row.person.trim().toLowerCase()
              const filteredPersonOptions = personOptions
                .filter((personOption) =>
                  normalisedPerson
                    ? personOption.toLowerCase().includes(normalisedPerson)
                    : true,
                )
                .filter((personOption) => personOption !== row.person)
                .slice(0, 6)

              return (
                <div key={row.id} className="transaction-create-owed-row-wrap">
                  <div className="transaction-create-owed-row">
                    <label>
                      Person
                      <input
                        value={row.person}
                        onChange={(event) => onUpdateRow(row.id, 'person', event.target.value)}
                        placeholder="Name"
                      />
                    </label>

                    <label>
                      Amount
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        onChange={(event) => onUpdateRow(row.id, 'amount', event.target.value)}
                        placeholder="0.00"
                      />
                    </label>

                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="transaction-create-owed-remove"
                        onClick={() => onRemoveRow(row.id)}
                        aria-label="Remove owed person"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {filteredPersonOptions.length > 0 && (
                    <div className="transaction-create-owed-person-options">
                      {filteredPersonOptions.map((personOption) => (
                        <button
                          key={personOption}
                          type="button"
                          onClick={() => onUpdateRow(row.id, 'person', personOption)}
                        >
                          {personOption}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button type="button" className="transaction-create-owed-add" onClick={onAddRow}>
            + Add person
          </button>
        </div>
      )}
    </section>
  )
}
