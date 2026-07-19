import { useState, type MouseEvent } from 'react'
import type { InvestmentMonthlySeriesPoint } from '../../types/api'
import { formatMoney, formatMonthLabel } from '../../utils/format'

type InvestmentPortfolioTrendChartProps = {
  months: number
  series: InvestmentMonthlySeriesPoint[]
  isLoading?: boolean
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
  allocated: number | null
  marketValue: number | null
  gain: number | null
  isEstimated: boolean
}

type TrendCoordinate = {
  month: string
  value: number
  x: number
  y: number
}

const chartWidth = 900
const chartHeight = 190
const paddingTop = 22
const paddingRight = 28
const paddingBottom = 34
const paddingLeft = 28

const tooltipWidth = 190
const tooltipHeight = 72
const tooltipOffset = 12

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
  return formatMonthLabel(month)
}

function buildPoints(series: InvestmentMonthlySeriesPoint[]): ChartPoint[] {
  return series
    .map((point) => ({
      month: point.month,
      allocated: toNullableNumber(point.allocated_eur),
      marketValue: toNullableNumber(point.market_value_eur),
      gain: toNullableNumber(point.gain_eur),
      isEstimated: point.is_estimated,
    }))
    .filter(
      (point) =>
        (point.allocated !== null && point.allocated > 0)
        || point.marketValue !== null,
    )
}

function getPointX(index: number, pointCount: number) {
  const usableWidth = chartWidth - paddingLeft - paddingRight

  return paddingLeft + (index / Math.max(pointCount - 1, 1)) * usableWidth
}

function getCoordinates(
  points: ChartPoint[],
  minValue: number,
  maxValue: number,
  getValue: (point: ChartPoint) => number | null,
): TrendCoordinate[] {
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
        x: getPointX(index, points.length),
        y: paddingTop + ((maxValue - value) / valueRange) * usableHeight,
      }
    })
    .filter((point) => point !== null)
}

function buildPath(coordinates: TrendCoordinate[]) {
  return coordinates
    .map((point, index) => {
      return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    })
    .join(' ')
}

function getNearestPointFromMouse(event: MouseEvent<SVGSVGElement>, points: ChartPoint[]) {
  const svgBounds = event.currentTarget.getBoundingClientRect()
  const mouseX = ((event.clientX - svgBounds.left) / svgBounds.width) * chartWidth

  return points.reduce((nearestPoint, point, index) => {
    const nearestIndex = points.indexOf(nearestPoint)
    const nearestDistance = Math.abs(getPointX(nearestIndex, points.length) - mouseX)
    const pointDistance = Math.abs(getPointX(index, points.length) - mouseX)

    return pointDistance < nearestDistance ? point : nearestPoint
  }, points[0])
}

function getTooltipX(x: number) {
  if (x + tooltipWidth + tooltipOffset > chartWidth) {
    return x - tooltipWidth - tooltipOffset
  }

  return x + tooltipOffset
}

function getTooltipY(y: number) {
  const preferredY = y - tooltipHeight - tooltipOffset
  const maxY = chartHeight - paddingBottom - tooltipHeight - 8

  return Math.max(8, Math.min(preferredY, maxY))
}

function ChartWindowSelector({
  months,
  onMonthsChange,
}: {
  months: number
  onMonthsChange: (months: number) => void
}) {
  return (
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
  )
}

