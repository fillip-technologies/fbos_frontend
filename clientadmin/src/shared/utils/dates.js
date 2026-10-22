// Dates are plain YYYY-MM-DD strings (backend `date`), handled in local time so the
// value shown in a date input is never shifted by timezone conversion.
export function toIsoDate(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayIso() {
  return toIsoDate(new Date())
}

// Same day next year (29 Feb -> 28 Feb), matching the backend's add_one_year.
export function addOneYear(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const next = new Date(y + 1, m - 1, d)
  if (next.getMonth() !== m - 1) next.setDate(0)
  return toIsoDate(next)
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const STEPS = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [Infinity, 'week'],
]

// ISO timestamp -> "5 minutes ago", "yesterday", …
export function timeAgo(iso) {
  let value = (new Date(iso).getTime() - Date.now()) / 1000
  if (Number.isNaN(value)) return '—'
  if (Math.abs(value) < 45) return 'just now'
  for (const [size, unit] of STEPS) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit)
    value /= size
  }
  return '—'
}
