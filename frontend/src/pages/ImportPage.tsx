import { useEffect, useState } from 'react'
import {
  commitImport,
  deleteImportBatch,
  listImportBatches,
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
  Transaction,
} from '../types/api'
import { formatDate, formatMoney } from '../utils/format'

const SOURCES = ['revolut', 'activobank', 'trading212']

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
    <>
      <h2>{title}</h2>
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

      {transactions.length > 50 && (
        <p className="muted small">Showing first 50 of {transactions.length} rows.</p>
      )}
    </>
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
    <>
      <h2>{title}</h2>
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
    </>
  )
}

function InvalidRowsTable({ rows }: { rows: ImportInvalidRow[] }) {
  if (rows.length === 0) {
    return null
  }

  return (
    <>
      <h2>Invalid Rows</h2>
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
    </>
  )
}

export function ImportPage() {
  const [source, setSource] = useState(SOURCES[0])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null)
  const [batchTransactions, setBatchTransactions] = useState<Transaction[]>([])
  const [isLoadingBatchTransactions, setIsLoadingBatchTransactions] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
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
  const pendingFxEventRows = getPendingFxRowNumbers(newInvestmentEvents)
  const hasPendingFxRows =
    hasPendingFx(newTransactions) || hasPendingFx(newInvestmentEvents)
  const canCommit = Boolean(
    file &&
    preview &&
    rowsToImportCount > 0 &&
    !hasPendingFxRows &&
    !isCommitting,
  )

  function loadBatches() {
    listImportBatches().then(setBatches).catch(() => undefined)
  }

  useEffect(() => {
    loadBatches()
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

    if (!preview) {
      setError('Preview the file before committing it.')
      return
    }

    if (rowsToImportCount === 0) {
      setError('There are no new rows to import.')
      return
    }

    if (hasPendingFxRows) {
      setError('This import has pending FX conversion. Resolve EUR conversion before committing.')
      return
    }

    setError(null)
    setMessage(null)
    setIsCommitting(true)

    try {
      await commitImport(source, file)
      setMessage('Import committed.')
      setPreview(null)
      setSelectedBatch(null)
      setBatchTransactions([])
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
    setIsLoadingBatchTransactions(true)

    try {
      setBatchTransactions(await listImportBatchTransactions(batch.id))
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to load batch transactions')
    } finally {
      setIsLoadingBatchTransactions(false)
    }
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
          Refresh Batches
        </button>
      </div>

      <div className="panel-card">
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
            <select value={source} onChange={(event) => setSource(event.target.value)}>
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
          <button type="button" onClick={handlePreview} disabled={isCommitting}>
            Preview
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleCommit}
            disabled={!canCommit}
          >
            {isCommitting ? 'Committing...' : 'Commit Import'}
          </button>
        </div>
      </div>

      <StatusMessage error={error} message={message} />

      {preview && (
        <>
          <h2>Preview Summary</h2>
          <div className="summary-grid">
            <article className="summary-card">
              <h2>Total rows</h2>
              <strong>{preview.rows_total}</strong>
            </article>
            <article className="summary-card">
              <h2>Valid</h2>
              <strong>{preview.rows_valid}</strong>
            </article>
            <article className="summary-card">
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

          {rowsToImportCount === 0 && (
            <p className="status status-error">
              This file has no new rows to import. It may already have been imported.
            </p>
          )}

          {hasPendingFxRows && (
            <p className="status status-error">
              This import has pending FX conversion. Commit is disabled until EUR conversion is resolved.
              Transaction rows: {pendingFxTransactionRows.join(', ') || 'none'}.
              Investment event rows: {pendingFxEventRows.join(', ') || 'none'}.
            </p>
          )}

          <PreviewTransactionsTable
            title="Transactions To Import"
            transactions={newTransactions}
          />

          <PreviewInvestmentEventsTable
            title="Investment Events To Import"
            events={newInvestmentEvents}
          />

          <PreviewTransactionsTable
            title="Duplicate Transaction Rows"
            transactions={duplicateTransactions}
          />

          <PreviewInvestmentEventsTable
            title="Duplicate Investment Event Rows"
            events={duplicateInvestmentEvents}
          />

          <InvalidRowsTable rows={preview.invalid_rows} />
        </>
      )}

      <h2>Import Batches</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Source</th>
              <th>Filename</th>
              <th>Imported</th>
              <th>Total</th>
              <th>Inserted</th>
              <th>Skipped</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <p className="muted">No import batches yet.</p>
                </td>
              </tr>
            )}

            {batches.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.id}</td>
                <td>
                  <span className="badge badge-source">{batch.source}</span>
                </td>
                <td>{batch.filename}</td>
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
                  <div className="action-group">
                    <button type="button" onClick={() => handleSelectBatch(batch)}>
                      {selectedBatch?.id === batch.id ? 'Refresh' : 'View'}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
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

      {selectedBatch && (
        <section className="review-section">
          <div className="section-header">
            <div>
              <h2>Batch {selectedBatch.id} Transactions</h2>
              <p className="muted small">
                {selectedBatch.filename} · {selectedBatch.source} · imported {formatDate(selectedBatch.imported_at)}
              </p>
            </div>
          </div>

          {isLoadingBatchTransactions ? (
            <p className="muted">Loading batch transactions...</p>
          ) : (
            <TransactionTable transactions={batchTransactions} />
          )}
        </section>
      )}
    </section>
  )
}
