import {
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { Button, Card } from '../ui'
import { formatMoney } from '../../utils/format'
import type { InvestmentMonthlyChange, MonthlySummary } from '../../types/api'
import '../../styles/monthly-cashflow.css'

type MonthlyCashflowPanelProps = {
  summary: MonthlySummary
  monthLabel: string
  investmentChange: InvestmentMonthlyChange | null
  onSaveTripSavings: (amountEur: string | null) => Promise<void>
}

type Segment = {
  key: string
  label: string
  amount: number
  className: string
}

type Stat = {
  key: string
  label: string
  amount: number
  dot: string
  tone: boolean
  detail?: string
}

function toneClass(amount: number) {
  if (amount > 0.005) return 'is-positive'
  if (amount < -0.005) return 'is-negative'
  return 'is-neutral'
}

function goalMessage(summary: MonthlySummary) {
  switch (summary.investment_goal_status) {
    case 'unavailable':
      return 'Cash flow unavailable'
    case 'reached':
      return 'Goal reached'
    case 'exceeded':
      return `Over by ${formatMoney(summary.investment_goal_over ?? '0.00')}`
    default:
      return `${formatMoney(summary.investment_goal_remaining ?? '0.00')} to go`
  }
}

function tripSavingsDetail(summary: MonthlySummary) {
  const goal = Number(summary.trip_savings_goal_eur)
  const actual = Number(summary.trip_savings_allocated_eur)
  const source =
    summary.trip_savings_allocation_source === 'default'
      ? 'normal default'
      : 'month override'

  if (summary.trip_savings_goal_status === 'exceeded') {
    return `Target ${formatMoney(goal.toFixed(2))} • ${source} • ${formatMoney(
      (actual - goal).toFixed(2),
    )} above target`
  }

  if (summary.trip_savings_goal_status === 'reached') {
    return `Target ${formatMoney(goal.toFixed(2))} • ${source} • target reached`
  }

  return `Target ${formatMoney(goal.toFixed(2))} • ${source} • ${formatMoney(
    Math.max(0, goal - actual).toFixed(2),
  )} below target`
}

export function MonthlyCashflowPanel({
  summary,
  monthLabel,
  investmentChange,
  onSaveTripSavings,
}: MonthlyCashflowPanelProps) {
  const moneyIn = Number(summary.money_in)
  const spent = Number(summary.personal_money_out)
  const invested =
    summary.net_invested_cash === null ? null : Number(summary.net_invested_cash)
  const tripSavings = Number(summary.trip_savings_allocated_eur)
  const availableNet =
    summary.available_net === null ? null : Number(summary.available_net)

  const [isEditingTripSavings, setIsEditingTripSavings] = useState(false)
  const [tripSavingsDraft, setTripSavingsDraft] = useState(
    summary.trip_savings_allocated_eur,
  )
  const [tripSavingsError, setTripSavingsError] = useState<string | null>(null)
  const [isSavingTripSavings, setIsSavingTripSavings] = useState(false)

  const outflow = spent + tripSavings + (invested ?? 0)
  const barBase = Math.max(moneyIn, outflow, 1)
  const leftover = availableNet === null ? 0 : Math.max(0, availableNet)

  const segments: Segment[] = [
    { key: 'spent', label: 'Spent', amount: spent, className: 'cashflow-seg-spent' },
    ...(invested !== null && invested > 0
      ? [
          {
            key: 'invested',
            label: 'Invested',
            amount: invested,
            className: 'cashflow-seg-invested',
          },
        ]
      : []),
    ...(tripSavings > 0
      ? [
          {
            key: 'trip',
            label: 'Trip savings',
            amount: tripSavings,
            className: 'cashflow-seg-trip',
          },
        ]
      : []),
    ...(leftover > 0
      ? [
          {
            key: 'leftover',
            label: 'Available net',
            amount: leftover,
            className: 'cashflow-seg-leftover',
          },
        ]
      : []),
  ]

  const stats: Stat[] = [
    {
      key: 'income',
      label: 'Income',
      amount: moneyIn,
      dot: 'cashflow-seg-leftover',
      tone: false,
    },
    {
      key: 'spent',
      label: 'Spent',
      amount: spent,
      dot: 'cashflow-seg-spent',
      tone: false,
    },
    ...(invested !== null
      ? [
          {
            key: 'invested',
            label: 'Invested',
            amount: invested,
            dot: 'cashflow-seg-invested',
            tone: false,
          },
        ]
      : []),
    {
      key: 'trip',
      label: 'Trip savings',
      amount: tripSavings,
      dot: 'cashflow-seg-trip',
      tone: false,
      detail: tripSavingsDetail(summary),
    },
    ...(availableNet !== null
      ? [
          {
            key: 'net',
            label: 'Available net',
            amount: availableNet,
            dot: 'cashflow-seg-leftover',
            tone: true,
          },
        ]
      : []),
  ]

  const goalTarget = Number(summary.investment_goal_eur)
  const goalProgress =
    invested === null || goalTarget <= 0
      ? 0
      : Math.max(0, Math.min(100, (invested / goalTarget) * 100))

  const perf =
    investmentChange?.unrealised_monthly_change == null
      ? null
      : Number(investmentChange.unrealised_monthly_change)

  async function handleTripSavingsSubmit(event: FormEvent) {
    event.preventDefault()

    const draftValue = Number(tripSavingsDraft)

    if (
      tripSavingsDraft.trim() === ''
      || !Number.isFinite(draftValue)
      || draftValue < 0
    ) {
      setTripSavingsError('Enter an amount of zero or more.')
      return
    }

    setIsSavingTripSavings(true)
    setTripSavingsError(null)

    try {
      await onSaveTripSavings(tripSavingsDraft)
      setIsEditingTripSavings(false)
    } catch (error) {
      setTripSavingsError(
        error instanceof Error ? error.message : 'Could not save trip savings.',
      )
    } finally {
      setIsSavingTripSavings(false)
    }
  }

  async function handleUseNormalDefault() {
    setIsSavingTripSavings(true)
    setTripSavingsError(null)

    try {
      await onSaveTripSavings(null)
      setIsEditingTripSavings(false)
    } catch (error) {
      setTripSavingsError(
        error instanceof Error ? error.message : 'Could not reset trip savings.',
      )
    } finally {
      setIsSavingTripSavings(false)
    }
  }

  return (
    <Card as="section" padding="md" className="cashflow-panel">
      <div className="cashflow-head">
        <div>
          <h2>Cash flow</h2>
          <p className="muted small">How {monthLabel}&rsquo;s money moved</p>
        </div>
        <div className={`cashflow-headline ${availableNet === null ? 'is-neutral' : toneClass(availableNet)}`}>
          <span>Available net</span>
          <strong>{availableNet === null ? '—' : formatMoney(availableNet.toFixed(2))}</strong>
          <small>after spending, investing and trip savings</small>
        </div>
      </div>

      <div
        className="cashflow-bar"
        role="img"
        aria-label={`Of ${formatMoney(moneyIn.toFixed(2))} in, ${formatMoney(
          spent.toFixed(2),
        )} spent${invested === null ? '' : `, ${formatMoney(invested.toFixed(2))} invested`}, ${formatMoney(
          tripSavings.toFixed(2),
        )} trip savings${leftover > 0 ? `, ${formatMoney(leftover.toFixed(2))} available` : ''}.`}
      >
        {segments.map((segment) => (
          <span
            key={segment.key}
            className={segment.className}
            style={{ '--seg': `${(segment.amount / barBase) * 100}%` } as CSSProperties}
            title={`${segment.label}: ${formatMoney(segment.amount.toFixed(2))}`}
          />
        ))}
      </div>

      <div className="cashflow-legend">
        {stats.map((stat) => (
          <div key={stat.key} className="cashflow-stat">
            <span>
              <i className={stat.dot} />
              {stat.label}
            </span>
            <strong className={stat.tone ? toneClass(stat.amount) : undefined}>
              {formatMoney(stat.amount.toFixed(2))}
            </strong>
            <small>
              {stat.detail
                ?? (moneyIn > 0
                  ? `${Math.round((stat.amount / moneyIn) * 100)}% of money in`
                  : '—')}
            </small>
            {stat.key === 'trip' && (
              <button
                type="button"
                className="cashflow-trip-edit"
                onClick={() => {
                  if (isEditingTripSavings) {
                    setIsEditingTripSavings(false)
                    return
                  }

                  setTripSavingsDraft(
                    summary.trip_savings_allocated_eur,
                  )
                  setTripSavingsError(null)
                  setIsEditingTripSavings(true)
                }}
                aria-expanded={isEditingTripSavings}
              >
                {isEditingTripSavings ? 'Close' : 'Edit month'}
              </button>
            )}
          </div>
        ))}
      </div>

      {isEditingTripSavings && (
        <form className="cashflow-trip-form" onSubmit={handleTripSavingsSubmit}>
          <label>
            <span>Trip savings for {monthLabel}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={tripSavingsDraft}
              onChange={(event) => {
                setTripSavingsDraft(event.target.value)
                setTripSavingsError(null)
              }}
              disabled={isSavingTripSavings}
            />
          </label>

          <div className="cashflow-trip-form-actions">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={isSavingTripSavings}
            >
              Save month
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSavingTripSavings}
              onClick={() => void handleUseNormalDefault()}
            >
              Use normal default
            </Button>
          </div>

          <p className="muted small">
            Zero explicitly records no trip savings for this month. “Use normal
            default” returns this month to its configured target.
          </p>

          {tripSavingsError && (
            <p className="status status-error" role="alert">
              {tripSavingsError}
            </p>
          )}
        </form>
      )}

      <div className="cashflow-foot">
        <div className="cashflow-goal">
          <div className="cashflow-goal-head">
            <span>Investment goal</span>
            <strong>{goalMessage(summary)}</strong>
          </div>
          <div
            className="cashflow-goal-track"
            role="progressbar"
            aria-label="Monthly investment goal progress"
            aria-valuemin={0}
            aria-valuemax={goalTarget > 0 ? goalTarget : undefined}
            aria-valuenow={invested === null ? undefined : Math.max(0, invested)}
          >
            <span style={{ width: `${goalProgress}%` }} />
          </div>
          <small className="muted">
            {invested === null
              ? 'Invested amount is temporarily unavailable.'
              : `${formatMoney(invested.toFixed(2))} of ${formatMoney(summary.investment_goal_eur)}`}
          </small>
          {summary.investment_reconciliation_status === 'partial' && (
            <small className="cashflow-warn" role="status">
              Some investment funding is not fully reconciled.
            </small>
          )}
        </div>

        <div className={`cashflow-perf ${perf === null ? 'is-neutral' : toneClass(perf)}`}>
          <span>Investment performance</span>
          <strong>
            {perf === null
              ? '—'
              : `${perf >= 0 ? '+' : ''}${formatMoney(perf.toFixed(2))}`}
          </strong>
          <small>
            {investmentChange?.is_estimated ? 'Estimated ' : ''}
            unrealised market/FX — not part of cash flow
          </small>
        </div>
      </div>
    </Card>
  )
}
