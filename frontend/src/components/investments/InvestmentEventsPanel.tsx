import { InvestmentEventsTable } from './InvestmentEventsTable'
import type { InvestmentEventSort, ManualFundingFormState } from '../../utils/investmentsPageUtils'
import type { InvestmentEvent } from '../../types/api'
import { Button } from '../ui'

/**
 * The "Investment events" card (sort/pagination controls plus the events
 * table) on `InvestmentsPage`. Split out (which was approaching the
 * project's 900-line soft limit) — purely presentational, all state
 * lives in the parent page.
 */
export function InvestmentEventsPanel({
  isOpen,
  onToggleOpen,
  eventSort,
  onEventSortChange,
  totalEventCount,
  paginatedEvents,
  shownFirstEvent,
  shownLastEvent,
  currentEventPage,
  eventPageCount,
  onPreviousPage,
  onNextPage,
  resolvingEventId,
  fundingForm,
  onFundingFormChange,
  onSubmitManualResolution,
  onCancelManualResolution,
  onStartManualResolution,
}: {
  isOpen: boolean
  onToggleOpen: () => void
  eventSort: InvestmentEventSort
  onEventSortChange: (sort: InvestmentEventSort) => void
  totalEventCount: number
  paginatedEvents: InvestmentEvent[]
  shownFirstEvent: number
  shownLastEvent: number
  currentEventPage: number
  eventPageCount: number
  onPreviousPage: () => void
  onNextPage: () => void
  resolvingEventId: number | null
  fundingForm: ManualFundingFormState
  onFundingFormChange: (form: ManualFundingFormState) => void
  onSubmitManualResolution: (event: InvestmentEvent) => void
  onCancelManualResolution: () => void
  onStartManualResolution: (event: InvestmentEvent) => void
}) {
  return (
    <section className="content-card panel-card investment-events-card">
      <div className="section-header">
        <div>
          <h2>Investment events</h2>
          <p className="muted small">
            {totalEventCount} broker ledger entries.
          </p>
        </div>

        <div className="action-group">
          {isOpen && (
            <select
              aria-label="Sort investment events"
              value={eventSort}
              onChange={(event) => onEventSortChange(event.target.value as InvestmentEventSort)}
              style={{ maxWidth: '220px' }}
            >
              <option value="date_desc">Date newest</option>
              <option value="date_asc">Date oldest</option>
              <option value="amount_desc">Amount highest</option>
              <option value="amount_asc">Amount lowest</option>
              <option value="event_type">Event type</option>
            </select>
          )}

          <Button
            size="sm"
            type="button"
            onClick={onToggleOpen}
          >
            {isOpen ? 'Hide events' : 'Show events'}
          </Button>
        </div>
      </div>

      {isOpen ? (
        <>
          <div className="section-header">
            <p className="muted small">
              Showing {shownFirstEvent}-{shownLastEvent} of {totalEventCount} events.
            </p>

            <div className="action-group">
              <Button
                size="sm"
                type="button"
                disabled={currentEventPage <= 1}
                onClick={onPreviousPage}
              >
                Previous
              </Button>
              <span className="muted small">
                Page {currentEventPage} of {eventPageCount}
              </span>
              <Button
                size="sm"
                type="button"
                disabled={currentEventPage >= eventPageCount}
                onClick={onNextPage}
              >
                Next
              </Button>
            </div>
          </div>

          <InvestmentEventsTable
            events={paginatedEvents}
            resolvingEventId={resolvingEventId}
            fundingForm={fundingForm}
            onFundingFormChange={onFundingFormChange}
            onSubmitManualResolution={onSubmitManualResolution}
            onCancelManualResolution={onCancelManualResolution}
            onStartManualResolution={onStartManualResolution}
          />
        </>
      ) : null}
    </section>
  )
}
