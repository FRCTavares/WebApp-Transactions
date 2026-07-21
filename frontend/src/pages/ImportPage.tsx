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
import {
  BatchInvestmentEventsTable,
  InvalidRowsTable,
  PreviewInvestmentEventsTable,
  PreviewTransactionsTable,
} from '../components/import/ImportPreviewTables'
import type {
  ImportBatch,
  ImportPreviewInvestmentEvent,
  ImportPreviewResponse,
  InvestmentEvent,
  Transaction,
} from '../types/api'
import { formatDate } from '../utils/format'
import { Badge, Button, PageHeader } from '../components/ui'
import type { BadgeTone } from '../components/ui'
import { formatSource, toSentenceCase } from '../utils/badgeLabels'

const SOURCES = ['revolut', 'activobank', 'trading212']
const HIDDEN_BATCH_SOURCES = ['legacy_excel', 'legacy_excel_wealth']

const SOURCE_UPLOAD_HELP: Record<string, { accept: string; description: string }> = {
  revolut: { accept: '.csv', description: 'Revolut CSV, maximum 5 MB' },
  activobank: { accept: '.xlsx', description: 'ActivoBank XLSX, maximum 10 MB' },
  trading212: { accept: '.csv', description: 'Trading 212 CSV, maximum 5 MB' },
}

/* Tones mirror the groupings `panels-import.css` already encoded: committed,
   completed and imported were green; rolled back, deleted and failed were red.
   `success` is the only value the backend actually writes (the ImportBatch
   model default); the rest are kept because the CSS anticipated them. It was
   missing from the green group, so every successful import rendered a neutral
   grey badge. */
const BATCH_STATUS_TONE: Record<string, BadgeTone> = {
  success: 'positive',
  committed: 'positive',
  completed: 'positive',
  imported: 'positive',
  rolled_back: 'negative',
  deleted: 'negative',
  failed: 'negative',
  pending: 'warning',
}

function getBatchStatusTone(status: string): BadgeTone {
  return BATCH_STATUS_TONE[status] ?? 'neutral'
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
  const [isCommitConfirmed, setIsCommitConfirmed] = useState(false)
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
    isCommitConfirmed &&
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
    setIsCommitConfirmed(false)

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

    if (!isCommitConfirmed) {
      setError('Confirm that you reviewed the exact preview before committing.')
      return
    }

    setError(null)
    setMessage(null)
    setIsCommitting(true)

    try {
      await commitImport(source, file, preview.preview_id)
      setMessage('Import committed.')
      setPreview(null)
      setIsCommitConfirmed(false)
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
      <PageHeader
        title="Import CSV/XLSX"
        description="Preview first, check duplicates, then commit only the new rows."
        actions={(
          <Button type="button" size="sm" onClick={loadBatches}>
            Refresh history
          </Button>
        )}
      />

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
                setIsCommitConfirmed(false)
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
              accept={SOURCE_UPLOAD_HELP[source].accept}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setPreview(null)
                setIsCommitConfirmed(false)
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
        <p className="muted small">
          Accepted file: {SOURCE_UPLOAD_HELP[source].description}. Files are validated before preview.
        </p>

        <div className="action-group">
          <Button
            type="button"
            variant="primary"
            onClick={handlePreview}
            disabled={isCommitting}
          >
            Preview file
          </Button>
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
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isCommitConfirmed}
                onChange={(event) => setIsCommitConfirmed(event.target.checked)}
              />
              I reviewed this exact preview and understand that {rowsToImportCount} new rows will be saved.
            </label>
            <Button
              type="button"
              variant="primary"
              loading={isCommitting}
              onClick={handleCommit}
              disabled={!canCommit}
            >
              {isCommitting ? 'Committing…' : `Commit ${rowsToImportCount} rows`}
            </Button>
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
          <Button
            type="button"
            size="sm"
            loading={isBatchesLoading}
            onClick={loadBatches}
            disabled={isBatchesLoading}
          >
            {isBatchesLoading ? 'Loading history…' : 'Refresh history'}
          </Button>
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
                    <Badge>{formatSource(batch.source)}</Badge>
                  </td>
                  <td>
                    <span className="import-history-filename">{batch.filename}</span>
                  </td>
                  <td>{formatDate(batch.imported_at)}</td>
                  <td>{batch.rows_total}</td>
                  <td>{batch.rows_inserted}</td>
                  <td>{batch.rows_skipped}</td>
                  <td>
                    <Badge tone={getBatchStatusTone(batch.status)}>
                      {toSentenceCase(batch.status)}
                    </Badge>
                  </td>
                  <td>
                    <div className="action-group import-history-actions">
                      <Button type="button" size="sm" onClick={() => handleSelectBatch(batch)}>
                        {selectedBatch?.id === batch.id ? 'Refresh' : 'View rows'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        className="import-history-rollback-button"
                        onClick={() => handleDeleteBatch(batch)}
                      >
                        Rollback
                      </Button>
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
