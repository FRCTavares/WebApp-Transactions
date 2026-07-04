import type { InvestmentMonthlySeriesPoint } from '../../types/api'
import { formatMoney } from '../../utils/format'

type InvestmentPortfolioTrendChartProps = {
  months: number
  series: InvestmentMonthlySeriesPoint[]
  onMonthsChange: (months: number) => void
}

const chartWindowOptions = [
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
  { label: '24M', value: 24 },
  { label: '5Y', value: 60 },
]

type ChartPoint = {
  month: string
  allocated: number
  marketValue: number | null
  gain: number | null
}

const chartWidth = 900
const chartHeight = 180
const paddingTop = 20
const paddingRight = 24
const paddingBottom = 32
const paddingLeft = 24

function toNumber(value: string | null | undefined) {
  const number = Number(value ?? 0)

  return Number.isNaN(number) ? 0 : number
}

function toNullableNumber(value: string | null) {
  if (value === null) {
    return null
  }

  return toNumber(value)
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1, 1)

  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })
}

function buildPoints(series: InvestmentMonthlySeriesPoint[]): ChartPoint[] {
  return series
    .map((point) => ({
      month: point.month,
      allocated: toNumber(point.allocated_eur),
      marketValue: toNullableNumber(point.market_value_eur),
      gain: toNullableNumber(point.gain_eur),
    }))
    .filter((point) => point.allocated > 0 || point.marketValue !== null)
}

function getCoordinates(
  points: ChartPoint[],
  minValue: number,
  maxValue: number,
  getValue: (point: ChartPoint) => number | null,
) {
  const usableWidth = chartWidth - paddingLeft - paddingRight
  const usableHeight = chartHeight - paddingTop - paddingBottom
  const valueRange = Math.max(maxValue - minValue, 1)

  return points
    .map((point, index) => {
      const value = getValue(point)

      if (value === null) {
        return null
      }

      return {
        month: point.month,
        value,
        x: paddingLeft + (index / Math.max(points.length - 1, 1)) * usableWidth,
        y: paddingTop + ((maxValue - value) / valueRange) * usableHeight,
      }
    })
    .filter((point) => point !== null)
}

function buildPath(coordinates: ReturnType<typeof getCoordinates>) {
  return coordinates
    .map((point, index) => {
      return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    })
    .join(' ')
}

export function InvestmentPortfolioTrendChart({ months, series, onMonthsChange }: InvestmentPortfolioTrendChartProps) {
  const points = buildPoints(series)

  if (points.length === 0) {
    return null
  }

  const allValues = points.flatMap((point) => [
    point.allocated,
    point.marketValue ?? point.allocated,
  ])
  const minValue = Math.min(...allValues) * 0.96
  const maxValue = Math.max(...allValues) * 1.04
  const allocatedCoordinates = getCoordinates(points, minValue, maxValue, (point) => point.allocated)
  const marketValueCoordinates = getCoordinates(points, minValue, maxValue, (point) => point.marketValue)
  const allocatedPath = buildPath(allocatedCoordinates)
  const marketValuePath = buildPath(marketValueCoordinates)
  const latestPoint = [...points].reverse().find((point) => point.marketValue !== null) ?? points[points.length - 1]
  const latestMarketValue = latestPoint.marketValue
  const latestGain = latestPoint.gain
  const labelPoints = [
    points[0],
    points[Math.floor(points.length / 2)],
    points[points.length - 1],
  ].filter((point, index, array) => {
    return array.findIndex((item) => item.month === point.month) === index
  })

  return (
    <section className="content-card panel-card investment-trend-card">
      <div className="investment-trend-header">
        <div>
          <h2>Portfolio trend</h2>
          <p className="muted small">
            Full available series from Trading 212 events and valuation prices.
          </p>
        </div>

        <div className="investment-trend-current">
          <span>Latest portfolio value</span>
          <strong>
            {latestMarketValue === null ? '-' : formatMoney(latestMarketValue.toFixed(2))}
          </strong>
          <small className={latestGain !== null && latestGain < 0 ? 'negative' : 'positive'}>
            {latestGain === null
              ? 'No value yet'
              : `${latestGain >= 0 ? '+' : ''}${formatMoney(latestGain.toFixed(2))} gain`}
          </small>
        </div>
      </div>

      <div className="investment-trend-visual">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Investment portfolio trend">
          <line
            x1={paddingLeft}
            y1={chartHeight - paddingBottom}
            x2={chartWidth - paddingRight}
            y2={chartHeight - paddingBottom}
            className="investment-trend-baseline"
          />

          <path d={allocatedPath} className="investment-trend-allocated-line" />
          <path d={marketValuePath} className="investment-trend-value-line" />

          {marketValueCoordinates.length > 0 && (
            <circle
              cx={marketValueCoordinates[marketValueCoordinates.length - 1].x}
              cy={marketValueCoordinates[marketValueCoordinates.length - 1].y}
              r="5"
              className="investment-trend-current-point"
            />
          )}

          {labelPoints.map((point) => (
            <text
              key={point.month}
              x={paddingLeft + (points.indexOf(point) / Math.max(points.length - 1, 1)) * (chartWidth - paddingLeft - paddingRight)}
              y={chartHeight - 10}
              textAnchor={point.month === points[0].month ? 'start' : point.month === points[points.length - 1].month ? 'end' : 'middle'}
              className="investment-trend-label"
            >
              {formatMonth(point.month)}
            </text>
          ))}
        </svg>
      </div>

      <div className="investment-trend-footer">
        <div className="investment-trend-legend">
          <span>
            <i className="investment-trend-legend-value" />
            Portfolio value
          </span>
          <span>
            <i className="investment-trend-legend-allocated" />
            Allocated capital
          </span>
        </div>

        <div className="investment-trend-window-selector" aria-label="Portfolio trend time window">
          {chartWindowOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === months ? 'active' : undefined}
              onClick={() => onMonthsChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