function InvestmentPortfolioTrendPlaceholder({
  isLoading,
  months,
  onMonthsChange,
}: {
  isLoading: boolean
  months: number
  onMonthsChange: (months: number) => void
}) {
  return (
    <section className="content-card panel-card investment-trend-card investment-trend-card-state">
      <div className="investment-trend-header">
        <div>
          <h2>Portfolio trend</h2>
          <p className="muted small">
            Full available series from Trading 212 events and valuation prices.
          </p>
        </div>

        <ChartWindowSelector months={months} onMonthsChange={onMonthsChange} />
      </div>

      <div className={isLoading ? 'investment-trend-skeleton' : 'investment-trend-empty'}>
        {isLoading ? (
          <>
            <div className="investment-trend-skeleton-header">
              <span />
              <strong />
            </div>
            <div className="investment-trend-skeleton-chart" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
            <p>Loading portfolio trend…</p>
          </>
        ) : (
          <>
            <strong>No portfolio trend yet</strong>
            <p>
              Add investment events and valuation prices to show the portfolio trend.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

export function InvestmentPortfolioTrendChart({
  months,
  series,
  isLoading = false,
  onMonthsChange,
}: InvestmentPortfolioTrendChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null)
  const points = buildPoints(series)

  if (points.length === 0) {
    return (
      <InvestmentPortfolioTrendPlaceholder
        isLoading={isLoading}
        months={months}
        onMonthsChange={onMonthsChange}
      />
    )
  }

  const allValues = points.flatMap((point) =>
    [point.allocated, point.marketValue].filter(
      (value): value is number => value !== null,
    ),
  )
  const minValue = Math.min(...allValues) * 0.96
  const maxValue = Math.max(...allValues) * 1.04
  const allocatedCoordinates = getCoordinates(points, minValue, maxValue, (point) => point.allocated)
  const marketValueCoordinates = getCoordinates(points, minValue, maxValue, (point) => point.marketValue)
  const allocatedPath = buildPath(allocatedCoordinates)
  const marketValuePath = buildPath(marketValueCoordinates)
  const latestPoint = [...points].reverse().find((point) => point.marketValue !== null) ?? points[points.length - 1]
  const latestMarketValue = latestPoint.marketValue
  const latestGain = latestPoint.gain
  const activePoint = hoveredPoint ?? latestPoint
  const activeIndex = points.findIndex((point) => point.month === activePoint.month)
  const activeX = getPointX(activeIndex, points.length)
  const activeAllocatedCoordinate = allocatedCoordinates.find((coordinate) => coordinate.month === activePoint.month)
  const activeMarketValueCoordinate = marketValueCoordinates.find((coordinate) => coordinate.month === activePoint.month)
  const activeY = activeMarketValueCoordinate?.y ?? activeAllocatedCoordinate?.y ?? paddingTop
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
          <span>{isLoading ? 'Updating trend…' : 'Latest portfolio value'}</span>
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
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label={`Investment portfolio trend. ${formatMonth(activePoint.month)}: portfolio ${
            activePoint.marketValue === null
              ? 'unavailable'
              : formatMoney(activePoint.marketValue.toFixed(2))
          }, allocated ${
            activePoint.allocated === null
              ? 'unavailable'
              : formatMoney(activePoint.allocated.toFixed(2))
          }${activePoint.isEstimated ? ', estimated' : ''}. Use Left and Right arrows to explore.`}
          tabIndex={0}
          onFocus={() => setHoveredPoint(latestPoint)}
          onBlur={() => setHoveredPoint(null)}
          onKeyDown={(event) => {
            let nextIndex: number

            if (event.key === 'ArrowLeft') {
              nextIndex = Math.max(activeIndex - 1, 0)
            } else if (event.key === 'ArrowRight') {
              nextIndex = Math.min(activeIndex + 1, points.length - 1)
            } else if (event.key === 'Home') {
              nextIndex = 0
            } else if (event.key === 'End') {
              nextIndex = points.length - 1
            } else {
              return
            }

            event.preventDefault()
            setHoveredPoint(points[nextIndex])
          }}
          onMouseMove={(event) => setHoveredPoint(getNearestPointFromMouse(event, points))}
          onMouseLeave={() => setHoveredPoint(null)}
        >
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
              r="4.5"
              className="investment-trend-current-point"
            />
          )}

          {hoveredPoint && (
            <>
              <line
                x1={activeX}
                y1={paddingTop}
                x2={activeX}
                y2={chartHeight - paddingBottom}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="4 5"
                opacity="0.72"
              />
              {activeAllocatedCoordinate && (
                <circle
                  cx={activeAllocatedCoordinate.x}
                  cy={activeAllocatedCoordinate.y}
                  r="4"
                  fill="#ffffff"
                  stroke="#94a3b8"
                  strokeWidth="2"
                />
              )}
              {activeMarketValueCoordinate && (
                <circle
                  cx={activeMarketValueCoordinate.x}
                  cy={activeMarketValueCoordinate.y}
                  r="4.8"
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth="2.3"
                />
              )}
              <g
                transform={`translate(${getTooltipX(activeX)}, ${getTooltipY(activeY)})`}
                pointerEvents="none"
              >
                <rect
                  width={tooltipWidth}
                  height={tooltipHeight}
                  rx="10"
                  fill="#ffffff"
                  stroke="#dbe3ef"
                />
                <text x="12" y="20" fill="#64748b" fontSize="11" fontWeight="800">
                  {formatMonth(activePoint.month)}
                  {activePoint.isEstimated ? ' · estimated' : ''}
                </text>
                <text x="12" y="41" fill="#111827" fontSize="13" fontWeight="850">
                  Portfolio: {activePoint.marketValue === null ? '-' : formatMoney(activePoint.marketValue.toFixed(2))}
                </text>
                <text x="12" y="59" fill="#64748b" fontSize="12" fontWeight="750">
                  Allocated: {activePoint.allocated === null
                    ? '-'
                    : formatMoney(activePoint.allocated.toFixed(2))}
                </text>
              </g>
            </>
          )}

          {labelPoints.map((point) => (
            <text
              key={point.month}
              x={getPointX(points.indexOf(point), points.length)}
              y={chartHeight - 8}
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

        <ChartWindowSelector months={months} onMonthsChange={onMonthsChange} />
      </div>
    </section>
  )
}
