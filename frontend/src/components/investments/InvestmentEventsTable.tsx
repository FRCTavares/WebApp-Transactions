import { TrendingUp } from 'lucide-react'
import type { InvestmentEvent } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'
import type { ManualFundingFormState } from '../../utils/investmentsPageUtils'
import { Badge, Button, EmptyState } from '../ui'
import type { BadgeTone } from '../ui'

type InvestmentEventsTableProps = {
  events: InvestmentEvent[]
  resolvingEventId: number | null
  fundingForm: ManualFundingFormState
  onFundingFormChange: (form: ManualFundingFormState) => void
  onSubmitManualResolution: (event: InvestmentEvent) => void
  onCancelManualResolution: () => void
  onStartManualResolution: (event: InvestmentEvent) => void
}

function getEventTypeLabel(eventType: string) {
  return eventType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getFundingStatusLabel(event: InvestmentEvent) {
  if (!event.funding_source && !event.funding_match_status) {
    return '-'
  }

  const source = event.funding_source ?? 'Unknown source'
  const status = event.funding_match_status ?? 'unknown'

  return `${source} · ${status}`
}

function getFundingTone(event: InvestmentEvent): BadgeTone {
  if (event.funding_match_status === 'manual') {
    return 'positive'
  }

  if (event.funding_match_status === 'unmatched') {
    return 'warning'
  }

  return 'neutral'
}

/* Tones preserve the meaning the old per-event badge colours carried:
   deposit blue, market buy violet, market sell orange, dividend/interest
   green, withdrawal red. */
const EVENT_TONE: Record<string, BadgeTone> = {
  deposit: 'accent',
  market_buy: 'investment',
  market_sell: 'expense',
  dividend: 'positive',
  interest: 'positive',
  withdrawal: 'negative',
}

function getEventTone(eventType: string): BadgeTone {
  return EVENT_TONE[eventType] ?? 'neutral'
}

function canResolveManually(event: InvestmentEvent) {
  return event.event_type === 'deposit' && event.funding_match_status === 'unmatched'
}

export function InvestmentEventsTable({
  events,
  resolvingEventId,
  fundingForm,
  onFundingFormChange,
  onSubmitManualResolution,
  onCancelManualResolution,
  onStartManualResolution,
}: InvestmentEventsTableProps) {
  return (
    <div className="content-card table-wrap investments-table-wrap">
      <table className="investments-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Event</th>
            <th>Description</th>
            <th className="right">Amount</th>
            <th className="right">Original</th>
            <th>Funding</th>
            <th>Source</th>
            <th className="actions-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td className="date-cell">{formatDate(event.date)}</td>
              <td>
                <Badge tone={getEventTone(event.event_type)} size="sm">
                  {getEventTypeLabel(event.event_type)}
                </Badge>
              </td>
              <td className="description-cell">
                <strong>{event.description}</strong>
                <span className="muted table-subtext">{event.raw_description}</span>

                {resolvingEventId === event.id && (
                  <div className="inline-form">
                    <label>
                      EUR amount
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={fundingForm.eurAmount}
                        onChange={(inputEvent) => onFundingFormChange({
                          ...fundingForm,
                          eurAmount: inputEvent.target.value,
                        })}
                      />
                    </label>

                    <label>
                      Funding date
                      <input
                        type="date"
                        value={fundingForm.date}
                        onChange={(inputEvent) => onFundingFormChange({
                          ...fundingForm,
                          date: inputEvent.target.value,
                        })}
                      />
                    </label>

                    <label>
                      Description
                      <input
                        value={fundingForm.description}
                        onChange={(inputEvent) => onFundingFormChange({
                          ...fundingForm,
                          description: inputEvent.target.value,
                        })}
                      />
                    </label>

                    <label>
                      Notes
                      <input
                        value={fundingForm.notes}
                        onChange={(inputEvent) => onFundingFormChange({
                          ...fundingForm,
                          notes: inputEvent.target.value,
                        })}
                      />
                    </label>

                    <div className="action-group">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => onSubmitManualResolution(event)}
                      >
                        Save resolution
                      </Button>
                      <Button type="button" size="sm" onClick={onCancelManualResolution}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </td>
              <td className="right money-cell">{formatMoney(event.amount, event.currency)}</td>
              <td className="right money-cell">
                {event.original_amount && event.original_currency
                  ? formatMoney(event.original_amount, event.original_currency)
                  : '-'}
              </td>
              <td>
                {getFundingStatusLabel(event) === '-' ? (
                  <span className="muted">-</span>
                ) : (
                  <>
                    <Badge tone={getFundingTone(event)} size="sm">
                      {getFundingStatusLabel(event)}
                    </Badge>

                    {event.matched_transaction && (
                      <span className="muted table-subtext">
                        Linked #{event.matched_transaction.id} ·{' '}
                        {formatMoney(
                          event.matched_transaction.amount,
                          event.matched_transaction.currency,
                        )}{' '}
                        · {formatDate(event.matched_transaction.date)}
                      </span>
                    )}
                  </>
                )}
              </td>
              <td>
                <Badge tone="neutral" size="sm">{event.source}</Badge>
              </td>
              <td className="actions-cell">
                {canResolveManually(event) ? (
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => onStartManualResolution(event)}
                  >
                    Resolve
                  </Button>
                ) : (
                  <span className="muted">-</span>
                )}
              </td>
            </tr>
          ))}

          {events.length === 0 && (
            <tr>
              <td colSpan={8} className="empty-state">
                <EmptyState
                  size="sm"
                  icon={TrendingUp}
                  title="No investment events found."
                  description="Events appear here once a statement is imported."
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
