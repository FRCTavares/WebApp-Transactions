import { useState, type MouseEvent } from 'react'
import type { WealthMonthlyTotal } from '../../types/api'
import { formatMoney } from '../../utils/format'

type WealthMonthlyChartProps = {
  monthlyTotals: WealthMonthlyTotal[]
}

type WealthChartPoint = {
  month: string
  value: number
  x: number
  y: number
}

const chartWindowOptions = [
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
  { label: '24M', value: 24 },
  { label: '5Y', value: 60 },
]

const isMobileChartViewport =
  typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches

const chartWidth = 900
const chartHeight = isMobileChartViewport ? 320 : 190
const paddingTop = isMobileChartViewport ? 12 : 22
const paddingRight = 28
const paddingBottom = isMobileChartViewport ? 46 : 34
const paddingLeft = 28

const tooltipWidth = 154
const tooltipHeight = 52
const tooltipOffset = 12

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-')
  const monthIndex = Number(monthNumber) - 1

  if (!year || monthIndex < 0 || monthIndex >= monthNames.length) {
    return month
  }

  return `${monthNames[monthIndex]} ${year}`
}

function getChartPoints(monthlyTotals: WealthMonthlyTotal[]): WealthChartPoint[] {
  const values = monthlyTotals.map((row) => Number(row.total_wealth_eur))
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const valueRange = Math.max(maxValue - minValue, 1)

  const usableWidth = chartWidth - paddingLeft - paddingRight
  const usableHeight = chartHeight - paddingTop - paddingBottom

  return monthlyTotals.map((row, index) => {
    const x = paddingLeft + (index / Math.max(monthlyTotals.length - 1, 1)) * usableWidth
    const y = paddingTop + ((maxValue - Number(row.total_wealth_eur)) / valueRange) * usableHeight

    return {
      month: row.month,
      value: Number(row.total_wealth_eur),
      x,
      y,
    }
  })
}

function buildLinePath(points: WealthChartPoint[]) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

function buildAreaPath(points: WealthChartPoint[]) {
  const baseline = chartHeight - paddingBottom
  const linePath = buildLinePath(points)
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  return `${linePath} L ${lastPoint.x.toFixed(2)} ${baseline} L ${firstPoint.x.toFixed(2)} ${baseline} Z`
}

function getNearestPointFromMouse(event: MouseEvent<SVGSVGElement>, points: WealthChartPoint[]) {
  const svgBounds = event.currentTarget.getBoundingClientRect()
  const mouseX = ((event.clientX - svgBounds.left) / svgBounds.width) * chartWidth

  return points.reduce((nearestPoint, point) => {
    const nearestDistance = Math.abs(nearestPoint.x - mouseX)
    const pointDistance = Math.abs(point.x - mouseX)

    return pointDistance < nearestDistance ? point : nearestPoint
  }, points[0])
}

function getTooltipX(point: WealthChartPoint) {
  if (point.x + tooltipWidth + tooltipOffset > chartWidth) {
    return point.x - tooltipWidth - tooltipOffset
  }

  return point.x + tooltipOffset
}

function getTooltipY(point: WealthChartPoint) {
  const preferredY = point.y - tooltipHeight - tooltipOffset
  const maxY = chartHeight - paddingBottom - tooltipHeight - 8

  return Math.max(8, Math.min(preferredY, maxY))
}

