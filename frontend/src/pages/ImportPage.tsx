import { useEffect, useState } from 'react'
import {
  commitImport,
  deleteImportBatch,
  listImportBatches,
  listImportBatchInvestmentEvents,
  listImportBatchTransactions,
  previewImport,
} from '../api/imports'
import { StatusMessage } from '../components/StatusMessage'
import { TransactionTable } from '../components/TransactionTable'
import type {
  ImportBatch,
  ImportInvalidRow,
  ImportPreviewInvestmentEvent,
  ImportPreviewResponse,
  ImportPreviewTransaction,
  InvestmentEvent,
  Transaction,
} from '../types/api'
import { formatDate, formatMoney } from '../utils/format'

const SOURCES = ['revolut', 'activobank', 'trading212']
const HIDDEN_BATCH_SOURCES = ['legacy_excel', 'legacy_excel_wealth']

function getStatusBadgeClass(status: string) {
  return `badge badge-status-${status.replaceAll('_', '-')}`
}

function hasPendingFx(
  rows: Array<{ is_duplicate: boolean; fx_rate_source: string | null }>,
) {
  return rows.some((row) => !row.is_duplicate && row.fx_rate_source === 'pending')
}

function getPendingFxRowNumbers(
  rows: Array<{ row_number: number; is_duplicate: boolean; fx_rate_source: string | null }>,
) {
  return rows
    .filter((row) => !row.is_duplicate && row.fx_rate_source === 'pending')
    .map((row) => row.row_number)
}

function canRemainUnresolved(
  event: ImportPreviewInvestmentEvent,
) {
  return (
    event.event_type === 'deposit' &&
    event.funding_source === 'activobank' &&
    event.funding_match_status === 'unmatched'
  )
}

function formatFxStatus(row: {
  original_amount: string | null
  original_currency: string | null
  fx_rate_source: string | null
}) {
  if (!row.fx_rate_source) {
    return '-'
  }

  if (row.fx_rate_source === 'pending') {
    return 'Pending'
  }

  if (row.original_amount && row.original_currency) {
    return `${row.fx_rate_source}: ${row.original_amount} ${row.original_currency}`
  }

  return row.fx_rate_source
}

