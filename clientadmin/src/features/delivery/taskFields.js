// A task's fields come from two places, shown as one form:
//   - its task type (delivery): [{ key, label, type, required, required_on_submit, options, help, show_on_card }]
//   - the company's custom fields for tasks (identity field definitions, installed by vertical
//     packs): JSON Schemas, { properties: { key: { type, title, enum, format } }, required: [...] }.
// Both become the type's shape here; a key the task type defines wins over a custom field.

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

// The fields of identity's published task.task definitions, in the task type's shape.
export function fieldsFromSchemas(definitions) {
  const fields = new Map()
  for (const definition of definitions ?? []) {
    const schema = definition.json_schema || {}
    const required = new Set(schema.required || [])
    const order = definition.ui_schema?.['ui:order'] || []
    const keys = [...order.filter((k) => k in (schema.properties || {})), ...Object.keys(schema.properties || {}).filter((k) => !order.includes(k))]
    for (const key of keys) {
      if (fields.has(key)) continue
      fields.set(key, { ...fromProperty(key, schema.properties[key]), required: required.has(key), custom: true })
    }
  }
  return [...fields.values()]
}

function fromProperty(key, prop = {}) {
  const base = { key, label: prop.title || key, help: prop.description, options: [] }
  if (Array.isArray(prop.enum)) return { ...base, type: 'choice', options: prop.enum.map(String) }
  if (prop.type === 'string' && prop.format === 'date') return { ...base, type: 'date' }
  if (prop.type === 'string' && prop.format === 'date-time') return { ...base, type: 'datetime' }
  if (prop.type === 'string' && prop.format === 'uri') return { ...base, type: 'url' }
  if (prop.type === 'string' && prop.format === 'email') return { ...base, type: 'email' }
  if (prop.type === 'number' || prop.type === 'integer' || prop.type === 'boolean') return { ...base, type: prop.type }
  return { ...base, type: 'text' }
}

// The task type's fields, then the company's custom ones it doesn't already name.
export function mergeFields(typeFields = [], customFields = []) {
  const taken = new Set(typeFields.map((f) => f.key))
  return [...typeFields, ...customFields.filter((f) => !taken.has(f.key))]
}

export const isEmpty = (value) => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)

// A stored value as words.
export function formatFieldValue(field, value) {
  if (isEmpty(value)) return '—'
  if (field?.type === 'boolean') return value ? 'Yes' : 'No'
  if (field?.type === 'multi_choice' && Array.isArray(value)) return value.join(', ')
  if (field?.type === 'datetime') return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  if (field?.type === 'date') return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Form state (strings, booleans, arrays) -> the attribute values to send. Numbers become numbers.
export function toAttributes(fields, values) {
  const out = {}
  for (const field of fields) {
    const value = values[field.key]
    if (isEmpty(value)) continue
    if (field.type === 'number' || field.type === 'integer') out[field.key] = Number(value)
    else if (field.type === 'datetime') out[field.key] = new Date(value).toISOString()
    else out[field.key] = value
  }
  return out
}

// Stored attributes -> form state (datetime-local wants local "YYYY-MM-DDTHH:mm").
export function toFormValues(fields, attributes = {}) {
  const values = {}
  for (const field of fields) {
    const value = attributes[field.key]
    if (isEmpty(value)) continue
    if (field.type === 'datetime') {
      const d = new Date(value)
      values[field.key] = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    } else if (field.type === 'number' || field.type === 'integer') values[field.key] = String(value)
    else values[field.key] = value
  }
  return values
}

const URL_RE = /^https?:\/\/\S+$/i
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE_RE = /^\+?[0-9 ()./-]{5,30}$/

// Problems the backend would also refuse, caught before sending: { key: issue }.
// `stage` 'create' checks fields required to create the task, 'submit' those needed to submit it.
export function checkFields(fields, values, stage = 'create') {
  const problems = {}
  for (const field of fields) {
    const value = values[field.key]
    const needed = stage === 'submit' ? field.required || field.required_on_submit : field.required
    if (isEmpty(value)) {
      if (needed && field.type !== 'boolean') problems[field.key] = `${field.label} is required.`
      if (needed && field.type === 'boolean' && stage === 'submit' && field.required_on_submit) problems[field.key] = `Confirm “${field.label}”.`
      continue
    }
    if (field.type === 'url' && !URL_RE.test(value)) problems[field.key] = 'Start the link with http:// or https://.'
    if (field.type === 'email' && !EMAIL_RE.test(value)) problems[field.key] = 'Enter an email address.'
    if (field.type === 'phone' && !PHONE_RE.test(value)) problems[field.key] = 'Enter a phone number.'
    if (field.type === 'integer' && !Number.isInteger(Number(value))) problems[field.key] = 'Enter a whole number.'
    if (field.type === 'number' && Number.isNaN(Number(value))) problems[field.key] = 'Enter a number.'
  }
  return problems
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
