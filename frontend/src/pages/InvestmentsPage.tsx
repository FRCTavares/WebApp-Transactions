import { useEffect, useState } from 'react'
import { listInvestmentEvents } from '../api/investmentEvents'
import { StatusMessage } from '../components/StatusMessage'
import type { InvestmentEvent } from '../types/api'
import { formatDate, formatMoney } from '../utils/format'

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

function getEventCount(events: InvestmentEvent[], eventType: string) {
  return events.filter((event) => event.event_type === eventType).length
}

export function InvestmentsPage() {
  const [events, setEvents] = useState<InvestmentEvent[]>([])
  const [eventType, setEventType] = useState('')
  const [source, setSource] = useState('')
  const [month, setMonth] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
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

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Original</th>
              <th>Funding</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{formatDate(event.date)}</td>
                <td>{getEventTypeLabel(event.event_type)}</td>
                <td>
                  <strong>{event.description}</strong>
                  <span className="muted table-subtext">{event.raw_description}</span>
                </td>
                <td>{formatMoney(event.amount, event.currency)}</td>
                <td>
                  {event.original_amount && event.original_currency
                    ? formatMoney(event.original_amount, event.original_currency)
                    : '-'}
                </td>
                <td>{getFundingStatusLabel(event)}</td>
                <td>{event.source}</td>
              </tr>
            ))}

            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
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
