export type MarketPriceFormState = {
  ticker: string
  isin: string
  price: string
  currency: string
  source: string
}

type MarketPriceFormProps = {
  form: MarketPriceFormState
  isEditing: boolean
  onChange: (form: MarketPriceFormState) => void
  onSubmit: () => void
  onCancelEdit: () => void
}

export function MarketPriceForm({
  form,
  isEditing,
  onChange,
  onSubmit,
  onCancelEdit,
}: MarketPriceFormProps) {
  return (
    <section className="panel-card">
      <div className="section-header">
        <div>
          <h2>{isEditing ? 'Edit market price' : 'Manual market price'}</h2>
          <p className="muted small">
            Cached price entry. No live market fetching is used yet.
          </p>
        </div>
      </div>

      <div className="form-row">
        <label>
          Ticker
          <input
            value={form.ticker}
            placeholder="VWCE"
            onChange={(event) => onChange({
              ...form,
              ticker: event.target.value,
            })}
          />
        </label>

        <label>
          ISIN
          <input
            value={form.isin}
            placeholder="IE00BK5BQT80"
            onChange={(event) => onChange({
              ...form,
              isin: event.target.value,
            })}
          />
        </label>

        <label>
          Price
          <input
            type="number"
            min="0"
            step="0.00000001"
            value={form.price}
            onChange={(event) => onChange({
              ...form,
              price: event.target.value,
            })}
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
          Source
          <input
            value={form.source}
            onChange={(event) => onChange({
              ...form,
              source: event.target.value,
            })}
          />
        </label>
      </div>

      <div className="action-group">
        <button type="button" onClick={onSubmit}>
          {isEditing ? 'Update market price' : 'Save market price'}
        </button>

        {isEditing && (
          <button type="button" onClick={onCancelEdit}>
            Cancel edit
          </button>
        )}
      </div>
    </section>
  )
}