function PreviewTransactionsTable({
  title,
  transactions,
}: {
  title: string
  transactions: ImportPreviewTransaction[]
}) {
  if (transactions.length === 0) {
    return null
  }

  return (
    <section className="import-preview-section">
      <div className="import-preview-section-header">
        <h2>{title}</h2>
        <span>{transactions.length} rows</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Row</th>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Direction</th>
              <th>FX</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, 50).map((transaction) => (
              <tr key={`${transaction.row_number}-${transaction.dedupe_hash}`}>
                <td>{transaction.row_number}</td>
                <td>{transaction.date}</td>
                <td>
                  <div>{transaction.description}</div>
                  <div className="muted small">{transaction.raw_description}</div>
                </td>
                <td>
                  {transaction.category ? (
                    <span className="badge badge-neutral">{transaction.category}</span>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  <span className={`badge badge-direction-${transaction.direction}`}>
                    {transaction.direction}
                  </span>
                </td>
                <td>
                  {transaction.fx_rate_source === 'pending' ? (
                    <span className="badge badge-status-failed">Pending</span>
                  ) : (
                    <span className="muted small">{formatFxStatus(transaction)}</span>
                  )}
                </td>
                <td className="right">
                  {formatMoney(transaction.amount, transaction.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PreviewInvestmentEventsTable({
  title,
  events,
}: {
  title: string
  events: ImportPreviewInvestmentEvent[]
}) {
  if (events.length === 0) {
    return null
  }

  return (
    <section className="import-preview-section">
      <div className="import-preview-section-header">
        <h2>{title}</h2>
        <span>{events.length} rows</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Row</th>
              <th>Date</th>
              <th>Event</th>
              <th>Description</th>
              <th>FX</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 50).map((event) => (
              <tr key={`${event.row_number}-${event.dedupe_hash}`}>
                <td>{event.row_number}</td>
                <td>{event.date}</td>
                <td>
                  <span className="badge badge-neutral">{event.event_type}</span>
                </td>
                <td>
                  <div>{event.description}</div>
                  <div className="muted small">{event.raw_description}</div>
                </td>
                <td>
                  {event.fx_rate_source === 'pending' ? (
                    <span className="badge badge-status-failed">Pending</span>
                  ) : (
                    <span className="muted small">{formatFxStatus(event)}</span>
                  )}
                </td>
                <td className="right">
                  {formatMoney(event.amount, event.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {events.length > 50 && (
        <p className="muted small">Showing first 50 of {events.length} investment events.</p>
      )}
    </section>
  )
}


function InvalidRowsTable({ rows }: { rows: ImportInvalidRow[] }) {
  if (rows.length === 0) {
    return null
  }

  return (
    <section className="import-preview-section import-invalid-section">
      <div className="import-preview-section-header">
        <h2>Invalid rows</h2>
        <span>{rows.length} rows</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Row</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row) => (
              <tr key={`${row.row_number}-${row.error}`}>
                <td>{row.row_number}</td>
                <td>{row.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 50 && (
        <p className="muted small">Showing first 50 of {rows.length} invalid rows.</p>
      )}
    </section>
  )
}


function BatchInvestmentEventsTable({ events }: { events: InvestmentEvent[] }) {
  if (events.length === 0) {
    return null
  }

  return (
    <section className="import-preview-section">
      <div className="import-preview-section-header">
        <h2>Investment events</h2>
        <span>{events.length} rows</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Description</th>
              <th>Instrument</th>
              <th>Funding</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{formatDate(event.date)}</td>
                <td>
                  <span className="badge badge-neutral">{event.event_type}</span>
                </td>
                <td>
                  <div>{event.description}</div>
                  <div className="muted small">{event.raw_description}</div>
                </td>
                <td>
                  {event.instrument_name || event.ticker || event.isin ? (
                    <div>
                      <div>{event.instrument_name || event.ticker || event.isin}</div>
                      <div className="muted small">
                        {[event.ticker, event.isin].filter(Boolean).join(' · ') || '-'}
                      </div>
                    </div>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  {event.funding_match_status ? (
                    <span className="badge badge-neutral">
                      {event.funding_source ?? 'funding'} · {event.funding_match_status}
                    </span>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td className="right">
                  {formatMoney(event.amount, event.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function ImportPage() {
  const [source, setSource] = useState(SOURCES[0])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null)
  const [batchTransactions, setBatchTransactions] = useState<Transaction[]>([])
  const [batchInvestmentEvents, setBatchInvestmentEvents] = useState<InvestmentEvent[]>([])
  const [isBatchesLoading, setIsBatchesLoading] = useState(true)
  const [isLoadingBatchRows, setIsLoadingBatchRows] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [batchRowsError, setBatchRowsError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewInvestmentEvents = preview?.investment_events ?? []
  const newTransactions = preview?.transactions.filter(
    (transaction) => !transaction.is_duplicate,
  ) ?? []
  const duplicateTransactions = preview?.transactions.filter(
    (transaction) => transaction.is_duplicate,
  ) ?? []
  const newInvestmentEvents = previewInvestmentEvents.filter(
    (event) => !event.is_duplicate,
  )
  const duplicateInvestmentEvents = previewInvestmentEvents.filter(
    (event) => event.is_duplicate,
  )
  const rowsToImportCount = newTransactions.length + newInvestmentEvents.length
  const pendingFxTransactionRows = getPendingFxRowNumbers(newTransactions)
  const unresolvedDepositRows = newInvestmentEvents
    .filter(
      (event) =>
        event.fx_rate_source === 'pending' &&
        canRemainUnresolved(event),
    )
    .map((event) => event.row_number)
  const blockingPendingFxEventRows = newInvestmentEvents
    .filter(
      (event) =>
        event.fx_rate_source === 'pending' &&
        !canRemainUnresolved(event),
    )
    .map((event) => event.row_number)
  const hasBlockingPendingFxRows =
    hasPendingFx(newTransactions) ||
    blockingPendingFxEventRows.length > 0
  const hasUnresolvedDeposits = unresolvedDepositRows.length > 0
  const canCommit = Boolean(
    file &&
    preview?.preview_id &&
    rowsToImportCount > 0 &&
    !hasBlockingPendingFxRows &&
    !isCommitting,
  )
  const visibleBatches = batches.filter(
    (batch) => !HIDDEN_BATCH_SOURCES.includes(batch.source),
  )
  const importHistoryTotals = visibleBatches.reduce(
    (totals, batch) => ({
      rowsTotal: totals.rowsTotal + batch.rows_total,
      rowsInserted: totals.rowsInserted + batch.rows_inserted,
      rowsSkipped: totals.rowsSkipped + batch.rows_skipped,
    }),
    { rowsTotal: 0, rowsInserted: 0, rowsSkipped: 0 },
  )

  async function loadBatches() {
    setHistoryError(null)
    setIsBatchesLoading(true)

    try {
      setBatches(await listImportBatches())
    } catch (caughtError: unknown) {
      setHistoryError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to load import history',
      )
    } finally {
      setIsBatchesLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBatches()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  async function handlePreview() {
    if (!file) {
      setError('Choose a file first.')
      return
    }

    setError(null)
    setMessage(null)

    try {
      setPreview(await previewImport(source, file))
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to preview import')
    }
  }

  async function handleCommit() {
    if (isCommitting) {
      return
    }

    if (!file) {
      setError('Choose a file first.')
      return
    }

    if (!preview?.preview_id) {
      setError('Preview the file before committing it.')
      return
    }

    if (rowsToImportCount === 0) {
      setError('There are no new rows to import.')
      return
    }

    if (hasBlockingPendingFxRows) {
      setError('This import has unresolved FX rows. Resolve EUR conversion before committing.')
      return
    }

    setError(null)
    setMessage(null)
    setIsCommitting(true)

    try {
      await commitImport(source, file, preview.preview_id)
      setMessage('Import committed.')
      setPreview(null)
      setSelectedBatch(null)
      setBatchTransactions([])
      setBatchInvestmentEvents([])
      loadBatches()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to commit import')
    } finally {
      setIsCommitting(false)
    }
  }


  async function handleSelectBatch(batch: ImportBatch) {
    setError(null)
    setMessage(null)
    setSelectedBatch(batch)
    setBatchTransactions([])
    setBatchInvestmentEvents([])
    setBatchRowsError(null)
    setIsLoadingBatchRows(true)

    const [transactionsResult, investmentEventsResult] = await Promise.allSettled([
      listImportBatchTransactions(batch.id),
      listImportBatchInvestmentEvents(batch.id),
    ])

    const rowErrors: string[] = []

    if (transactionsResult.status === 'fulfilled') {
      setBatchTransactions(transactionsResult.value)
    } else {
      rowErrors.push('Transaction rows could not be loaded.')
    }

    if (investmentEventsResult.status === 'fulfilled') {
      setBatchInvestmentEvents(investmentEventsResult.value)
    } else {
      rowErrors.push('Investment event rows could not be loaded.')
    }

    if (rowErrors.length > 0) {
      setBatchRowsError(rowErrors.join(' '))
    }

    setIsLoadingBatchRows(false)
  }

  async function handleDeleteBatch(batch: ImportBatch) {
    const confirmed = window.confirm(
      `Rollback import batch ${batch.id}? This will delete ${batch.rows_inserted} imported rows from "${batch.filename}".`,
    )

    if (!confirmed) {
      return
    }

    setError(null)
    setMessage(null)

    try {
      await deleteImportBatch(batch.id)
      setMessage(`Import batch ${batch.id} rolled back.`)

      if (selectedBatch?.id === batch.id) {
        setSelectedBatch(null)
        setBatchTransactions([])
        setBatchInvestmentEvents([])
      }

      loadBatches()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to rollback import batch')
    }
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Import CSV/XLSX</h1>
          <p className="muted small">
            Preview first, check duplicates, then commit only the new rows.
          </p>
        </div>

        <button type="button" onClick={loadBatches}>
          Refresh history
        </button>
      </div>

      <div className="panel-card import-upload-panel">
        <div className="section-header">
          <div>
            <h2>Upload file</h2>
            <p className="muted small">
              Supported sources: Revolut, ActivoBank, and Trading 212.
            </p>
          </div>
        </div>

        <div className="form-row">
          <label>
            Source
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value)
                setPreview(null)
                setMessage(null)
                setError(null)
              }}
            >
              {SOURCES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            File
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setPreview(null)
                setMessage(null)
                setError(null)
              }}
            />
          </label>
        </div>

        {file && (
          <p className="file-help">
            Selected file: <strong>{file.name}</strong>
          </p>
        )}

        <div className="action-group">
          <button
            type="button"
            className="primary-button"
            onClick={handlePreview}
            disabled={isCommitting}
          >
            Preview file
          </button>
        </div>
      </div>

      <StatusMessage error={error} message={message} />


      {preview && (
        <section className="panel-card import-preview-panel">
          <div className="section-header">
            <div>
              <h2>Preview summary</h2>
              <p className="muted small">
                Review the rows below before committing this import.
              </p>
            </div>
          </div>

          <div className="summary-grid import-summary-grid">
            <article className="summary-card">
              <h2>Total rows</h2>
              <strong>{preview.rows_total}</strong>
            </article>
            <article className="summary-card">
              <h2>Valid</h2>
              <strong>{preview.rows_valid}</strong>
            </article>
            <article className="summary-card import-summary-card-primary">
              <h2>Rows to import</h2>
              <strong>{rowsToImportCount}</strong>
            </article>
            <article className="summary-card">
              <h2>Transactions</h2>
              <strong>{newTransactions.length}</strong>
            </article>
            <article className="summary-card">
              <h2>Investment events</h2>
              <strong>{newInvestmentEvents.length}</strong>
            </article>
            <article className="summary-card">
              <h2>Duplicates</h2>
              <strong>{preview.rows_duplicates}</strong>
            </article>
            <article className="summary-card">
              <h2>Invalid</h2>
              <strong>{preview.rows_invalid}</strong>
            </article>
          </div>

          <div className={`import-decision-card ${
            canCommit ? 'import-decision-ready' : 'import-decision-blocked'
          }`}>
            <div>
              <h3>{canCommit ? 'Ready to commit' : 'Review required'}</h3>
              <p>
                {canCommit
                  ? `${rowsToImportCount} new rows can be imported safely.`
                  : 'Commit is disabled until the preview has new rows and no blocking FX issues.'}
              </p>
            </div>
            <strong>{rowsToImportCount}</strong>
          </div>

          {rowsToImportCount === 0 && (
            <p className="status status-error">
              This file has no new rows to import. It may already have been imported.
            </p>
          )}

          {hasBlockingPendingFxRows && (
            <p className="status status-error">
              Historical EUR conversion could not be resolved for every row. Commit is disabled.
              Transaction rows: {pendingFxTransactionRows.join(', ') || 'none'}.
              Investment event rows: {blockingPendingFxEventRows.join(', ') || 'none'}.
            </p>
          )}

          {!hasBlockingPendingFxRows && hasUnresolvedDeposits && (
            <p className="status status-info">
              Trading 212 deposits remain explicitly unresolved until matched to their exact EUR bank transfers.
              Deposit rows: {unresolvedDepositRows.join(', ') || 'none'}.
            </p>
          )}

          <PreviewTransactionsTable
            title="Transactions to import"
            transactions={newTransactions}
          />

          <PreviewInvestmentEventsTable
            title="Investment events to import"
            events={newInvestmentEvents}
          />

          <PreviewTransactionsTable
            title="Duplicate transaction rows"
            transactions={duplicateTransactions}
          />

          <PreviewInvestmentEventsTable
            title="Duplicate investment event rows"
            events={duplicateInvestmentEvents}
          />

          <InvalidRowsTable rows={preview.invalid_rows} />

          <div className="import-commit-panel">
            <div>
              <h2>Commit reviewed import</h2>
              <p className="muted small">
                This will save only the non-duplicate rows shown above.
              </p>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={handleCommit}
              disabled={!canCommit}
            >
              {isCommitting ? 'Committing...' : `Commit ${rowsToImportCount} rows`}
            </button>
          </div>
        </section>
      )}

      <section className="panel-card import-history-panel">
        <div className="section-header import-history-header">
          <div>
            <h2>Import history</h2>
            <p className="muted small">
              Review committed imports, inspect their transactions, or rollback a batch if needed.
            </p>
          </div>
          <button
            type="button"
            onClick={loadBatches}
            disabled={isBatchesLoading}
          >
            {isBatchesLoading ? 'Loading history...' : 'Refresh history'}
          </button>
        </div>

        {historyError && (
          <p className="status status-error" role="alert">
            Import history could not be refreshed: {historyError}
          </p>
        )}

        <div className="summary-grid import-history-summary-grid">
          <article className="summary-card">
            <h2>Batches</h2>
            <strong>{visibleBatches.length}</strong>
          </article>
          <article className="summary-card">
            <h2>Total rows</h2>
            <strong>{importHistoryTotals.rowsTotal}</strong>
          </article>
          <article className="summary-card import-summary-card-primary">
            <h2>Inserted</h2>
            <strong>{importHistoryTotals.rowsInserted}</strong>
          </article>
          <article className="summary-card">
            <h2>Skipped</h2>
            <strong>{importHistoryTotals.rowsSkipped}</strong>
          </article>
        </div>

        <div className="table-wrap import-history-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Source</th>
                <th>File</th>
                <th>Imported</th>
                <th>Total</th>
                <th>Inserted</th>
                <th>Skipped</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isBatchesLoading && visibleBatches.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-state">
                    Loading import history...
                  </td>
                </tr>
              )}

              {!isBatchesLoading && !historyError && visibleBatches.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="import-history-empty">
                      <strong>No import history yet.</strong>
                      <span>Preview and commit a CSV/XLSX file to create the first batch.</span>
                    </div>
                  </td>
                </tr>
              )}

              {visibleBatches.map((batch) => (
                <tr key={batch.id}>
                  <td>#{batch.id}</td>
                  <td>
                    <span className="badge badge-source">{batch.source}</span>
                  </td>
                  <td>
                    <span className="import-history-filename">{batch.filename}</span>
                  </td>
                  <td>{formatDate(batch.imported_at)}</td>
                  <td>{batch.rows_total}</td>
                  <td>{batch.rows_inserted}</td>
                  <td>{batch.rows_skipped}</td>
                  <td>
                    <span className={getStatusBadgeClass(batch.status)}>
                      {batch.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-group import-history-actions">
                      <button type="button" onClick={() => handleSelectBatch(batch)}>
                        {selectedBatch?.id === batch.id ? 'Refresh' : 'View rows'}
                      </button>
                      <button
                        type="button"
                        className="danger-button import-history-rollback-button"
                        onClick={() => handleDeleteBatch(batch)}
                      >
                        Rollback
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedBatch && (
        <section className="review-section">
          <div className="section-header">
            <div>
              <h2>Batch #{selectedBatch.id} rows</h2>
              <p className="muted small">
                {selectedBatch.filename} · {selectedBatch.source} · imported {formatDate(selectedBatch.imported_at)}
              </p>
            </div>
          </div>

          {batchRowsError && (
            <p className="status status-error" role="alert">
              {batchRowsError}
            </p>
          )}

          {isLoadingBatchRows ? (
            <p className="muted" role="status">
              Loading batch rows...
            </p>
          ) : (
            <div className="import-batch-detail-grid">
              <section>
                <div className="section-header">
                  <div>
                    <h2>Transactions</h2>
                    <p className="muted small">{batchTransactions.length} rows</p>
                  </div>
                </div>
                <TransactionTable transactions={batchTransactions} />
              </section>

              <BatchInvestmentEventsTable events={batchInvestmentEvents} />
            </div>
          )}
        </section>
      )}
    </section>
  )
}
