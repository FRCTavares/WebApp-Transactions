import { Button } from '../ui'

export type ManualInvestmentEventFormState = {
  date: string
  eventType: 'market_buy' | 'market_sell'
  instrumentName: string
  ticker: string
  quantity: string
  amount: string
  currency: string
  account: string
}

type ManualInvestmentEventFormProps = {
  form: ManualInvestmentEventFormState
  isSubmitting: boolean
  onChange: (form: ManualInvestmentEventFormState) => void
  onSubmit: () => void
}

export function ManualInvestmentEventForm({
  form,
  isSubmitting,
  onChange,
  onSubmit,
}: ManualInvestmentEventFormProps) {
  return (
    <section className="panel-card">
      <div className="section-header">
        <div>
          <h2>Add manual position</h2>
          <p className="muted small">
            For assets with no importer (e.g. Bitcoin held outside Trading
            212). Creates a real buy/sell event, so it counts toward
            holdings, valuation, and the monthly investment goal like any
            imported trade.
          </p>
        </div>
      </div>

      <div className="form-row">
        <label>
          Type
          <select
            value={form.eventType}
            onChange={(event) => onChange({
              ...form,
              eventType: event.target.value as ManualInvestmentEventFormState['eventType'],
            })}
          >
            <option value="market_buy">Buy</option>
            <option value="market_sell">Sell</option>
          </select>
        </label>

        <label>
          Date
          <input
            type="date"
            value={form.date}
            onChange={(event) => onChange({ ...form, date: event.target.value })}
          />
        </label>

        <label>
          Instrument name
          <input
            value={form.instrumentName}
            placeholder="Bitcoin"
            onChange={(event) => onChange({
              ...form,
              instrumentName: event.target.value,
            })}
          />
        </label>

        <label>
          Ticker
          <input
            value={form.ticker}
            placeholder="BTC"
            onChange={(event) => onChange({ ...form, ticker: event.target.value })}
          />
        </label>

        <label>
          Quantity
          <input
            type="number"
            min="0"
            step="0.00000001"
            value={form.quantity}
            onChange={(event) => onChange({ ...form, quantity: event.target.value })}
          />
        </label>

        <label>
          Amount paid/received
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => onChange({ ...form, amount: event.target.value })}
          />
        </label>

        <label>
          Currency
          <input
            value={form.currency}
            onChange={(event) => onChange({
              ...form,
              currency: event.target.value.toUpperCase(),
            })}
          />
        </label>

        <label>
          Account
          <input
            value={form.account}
            placeholder="Manual"
            onChange={(event) => onChange({ ...form, account: event.target.value })}
          />
        </label>
      </div>

      <div className="action-group">
        <Button
          type="button"
          variant="primary"
          loading={isSubmitting}
          onClick={onSubmit}
        >
          Save position
        </Button>
      </div>
    </section>
  )
}
