// Custom fields: the extra fields a company adds to a form (one kind of record: leads,
// projects, tasks…). Identity keeps them; features/verticals edits a form's fields as one
// list, and record forms show them. This is the shared part: the field types, reading what
// Identity stores, and the "show only when" rule.

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Whole number' },
  { value: 'boolean', label: 'Yes / no' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date and time' },
  { value: 'choice', label: 'Choice list' },
  { value: 'multi_choice', label: 'Several choices' },
  { value: 'url', label: 'Web link' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
]
export const CHOICE_TYPES = ['choice', 'multi_choice']
export const fieldTypeLabel = (type) => FIELD_TYPES.find((t) => t.value === type)?.label || type

export const KEY_PATTERN = /^[a-z][a-z0-9_]*$/

// "Contract tier" -> "contract_tier"
export const keyFromLabel = (label) =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+|_+$/g, '').slice(0, 64)

// Whether a field shows for the values on screen: a field with a rule shows only while the
// input it watches holds one of the rule's values.
export function isShown(field, values) {
  const rule = field.show_when
  if (!rule) return true
  const current = values?.[rule.input]
  return current !== undefined && current !== null && rule.values.includes(String(current))
}

// ---------- Reading what Identity stores ----------
// A form's fields are stored as published lists (JSON Schema): one for every vertical and one
// per vertical a field is limited to. Identity answers the lists that apply to a record; they
// read back as one list of { key, label, type, required, options, help, show_when }, in the
// form's order. Identity's GET /field-definitions/forms/{form} reads them the same way.

export function fieldsFromDefinitions(definitions = []) {
  // The list for every vertical first, then the newest; a key met again is a repeat.
  const ordered = [...definitions].sort(
    (a, b) => Number(Boolean(a.vertical_id)) - Number(Boolean(b.vertical_id)) || b.version_no - a.version_no
  )
  const fields = new Map()
  for (const definition of ordered) {
    for (const field of fieldsOf(definition)) {
      if (!fields.has(field.key)) fields.set(field.key, field)
    }
  }
  // A save gives every list the whole form's order.
  const order = ordered[0]?.ui_schema?.['ui:order'] || []
  const position = (key) => (order.includes(key) ? order.indexOf(key) : order.length)
  return [...fields.values()].sort((a, b) => position(a.key) - position(b.key))
}

function fieldsOf(definition) {
  const schema = definition.json_schema || {}
  const properties = schema.properties || {}
  const required = new Set(schema.required || [])
  const ui = definition.ui_schema || {}
  const listed = (ui['ui:order'] || []).filter((key) => key in properties)
  const keys = [...listed, ...Object.keys(properties).filter((key) => !listed.includes(key))]
  return keys.map((key) => fieldFrom(key, properties[key] || {}, ui[key] || {}, required.has(key)))
}

function fieldFrom(key, prop, uiOptions, required) {
  const type = typeOf(prop, uiOptions)
  const rule = uiOptions['ui:show_when']
  return {
    key,
    label: prop.title || key,
    type,
    required,
    options: optionsOf(prop, type),
    help: prop.description || '',
    show_when: rule?.input && rule.values?.length ? { input: rule.input, values: rule.values.map(String) } : null,
  }
}

const TYPES_BY_FORMAT = { date: 'date', 'date-time': 'datetime', uri: 'url', email: 'email', phone: 'phone' }

function typeOf(prop, uiOptions) {
  if (prop.type === 'array') return Array.isArray(prop.items?.enum) ? 'multi_choice' : 'text'
  if (Array.isArray(prop.enum)) return 'choice'
  if (['number', 'integer', 'boolean'].includes(prop.type)) return prop.type
  if (uiOptions['ui:widget'] === 'textarea') return 'long_text'
  return TYPES_BY_FORMAT[prop.format] || 'text'
}

function optionsOf(prop, type) {
  if (type === 'choice') return prop.enum.map(String)
  if (type === 'multi_choice') return prop.items.enum.map(String)
  return []
}

// ---------- Values ----------
// Form state holds strings, booleans and arrays; a record stores them in its `attributes`.

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

// Problems the backend would also refuse, caught before sending: { key: issue }. `stage`
// 'create' checks the fields required to save; 'submit' also a task's fields needed to submit it.
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

// What an edit sends to a record that merges the attributes it gets into the ones it keeps
// (leads, projects, tasks): the values that changed, with null for one that was emptied.
export function changedAttributes(fields, values, stored = {}) {
  const next = toAttributes(fields, values)
  const changes = {}
  for (const field of fields) {
    const before = stored?.[field.key]
    const after = next[field.key]
    if (after === undefined) {
      if (!isEmpty(before)) changes[field.key] = null
    } else if (JSON.stringify(after) !== JSON.stringify(before)) {
      changes[field.key] = after
    }
  }
  return changes
}

// What a save sends to a record that replaces all its attributes each time (client services):
// the stored ones, with the form's fields taken from `values` (an emptied one is left out).
export function replacedAttributes(fields, values, stored = {}) {
  const shown = new Set(fields.map((field) => field.key))
  const kept = Object.fromEntries(Object.entries(stored || {}).filter(([key]) => !shown.has(key)))
  return { ...kept, ...toAttributes(fields, values) }
}