export function WealthMonthlyChart({ monthlyTotals }: WealthMonthlyChartProps) {
  const [months, setMonths] = useState(24)
  const [hoveredPoint, setHoveredPoint] = useState<WealthChartPoint | null>(null)

  if (monthlyTotals.length === 0) {
    return null
  }

  const visibleTotals = monthlyTotals.slice(-months)
  const points = getChartPoints(visibleTotals)
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  const activePoint = hoveredPoint ?? lastPoint
  const change = lastPoint.value - firstPoint.value
  const changePercent = firstPoint.value > 0 ? (change / firstPoint.value) * 100 : 0
  const isPositiveChange = change >= 0

  const pathData = buildLinePath(points)
  const areaPathData = buildAreaPath(points)
  const latestMonth = formatMonthLabel(lastPoint.month)

  const labelPoints = [
    points[0],
    points[Math.floor(points.length / 2)],
    points[points.length - 1],
  ].filter((point, index, array) => {
    return array.findIndex((item) => item.month === point.month) === index
  })
  return (
    <div className="wealth-chart-card">
      <div className="wealth-chart-header">
        <div>
          <h3>Wealth trend</h3>
          <p className="muted small">
            Manual balances plus derived owed money and investment values.
          </p>
        </div>

        <div className="wealth-chart-stat">
          <span>Current</span>
          <strong>{formatMoney(lastPoint.value.toFixed(2))}</strong>
          <small className={isPositiveChange ? 'positive' : 'negative'}>
            {isPositiveChange ? '+' : ''}
            {formatMoney(change.toFixed(2))} · {changePercent.toFixed(1)}%
          </small>
        </div>
      </div>

      <div className="wealth-chart-wrap">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label={`Monthly wealth trend. ${formatMonthLabel(activePoint.month)}: ${formatMoney(
            activePoint.value.toFixed(2),
          )}. Use Left and Right arrows to explore.`}
          tabIndex={0}
          onFocus={() => setHoveredPoint(lastPoint)}
          onBlur={() => setHoveredPoint(null)}
          onKeyDown={(event) => {
            const activeIndex = points.findIndex((point) => point.month === activePoint.month)
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
          <path d={areaPathData} className="wealth-chart-area" />

          <line
            x1={paddingLeft}
            y1={chartHeight - paddingBottom}
            x2={chartWidth - paddingRight}
            y2={chartHeight - paddingBottom}
            className="wealth-chart-baseline"
          />

          <path d={pathData} className="wealth-chart-line" />

          <circle
            cx={firstPoint.x}
            cy={firstPoint.y}
            r="3.5"
            className="wealth-chart-edge-point"
          >
            <title>{`${formatMonthLabel(firstPoint.month)}: ${formatMoney(firstPoint.value.toFixed(2))}`}</title>
          </circle>

          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="4.5"
            className="wealth-chart-current-point"
          >
            <title>{`${latestMonth}: ${formatMoney(lastPoint.value.toFixed(2))}`}</title>
          </circle>

          {hoveredPoint && (
            <>
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={chartHeight - paddingBottom}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="4 5"
                opacity="0.72"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4.8"
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth="2.3"
              />
              <g
                transform={`translate(${getTooltipX(activePoint)}, ${getTooltipY(activePoint)})`}
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
                  {formatMonthLabel(activePoint.month)}
                </text>
                <text x="12" y="39" fill="#111827" fontSize="14" fontWeight="850">
                  {formatMoney(activePoint.value.toFixed(2))}
                </text>
              </g>
            </>
          )}

          <text
            x={firstPoint.x}
            y={Math.max(firstPoint.y - 10, 14)}
            textAnchor="start"
            className="wealth-chart-value-label"
          >
            {formatMoney(firstPoint.value.toFixed(0))}
          </text>

          <text
            x={lastPoint.x}
            y={Math.max(lastPoint.y - 12, 14)}
            textAnchor="end"
            className="wealth-chart-value-label wealth-chart-value-label-current"
          >
            {formatMoney(lastPoint.value.toFixed(0))}
          </text>

          {labelPoints.map((point) => (
            <text
              key={point.month}
              x={point.x}
              y={chartHeight - 8}
              textAnchor={point.month === firstPoint.month ? 'start' : point.month === lastPoint.month ? 'end' : 'middle'}
              className="wealth-chart-label"
            >
              {formatMonthLabel(point.month)}
            </text>
          ))}
        </svg>
      </div>

      <div className="investment-trend-footer wealth-chart-footer">
        <div className="investment-trend-legend">
          <span>
            <i className="investment-trend-legend-value" />
            Net worth: manual + derived
          </span>
        </div>

        <div className="investment-trend-window-selector" aria-label="Wealth trend time window">
          {chartWindowOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === months ? 'active' : undefined}
              onClick={() => setMonths(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
