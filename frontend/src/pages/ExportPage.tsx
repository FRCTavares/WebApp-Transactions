import { useState } from 'react'
import { getPersonalDataExport } from '../api/exportData'
import { StatusMessage } from '../components/StatusMessage'
import { Button, PageHeader } from '../components/ui'

function getTimestampForFilename() {
  return new Date()
    .toISOString()
    .replaceAll(':', '-')
    .replaceAll('.', '-')
}

function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = filename
  link.click()

  URL.revokeObjectURL(objectUrl)
}

function getTableCount(tables: Record<string, unknown[]>) {
  return Object.values(tables).reduce((total, rows) => total + rows.length, 0)
}

export function ExportPage() {
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDownloadExport() {
    setIsExporting(true)
    setMessage(null)
    setError(null)

    try {
      const data = await getPersonalDataExport()
      const timestamp = getTimestampForFilename()
      const filename = `f-transactions-export-${timestamp}.json`

      downloadJsonFile(data, filename)
      setMessage(`Export downloaded. ${getTableCount(data.tables)} rows included.`)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to export data.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="Export / Backup"
        description="Download a JSON backup of your personal data from the production database."
      />

      <StatusMessage error={error} message={message} />

      <section className="panel-card">
        <div className="section-header">
          <div>
            <h2>Personal data export</h2>
            <p className="muted small">
              Includes transactions, owed items, wealth data, investment events, import batches, and rules.
              Market price cache data is intentionally excluded.
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            loading={isExporting}
            onClick={handleDownloadExport}
            disabled={isExporting}
          >
            {isExporting ? 'Preparing export…' : 'Download JSON export'}
          </Button>
        </div>

        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <td>
                  <strong>Format</strong>
                </td>
                <td>JSON</td>
              </tr>
              <tr>
                <td>
                  <strong>Scope</strong>
                </td>
                <td>Your authenticated user data only</td>
              </tr>
              <tr>
                <td>
                  <strong>Use</strong>
                </td>
                <td>Manual backup, inspection, or future restore/import tooling</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
