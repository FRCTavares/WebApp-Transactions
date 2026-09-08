import { useState } from 'react'
import { CircleAlert, Landmark } from 'lucide-react'
import { ChartLegend, TrendChart } from '../charts'
import { EmptyState, Skeleton } from '../ui'
import type { WealthMonthlyTotal } from '../../types/api'
import { formatMoney, formatMoneyCompact, formatMonthLabel } from '../../utils/format'

type WealthMonthlyChartProps = {
  monthlyTotals: WealthMonthlyTotal[]
  error?: string | null
  isLoading?: boolean
}

const chartWindowOptions = [
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
  { label: '24M', value: 24 },
  { label: '5Y', value: 60 },
]

export function WealthMonthlyChart({
  monthlyTotals,
  error = null,
  isLoading = false,
}: WealthMonthlyChartProps) {
  const [months, setMonths] = useState(24)

  if (monthlyTotals.length === 0) {
    if (isLoading) {
      return (
        <div
          className="wealth-chart-body wealth-chart-state"
          aria-busy="true"
          aria-label="Loading wealth history"
        >
          <Skeleton variant="block" height="13rem" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="wealth-chart-body wealth-chart-state" role="alert">
          <EmptyState
            icon={CircleAlert}
            title="Wealth history unavailable"
            description={error}
          />
        </div>
      )
    }

    return (
      <div className="wealth-chart-body wealth-chart-state">
        <EmptyState
          icon={Landmark}
          title="No wealth history yet"
          description="Add account snapshots to start building your monthly wealth trend."
        />
      </div>
    )
  }

  const visibleTotals = monthlyTotals.slice(-months)
  const points = visibleTotals.map((row) => row.month)
  const values = visibleTotals.map((row) => Number(row.total_wealth_eur))
  const firstValue = values[0]
  const lastValue = values[values.length - 1]
  const change = lastValue - firstValue
  const changePercent = firstValue > 0 ? (change / firstValue) * 100 : 0
  const isPositiveChange = change >= 0

  return (
    <div className="wealth-chart-body">
      <div className="wealth-chart-header">
        <div>
          <h3>Wealth trend</h3>
          <p className="muted small">
            Manual balances plus derived owed money and investment values.
          </p>
        </div>

        <div className="wealth-chart-stat">
          <span>Current</span>
          <strong>{formatMoney(lastValue.toFixed(2))}</strong>
          <small className={isPositiveChange ? 'positive' : 'negative'}>
            {isPositiveChange ? '+' : ''}
            {formatMoney(change.toFixed(2))} · {changePercent.toFixed(1)}%
          </small>
        </div>
      </div>

      <TrendChart
        points={points}
        series={[
          {
            key: 'net-worth',
            label: 'Net worth',
            values,
            lineClassName: 'wealth-chart-line',
            areaClassName: 'wealth-chart-area',
            startPointClassName: 'wealth-chart-edge-point',
            endPointClassName: 'wealth-chart-current-point',
          },
        ]}
        formatValue={(value) => formatMoney(value.toFixed(2))}
        formatAxisValue={(value) => formatMoneyCompact(value)}
        formatPointLabel={(pointKey) => formatMonthLabel(pointKey)}
        ariaLabelPrefix="Monthly wealth trend."
        xLabelClassName="wealth-chart-label"
        baselineClassName="wealth-chart-baseline"
        showEdgeValueLabels
        currentEdgeValueLabelClassName="wealth-chart-value-label wealth-chart-value-label-current"
      />

      <div className="investment-trend-footer wealth-chart-footer">
        <ChartLegend
          items={[
            {
              className: 'investment-trend-legend-value',
              label: 'Net worth: manual + derived',
            },
          ]}
        />

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
