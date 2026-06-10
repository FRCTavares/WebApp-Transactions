import { useEffect, useState } from 'react'
import { commitImport, listImportBatches, previewImport } from '../api/imports'
import { StatusMessage } from '../components/StatusMessage'
import type {
  ImportBatch,
  ImportInvalidRow,
  ImportPreviewResponse,
  ImportPreviewTransaction,
} from '../types/api'
import { formatDate, formatMoney } from '../utils/format'

const SOURCES = ['revolut', 'activobank', 'trading212']

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
                <td>{transaction.category ?? '-'}</td>
                <td>{transaction.direction}</td>
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
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const newTransactions = preview?.transactions.filter(
    (transaction) => !transaction.is_duplicate,
  ) ?? []
  const duplicateTransactions = preview?.transactions.filter(
    (transaction) => transaction.is_duplicate,
  ) ?? []
  const canCommit = Boolean(file && preview && newTransactions.length > 0)

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
    setPreview(await previewImport(source, file))
  }

  async function handleCommit() {
    if (!file) {
      setError('Choose a file first.')
      return
    }

    if (!preview) {
      setError('Preview the file before committing it.')
      return
    }

    if (newTransactions.length === 0) {
      setError('There are no new rows to import.')
      return
    }

    setError(null)
    setMessage(null)
    await commitImport(source, file)
    setMessage('Import committed.')
    setPreview(null)
    loadBatches()
  }

  return (
    <section>
      <h1>Import CSV/XLSX</h1>

      <div className="form-grid">
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

        <div className="toolbar">
          <button type="button" onClick={handlePreview}>
            Preview
          </button>
          <button type="button" onClick={handleCommit} disabled={!canCommit}>
            Commit
          </button>
        </div>
      </div>

      <StatusMessage error={error} message={message} />

      {preview && (
        <>
          <h2>Preview Summary</h2>
          <div className="cards">
            <div className="card">
              <span>Total rows</span>
              <strong>{preview.rows_total}</strong>
            </div>
            <div className="card">
              <span>Valid</span>
              <strong>{preview.rows_valid}</strong>
            </div>
            <div className="card">
              <span>Rows to import</span>
              <strong>{newTransactions.length}</strong>
            </div>
            <div className="card">
              <span>Duplicates</span>
              <strong>{preview.rows_duplicates}</strong>
            </div>
            <div className="card">
              <span>Invalid</span>
              <strong>{preview.rows_invalid}</strong>
            </div>
          </div>

          {newTransactions.length === 0 && (
            <p className="status status-error">
              This file has no new rows to import. It may already have been imported.
            </p>
          )}

          <PreviewTransactionsTable
            title="Rows To Import"
            transactions={newTransactions}
          />

          <PreviewTransactionsTable
            title="Duplicate Rows"
            transactions={duplicateTransactions}
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
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.id}</td>
                <td>{batch.source}</td>
                <td>{batch.filename}</td>
                <td>{formatDate(batch.imported_at)}</td>
                <td>{batch.rows_total}</td>
                <td>{batch.rows_inserted}</td>
                <td>{batch.rows_skipped}</td>
                <td>{batch.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
