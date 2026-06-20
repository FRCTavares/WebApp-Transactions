import type { ReactNode } from 'react'
import { formatMoney } from '../../utils/format'

export type ExpenseCategoryChartItem = {
  category: string
  count: number
  personalTotal: number
}

type ChartSlice = ExpenseCategoryChartItem & {
  id: string
  percentage: number
  dashArray: string
  dashOffset: number
  isOther: boolean
}

type ExpenseCategoryDonutChartProps = {
  items: ExpenseCategoryChartItem[]
  title: string
  description: string
  emptyMessage: string
  actions?: ReactNode
  onSelectCategory?: (category: string) => void
}

const MAX_VISIBLE_SLICES = 5
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

function buildChartSlices(items: ExpenseCategoryChartItem[]) {
  const positiveItems = items
    .filter((item) => item.personalTotal > 0)
    .sort((firstItem, secondItem) => secondItem.personalTotal - firstItem.personalTotal)

  const total = positiveItems.reduce(
    (currentTotal, item) => currentTotal + item.personalTotal,
    0,
  )

  if (total <= 0) {
    return []
  }

  const visibleItems = positiveItems.slice(0, MAX_VISIBLE_SLICES)
  const otherItems = positiveItems.slice(MAX_VISIBLE_SLICES)

  const chartItems = [...visibleItems]

  if (otherItems.length > 0) {
    chartItems.push({
      category: 'Other',
      count: otherItems.reduce((currentTotal, item) => currentTotal + item.count, 0),
      personalTotal: otherItems.reduce(
        (currentTotal, item) => currentTotal + item.personalTotal,
        0,
      ),
    })
  }

  let runningOffset = 0

  return chartItems.map((item, index): ChartSlice => {
    const percentage = item.personalTotal / total
    const sliceLength = percentage * CIRCUMFERENCE
    const dashArray = `${sliceLength} ${CIRCUMFERENCE - sliceLength}`
    const dashOffset = -runningOffset

    runningOffset += sliceLength

    return {
      ...item,
      id: `${item.category}-${index}`,
      percentage,
      dashArray,
      dashOffset,
      isOther: item.category === 'Other',
    }
  })
}

export function ExpenseCategoryDonutChart({
  items,
  title,
  description,
  emptyMessage,
  actions,
  onSelectCategory,
}: ExpenseCategoryDonutChartProps) {
  const slices = buildChartSlices(items)
  const total = slices.reduce(
    (currentTotal, item) => currentTotal + item.personalTotal,
    0,
  )

  if (slices.length === 0) {
    return (
      <section className="expense-chart-card">
        <div>
          <h3>{title}</h3>
          <p className="muted small">{emptyMessage}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="expense-chart-card">
      <div className="expense-chart-visual">
        <svg viewBox="0 0 120 120" role="img" aria-label="Expense category split">
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
              onClick={() => {
                if (!slice.isOther && onSelectCategory) {
                  onSelectCategory(slice.category)
                }
              }}
            />
          ))}
        </svg>

        <div className="expense-chart-centre">
          <span>Total</span>
          <strong>{formatMoney(total.toFixed(2))}</strong>
        </div>
      </div>

      <div className="expense-chart-list">
        <div className="expense-chart-list-header">
          <div>
            <h3>{title}</h3>
            <p className="muted small">{description}</p>
          </div>
          {actions ? <div className="expense-chart-actions">{actions}</div> : null}
        </div>

        <div className="expense-chart-legend">
          {slices.map((slice, index) => {
            const percentageLabel = `${Math.round(slice.percentage * 100)}%`

            return (
              <button
                key={slice.id}
                type="button"
                className="expense-chart-legend-row"
                disabled={slice.isOther || !onSelectCategory}
                onClick={() => {
                  if (!slice.isOther && onSelectCategory) {
                    onSelectCategory(slice.category)
                  }
                }}
              >
                <span
                  className="expense-chart-dot"
                  style={{ background: SLICE_COLOURS[index % SLICE_COLOURS.length] }}
                />
                <span>
                  <strong>{slice.category}</strong>
                  <small>
                    {slice.count} {slice.count === 1 ? 'transaction' : 'transactions'}
                  </small>
                </span>
                <span>
                  <strong>{formatMoney(slice.personalTotal.toFixed(2))}</strong>
                  <small>{percentageLabel}</small>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
