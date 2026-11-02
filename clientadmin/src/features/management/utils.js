// Words and numbers for the management pages.

export const RAG_LABELS = { green: 'On track', amber: 'At risk', red: 'Off track' }
export const BAND_LABELS = { confident: 'Confident', at_risk: 'At risk', change_approach: 'Change approach' }
export const BUDGET_STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
}
export const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }

// The API counts capacity in minutes; people read hours.
export function hours(minutes) {
  if (minutes === null || minutes === undefined) return '—'
  const h = minutes / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`
}

export function percent(value) {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(1)}%`
}

export function money(value, currency) {
  if (value === null || value === undefined) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  } catch {
    return `${currency || ''} ${Number(value).toFixed(2)}`.trim()
  }
}

export const personName = (ref) => ref?.name || 'Unknown'

// The first and last day of the current month, as the capacity pages' default window.
export function thisMonth(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
}
