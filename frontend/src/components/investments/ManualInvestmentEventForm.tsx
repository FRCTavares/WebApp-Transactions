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
  onChange: (form: ManualInvestmentEventFormState) => void
}

export function ManualInvestmentEventForm({
  form,
  onChange,
}: ManualInvestmentEventFormProps) {
  return (
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
  )
}
