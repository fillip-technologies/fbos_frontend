import { isEmpty } from '@/shared/utils/customFields.js'
// A task's fields come from two places, shown as one form:
//   - its task type (delivery): [{ key, label, type, required, required_on_submit, options, help, show_on_card }]
//   - the company's custom fields for tasks (Identity; read by features/verticals/useFormFields.js)
// Both have the same shape; a key the task type defines wins over a custom field.

export const DISCIPLINES = {
  general: 'General',
  software: 'Software',
  sales: 'Sales',
  creative: 'Creative',
  operations: 'Operations',
}
export const DISCIPLINE_ORDER = Object.keys(DISCIPLINES)
export const disciplineLabel = (code) => DISCIPLINES[code] || (code ? code.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'General')

export const FIELD_TYPES = [
  ['text', 'Text'],
  ['long_text', 'Long text'],
  ['number', 'Number'],
  ['integer', 'Whole number'],
  ['boolean', 'Yes / no'],
  ['date', 'Date'],
  ['datetime', 'Date and time'],
  ['choice', 'Choice list'],
  ['multi_choice', 'Several choices'],
  ['url', 'Web link'],
  ['email', 'Email'],
  ['phone', 'Phone'],
]
export const FIELD_TYPE_LABELS = Object.fromEntries(FIELD_TYPES)
export const ESTIMATION_UNITS = { minutes: 'Hours of effort', points: 'Story points', count: 'Activities (count)' }
export const OUTCOME_KINDS = { success: 'Positive', neutral: 'Neutral', failure: 'Negative' }
export const PRIORITIES = ['p1', 'p2', 'p3', 'p4']

// The task type's fields, then the company's custom ones it doesn't already name.
export function mergeFields(typeFields = [], customFields = []) {
  const taken = new Set(typeFields.map((f) => f.key))
  return [...typeFields, ...customFields.filter((f) => !taken.has(f.key))]
}

// TASK_ATTRIBUTES_INVALID from the backend -> { key: issue } (plus `outcome`).
export function attributeErrors(err) {
  const details = err?.details?.detail?.details
  if (!Array.isArray(details)) return {}
  return Object.fromEntries(details.map((d) => [String(d.field || '').replace(/^attributes\./, ''), d.issue]))
}

// The fields to show on a board card or queue row, with their values.
export function cardFields(taskType, attributes = {}) {
  return (taskType?.fields || []).filter((f) => f.show_on_card && !isEmpty(attributes[f.key]))
}

// ---------- SLA ----------
export const SLA_STATE_LABELS = {
  running: 'On track',
  at_risk: 'At risk',
  breached: 'Breached',
  paused: 'Paused',
  met: 'Met',
  breached_closed: 'Missed',
}
// Badge colours reuse the status palette.
export const SLA_STATE_BADGE = { running: 'in_progress', at_risk: 'amber', breached: 'red', paused: 'on_hold', met: 'done', breached_closed: 'red' }

// "in 3h 20m" / "2h 5m ago" until or since `iso`.
export function relativeTime(iso) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  const abs = Math.abs(minutes)
  const days = Math.floor(abs / 1440)
  const hours = Math.floor((abs % 1440) / 60)
  const mins = abs % 60
  const span = days ? `${days}d ${hours}h` : hours ? `${hours}h ${mins}m` : `${mins}m`
  return minutes >= 0 ? `in ${span}` : `${span} ago`
}

// "15m", "4h", "1d" for an SLA target in minutes.
export function formatTarget(minutes) {
  if (!minutes) return '—'
  if (minutes % 1440 === 0) return `${minutes / 1440}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return minutes > 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}
