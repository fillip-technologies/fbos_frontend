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
