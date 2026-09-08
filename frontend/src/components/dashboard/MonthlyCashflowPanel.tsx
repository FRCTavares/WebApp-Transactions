import type { CSSProperties } from 'react'
import { Card } from '../ui'
import { formatMoney } from '../../utils/format'
import type { InvestmentMonthlyChange, MonthlySummary } from '../../types/api'

type MonthlyCashflowPanelProps = {
  summary: MonthlySummary
  monthLabel: string
  investmentChange: InvestmentMonthlyChange | null
}

type Segment = {
  key: string
  label: string
  amount: number
  className: string
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

export function MonthlyCashflowPanel({
  summary,
  monthLabel,
  investmentChange,
}: MonthlyCashflowPanelProps) {
  const moneyIn = Number(summary.money_in)
  const spent = Number(summary.personal_money_out)
  const invested =
    summary.net_invested_cash === null ? null : Number(summary.net_invested_cash)
  const availableNet =
    summary.available_net === null ? null : Number(summary.available_net)

  const outflow = spent + (invested ?? 0)
  const barBase = Math.max(moneyIn, outflow, 1)
  // Only a fully-reconciled month (invested known) can be split into a
  // trustworthy "left over" slice.
  const leftover =
    invested === null ? 0 : Math.max(0, moneyIn - outflow)

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

  const stats: {
    key: string
    label: string
    amount: number
    dot: string
    tone: boolean
  }[] = [
    { key: 'spent', label: 'Spent', amount: spent, dot: 'cashflow-seg-spent', tone: false },
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
          <small>after spending and investing</small>
        </div>
      </div>

      <div className="cashflow-inflow">
        <span>Money in</span>
        <strong>{formatMoney(moneyIn.toFixed(2))}</strong>
      </div>

      <div
        className="cashflow-bar"
        role="img"
        aria-label={`Of ${formatMoney(moneyIn.toFixed(2))} in, ${formatMoney(
          spent.toFixed(2),
        )} spent${invested === null ? '' : `, ${formatMoney(invested.toFixed(2))} invested`}${
          leftover > 0 ? `, ${formatMoney(leftover.toFixed(2))} left` : ''
        }.`}
      >
        {segments.map((segment) => (
          <span
            key={segment.key}
            className={segment.className}
            style={{ '--seg': `${(segment.amount / barBase) * 100}%` } as CSSProperties}
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
              {moneyIn > 0
                ? `${Math.round((stat.amount / moneyIn) * 100)}% of money in`
                : '—'}
            </small>
          </div>
        ))}
      </div>

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
