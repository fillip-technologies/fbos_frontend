const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Fiscal year start is stored as DD-MM ("01-04" = 1 April).
export const FISCAL_YEAR_PATTERN = '^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])$'
export const DEFAULT_FISCAL_YEAR_START = '01-04'

export function formatFiscalYearStart(value) {
  const m = /^(\d{2})-(\d{2})$/.exec(value || '')
  if (!m) return value || '—'
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${Number(m[1])} ${month}` : value
}

// YYYY-MM-DD -> "31 Mar 2027" (parsed as local date so there is no timezone shift).
export function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function daysUntil(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const end = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((end - today) / 86400000)
}
