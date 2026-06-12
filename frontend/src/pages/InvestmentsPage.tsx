import { useEffect, useState } from 'react'
import { listInvestmentEvents, resolveManualFunding } from '../api/investmentEvents'
import { StatusMessage } from '../components/StatusMessage'
import type { InvestmentEvent } from '../types/api'
import { formatDate, formatMoney } from '../utils/format'

type ManualFundingFormState = {
  eurAmount: string
  date: string
  description: string
  notes: string
}

function getMonthDateRange(month: string) {
  if (!month) {
    return {
      dateFrom: '',
      dateTo: '',
    }
  }

  const [year, monthNumber] = month.split('-').map(Number)
  const monthText = String(monthNumber).padStart(2, '0')
  const lastDay = new Date(year, monthNumber, 0).getDate()

  return {
    dateFrom: `${year}-${monthText}-01`,
    dateTo: `${year}-${monthText}-${String(lastDay).padStart(2, '0')}`,
  }
}

function getActiveFilterCount(values: string[]) {
  return values.filter(Boolean).length
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

function getFundingBadgeClass(event: InvestmentEvent) {
  if (event.funding_match_status === 'manual') {
    return 'badge badge-status-completed'
  }

  if (event.funding_match_status === 'unmatched') {
    return 'badge badge-status-pending'
  }

  return 'badge badge-neutral'
}

function getEventCount(events: InvestmentEvent[], eventType: string) {
  return events.filter((event) => event.event_type === eventType).length
}

function canResolveManually(event: InvestmentEvent) {
  return event.event_type === 'deposit' && event.funding_match_status === 'unmatched'
}

function createDefaultFundingForm(event: InvestmentEvent): ManualFundingFormState {
  return {
    eurAmount: '',
    date: event.date,
    description: 'Trading 212 deposit funding',
    notes: `Manual EUR funding resolution for ${event.amount} ${event.currency} deposit`,
  }
}

export function InvestmentsPage() {
  const [events, setEvents] = useState<InvestmentEvent[]>([])
  const [eventType, setEventType] = useState('')
  const [source, setSource] = useState('')
  const [month, setMonth] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [resolvingEventId, setResolvingEventId] = useState<number | null>(null)
  const [fundingForm, setFundingForm] = useState<ManualFundingFormState>({
    eurAmount: '',
    date: '',
    description: '',
    notes: '',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadEvents() {
    setError(null)
    setMessage(null)

    const monthDateRange = getMonthDateRange(month)

    listInvestmentEvents({
      source: source || undefined,
      event_type: eventType || undefined,
      date_from: dateFrom || monthDateRange.dateFrom || undefined,
      date_to: dateTo || monthDateRange.dateTo || undefined,
      limit: 100,
    })
      .then(setEvents)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load investment events')
      })
  }

  useEffect(() => {
    loadEvents()
  }, [])

  function clearFilters() {
    setEventType('')
    setSource('')
    setMonth('')
    setDateFrom('')
    setDateTo('')

    listInvestmentEvents({ limit: 100 })
      .then(setEvents)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load investment events')
      })
  }

  function startManualResolution(event: InvestmentEvent) {
    setResolvingEventId(event.id)
    setFundingForm(createDefaultFundingForm(event))
    setError(null)
    setMessage(null)
  }

  function cancelManualResolution() {
    setResolvingEventId(null)
    setFundingForm({
      eurAmount: '',
      date: '',
      description: '',
      notes: '',
    })
  }

  async function submitManualResolution(event: InvestmentEvent) {
    setError(null)
    setMessage(null)

    if (!fundingForm.eurAmount || Number(fundingForm.eurAmount) <= 0) {
      setError('Enter a positive EUR amount.')
      return
    }

    if (!fundingForm.date) {
      setError('Enter a funding date.')
      return
    }

    if (!fundingForm.description.trim()) {
      setError('Enter a description.')
      return
    }

    const confirmed = window.confirm(
      `This will create a real Money Out investment transaction for ${formatMoney(
        fundingForm.eurAmount,
      )}. Continue?`,
    )

    if (!confirmed) {
      return
    }

    try {
      await resolveManualFunding(event.id, {
        eur_amount: fundingForm.eurAmount,
        date: fundingForm.date,
        description: fundingForm.description,
        notes: fundingForm.notes || null,
      })

      setMessage('Manual funding resolution saved.')
      cancelManualResolution()
      loadEvents()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to resolve manual funding')
    }
  }

  const activeFilterCount = getActiveFilterCount([eventType, source, month, dateFrom, dateTo])
  const depositCount = getEventCount(events, 'deposit')
  const marketBuyCount = getEventCount(events, 'market_buy')
  const unmatchedDepositCount = events.filter(
    (event) => event.event_type === 'deposit' && event.funding_match_status === 'unmatched',
  ).length

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Investments</h1>
          <p className="muted small">
            {events.length} investment events loaded from broker imports.
          </p>
        </div>

        <div className="action-group">
          <button type="button" onClick={loadEvents}>
            Refresh
          </button>
        </div>
      </div>

      <StatusMessage error={error} message={message} />

      <div className="summary-grid">
        <article className="summary-card">
          <h2>Investment events</h2>
          <strong>{events.length}</strong>
        </article>

        <article className="summary-card">
          <h2>Deposits</h2>
          <strong>{depositCount}</strong>
        </article>

        <article className="summary-card">
          <h2>Market buys</h2>
          <strong>{marketBuyCount}</strong>
        </article>

        <article className="summary-card">
          <h2>Unmatched deposits</h2>
          <strong>{unmatchedDepositCount}</strong>
        </article>
      </div>

      <details className="filter-panel compact-filter-panel">
        <summary>
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="filter-count">{activeFilterCount} active</span>
          )}
        </summary>

        <div className="form-row">
          <label>
            Event Type
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
            >
              <option value="">All event types</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="market_buy">Market Buy</option>
              <option value="market_sell">Market Sell</option>
              <option value="dividend">Dividend</option>
              <option value="interest">Interest</option>
              <option value="fx_conversion">FX Conversion</option>
            </select>
          </label>

          <label>
            Source
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">All sources</option>
              <option value="trading212">Trading 212</option>
              <option value="manual">Manual</option>
            </select>
          </label>

          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>

          <label>
            Date From
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>

          <label>
            Date To
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
        </div>

        <div className="action-group">
          <button type="button" onClick={loadEvents}>
            Apply Filters
          </button>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </details>

      <p className="muted">
        Investment events are broker ledger entries. They do not affect Money In or Money Out unless a separate bank transaction exists.
      </p>

      <div className="table-wrap investments-table-wrap">
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
                  <span className={`badge badge-event-${event.event_type.replaceAll('_', '-')}`}>
                    {getEventTypeLabel(event.event_type)}
                  </span>
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
                          onChange={(inputEvent) => setFundingForm({
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
                          onChange={(inputEvent) => setFundingForm({
                            ...fundingForm,
                            date: inputEvent.target.value,
                          })}
                        />
                      </label>

                      <label>
                        Description
                        <input
                          value={fundingForm.description}
                          onChange={(inputEvent) => setFundingForm({
                            ...fundingForm,
                            description: inputEvent.target.value,
                          })}
                        />
                      </label>

                      <label>
                        Notes
                        <input
                          value={fundingForm.notes}
                          onChange={(inputEvent) => setFundingForm({
                            ...fundingForm,
                            notes: inputEvent.target.value,
                          })}
                        />
                      </label>

                      <div className="action-group">
                        <button type="button" onClick={() => submitManualResolution(event)}>
                          Save resolution
                        </button>
                        <button type="button" onClick={cancelManualResolution}>
                          Cancel
                        </button>
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
                    <span className={getFundingBadgeClass(event)}>
                      {getFundingStatusLabel(event)}
                    </span>
                  )}
                </td>
                <td>
                  <span className="badge badge-source">{event.source}</span>
                </td>
                <td className="actions-cell">
                  {canResolveManually(event) ? (
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => startManualResolution(event)}
                    >
                      Resolve
                    </button>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            ))}

            {events.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">
                  No investment events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
