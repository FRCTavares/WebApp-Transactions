export function formatFxStatus(row: {
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
