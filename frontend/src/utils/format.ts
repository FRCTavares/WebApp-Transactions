export function formatMoney(value: string | number, currency = 'EUR') {
  const numberValue = typeof value === 'string' ? Number(value) : value

  if (Number.isNaN(numberValue)) {
    return String(value)
  }

  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
  }).format(numberValue)
}

export function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return value.slice(0, 10)
}
