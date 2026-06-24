import type { InvestmentPosition } from '../../types/api'
import { formatMoney } from '../../utils/format'

type AllocationItem = {
  label: string
  amount: number
}

type DonutSlice = AllocationItem & {
  id: string
  percentage: number
  dashArray: string
  dashOffset: number
}

type InvestmentAllocationChartsProps = {
  positions: InvestmentPosition[]
}

const STROKE_WIDTH = 14
const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const SLICE_COLOURS = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#9333ea',
  '#dc2626',
  '#64748b',
]

function toNumber(value: string | null | undefined) {
  const number = Number(value ?? 0)

  return Number.isNaN(number) ? 0 : number
}

function getPositionLabel(position: InvestmentPosition) {
  return position.ticker ?? position.isin ?? position.instrument_name ?? 'Unknown'
}

function convertToEur(amount: number, currency: string | null | undefined, fxRate: string | null) {
  if (currency === 'EUR' || !currency) {
    return amount
  }

  const fxRateNumber = toNumber(fxRate)

  if (fxRateNumber <= 0) {
    return amount
  }

  return amount * fxRateNumber
}

function getPositionCostBasisEur(position: InvestmentPosition) {
  return position.costs.reduce((total, cost) => {
    const amount = toNumber(cost.total_cost)
    const convertedAmount = convertToEur(amount, cost.currency, position.market_fx_rate_to_eur)

    return total + convertedAmount
  }, 0)
}

function getPositionMarketValueEur(position: InvestmentPosition) {
  return convertToEur(
    toNumber(position.market_value),
    position.market_value_currency,
    position.market_fx_rate_to_eur,
  )
}

function getPositionGainLossEur(position: InvestmentPosition) {
  return convertToEur(
    toNumber(position.unrealised_gain),
    position.market_value_currency,
    position.market_fx_rate_to_eur,
  )
}

function mergeAllocationItems(items: AllocationItem[]) {
  const totals = new Map<string, number>()

  for (const item of items) {
    totals.set(item.label, (totals.get(item.label) ?? 0) + item.amount)
  }

  return [...totals.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((first, second) => second.amount - first.amount)
}

function buildDonutSlices(items: AllocationItem[]) {
  const positiveItems = mergeAllocationItems(items).filter((item) => item.amount > 0)
  const total = positiveItems.reduce((currentTotal, item) => currentTotal + item.amount, 0)

  if (total <= 0) {
    return []
  }

  let runningOffset = 0

  return positiveItems.map((item, index): DonutSlice => {
    const percentage = item.amount / total
    const sliceLength = percentage * CIRCUMFERENCE
    const dashArray = `${sliceLength} ${CIRCUMFERENCE - sliceLength}`
    const dashOffset = -runningOffset

    runningOffset += sliceLength

    return {
      ...item,
      id: `${item.label}-${index}`,
      percentage,
      dashArray,
      dashOffset,
    }
  })
}

function AllocationDonut({
  description,
  emptyMessage,
  items,
  title,
}: {
  description: string
  emptyMessage: string
  items: AllocationItem[]
  title: string
}) {
  const slices = buildDonutSlices(items)
  const total = slices.reduce((currentTotal, item) => currentTotal + item.amount, 0)

  if (slices.length === 0) {
    return (
      <section className="investment-allocation-card">
        <h3>{title}</h3>
        <p className="muted small">{emptyMessage}</p>
      </section>
    )
  }

  return (
    <section className="investment-allocation-card">
      <div className="investment-allocation-visual">
        <svg viewBox="0 0 120 120" role="img" aria-label={title}>
          <circle
            className="expense-chart-track"
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
          />

          {slices.map((slice, index) => (
            <circle
              key={slice.id}
              className="expense-chart-slice"
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={SLICE_COLOURS[index % SLICE_COLOURS.length]}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={slice.dashArray}
              strokeDashoffset={slice.dashOffset}
            />
          ))}
        </svg>

        <div className="expense-chart-centre">
          <span>EUR est.</span>
          <strong>{formatMoney(total.toFixed(2))}</strong>
        </div>
      </div>

      <div className="investment-allocation-list">
        <div>
          <h3>{title}</h3>
          <p className="muted small">{description}</p>
        </div>

        <div className="expense-chart-legend">
          {slices.map((slice, index) => (
            <div key={slice.id} className="expense-chart-legend-row">
              <span
                className="expense-chart-dot"
                style={{ background: SLICE_COLOURS[index % SLICE_COLOURS.length] }}
              />
              <span>
                <strong>{slice.label}</strong>
                <small>{Math.round(slice.percentage * 100)}% of total</small>
              </span>
              <span>
                <strong>{formatMoney(slice.amount.toFixed(2))}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GainLossRanking({ positions }: { positions: InvestmentPosition[] }) {
  const rows = mergeAllocationItems(
    positions.map((position) => ({
      label: getPositionLabel(position),
      amount: getPositionGainLossEur(position),
    })),
  ).sort((first, second) => second.amount - first.amount)

  const maxAbsGain = rows.reduce(
    (currentMax, item) => Math.max(currentMax, Math.abs(item.amount)),
    0,
  )

  return (
    <section className="investment-gain-ranking-card">
      <div>
        <h3>Gain/loss by ticker</h3>
        <p className="muted small">
          Which holdings contributed most to unrealised profit or loss.
        </p>
      </div>

      <div className="investment-gain-ranking-list">
        {rows.map((row) => {
          const percentageWidth = maxAbsGain > 0
            ? Math.max((Math.abs(row.amount) / maxAbsGain) * 100, 4)
            : 0

          return (
            <div key={row.label} className="investment-gain-ranking-row">
              <div className="investment-gain-ranking-header">
                <strong>{row.label}</strong>
                <span className={row.amount >= 0 ? 'investment-gain-positive' : 'investment-gain-negative'}>
                  {formatMoney(row.amount.toFixed(2))}
                </span>
              </div>
              <div className="investment-gain-ranking-track">
                <span
                  className={row.amount >= 0 ? 'positive' : 'negative'}
                  style={{ width: `${percentageWidth}%` }}
                />
              </div>
            </div>
          )
        })}

        {rows.length === 0 && (
          <p className="muted small">No gain/loss data available.</p>
        )}
      </div>
    </section>
  )
}

export function InvestmentAllocationCharts({ positions }: InvestmentAllocationChartsProps) {
  const marketValueItems = positions.map((position) => ({
    label: getPositionLabel(position),
    amount: getPositionMarketValueEur(position),
  }))
  const costBasisItems = positions.map((position) => ({
    label: getPositionLabel(position),
    amount: getPositionCostBasisEur(position),
  }))

  return (
    <section className="content-card panel-card investment-breakdown-card">
      <div className="section-header">
        <div>
          <h2>Portfolio breakdown</h2>
          <p className="muted small">
            Allocation by current value, invested capital, and unrealised gain/loss. Non-EUR values are estimated in EUR using the cached FX rate.
          </p>
        </div>
      </div>

      <div className="investment-breakdown-grid">
        <AllocationDonut
          title="Current value allocation"
          description="Where your portfolio value is concentrated today."
          emptyMessage="No current market value data available."
          items={marketValueItems}
        />

        <AllocationDonut
          title="Invested capital allocation"
          description="How your cost basis is split across holdings."
          emptyMessage="No cost basis data available."
          items={costBasisItems}
        />

        <GainLossRanking positions={positions} />
      </div>
    </section>
  )
}
