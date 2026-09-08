import { CircleAlert, TrendingUp } from 'lucide-react'
import { ChartLegend, TrendChart } from '../charts'
import { EmptyState, Skeleton } from '../ui'
import type { InvestmentMonthlySeriesPoint } from '../../types/api'
import { formatMoney, formatMoneyCompact, formatMonthLabel } from '../../utils/format'

type InvestmentPortfolioTrendChartProps = {
  months: number
  series: InvestmentMonthlySeriesPoint[]
  error?: string | null
  isLoading?: boolean
  onMonthsChange: (months: number) => void
}

const chartWindowOptions = [
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
  { label: '24M', value: 24 },
  { label: '5Y', value: 60 },
]

type SeriesPoint = {
  month: string
  allocated: number | null
  marketValue: number | null
  gain: number | null
  isEstimated: boolean
}

function toNullableNumber(value: string | null) {
  if (value === null) {
    return null
  }

  const number = Number(value)
  return Number.isNaN(number) ? null : number
}

function buildPoints(series: InvestmentMonthlySeriesPoint[]): SeriesPoint[] {
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
  error,
  isLoading,
  months,
  onMonthsChange,
}: {
  error: string | null
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

      {isLoading ? (
        <div
          className="investment-trend-state"
          aria-busy="true"
          aria-label="Loading portfolio trend"
        >
          <Skeleton variant="block" height="11rem" />
        </div>
      ) : error ? (
        <div className="investment-trend-state" role="alert">
          <EmptyState
            icon={CircleAlert}
            title="Portfolio trend unavailable"
            description={error}
          />
        </div>
      ) : (
        <div className="investment-trend-state">
          <EmptyState
            icon={TrendingUp}
            title="No portfolio trend yet"
            description="Add investment events and valuation prices to show the portfolio trend."
          />
        </div>
      )}
    </section>
  )
}

export function InvestmentPortfolioTrendChart({
  months,
  series,
  error = null,
  isLoading = false,
  onMonthsChange,
}: InvestmentPortfolioTrendChartProps) {
  const points = buildPoints(series)

  if (points.length === 0) {
    return (
      <InvestmentPortfolioTrendPlaceholder
        error={error}
        isLoading={isLoading}
        months={months}
        onMonthsChange={onMonthsChange}
      />
    )
  }

  const latestPoint =
    [...points].reverse().find((point) => point.marketValue !== null)
    ?? points[points.length - 1]
  const latestMarketValue = latestPoint.marketValue
  const latestGain = latestPoint.gain
  const estimatedByMonth = new Map(
    points.map((point) => [point.month, point.isEstimated]),
  )

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

      <TrendChart
        points={points.map((point) => point.month)}
        series={[
          {
            key: 'market-value',
            label: 'Portfolio',
            values: points.map((point) => point.marketValue),
            lineClassName: 'investment-trend-value-line',
            endPointClassName: 'investment-trend-current-point',
          },
          {
            key: 'allocated',
            label: 'Allocated',
            values: points.map((point) => point.allocated),
            lineClassName: 'investment-trend-allocated-line',
          },
        ]}
        formatValue={(value) => formatMoney(value.toFixed(2))}
        formatAxisValue={(value) => formatMoneyCompact(value)}
        formatPointLabel={(pointKey) => formatMonthLabel(pointKey)}
        pointNote={(pointKey) =>
          estimatedByMonth.get(pointKey) ? 'estimated' : null
        }
        ariaLabelPrefix="Investment portfolio trend."
        xLabelClassName="investment-trend-label"
        baselineClassName="investment-trend-baseline"
      />

      <div className="investment-trend-footer">
        <ChartLegend
          items={[
            {
              className: 'investment-trend-legend-value',
              label: 'Portfolio value',
            },
            {
              className: 'investment-trend-legend-allocated',
              label: 'Allocated capital',
            },
          ]}
        />

        <ChartWindowSelector months={months} onMonthsChange={onMonthsChange} />
      </div>
    </section>
  )
}
