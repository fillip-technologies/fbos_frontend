// Custom fields are stored as a JSON Schema object: each property is one field.
//   { type: 'object', properties: { tier: { type: 'string', title: 'Tier', enum: [...] } }, required: ['tier'] }
// The builder edits a flat list of fields and converts to/from that shape.

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Whole number' },
  { value: 'boolean', label: 'Yes / no' },
  { value: 'date', label: 'Date' },
  { value: 'choice', label: 'Choice list' },
]

const typeLabel = (value) => FIELD_TYPES.find((t) => t.value === value)?.label || value

export const KEY_PATTERN = /^[a-z][a-z0-9_]*$/

// "Contract tier" -> "contract_tier"
export const keyFromLabel = (label) =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+|_+$/g, '').slice(0, 64)

function propertyFor(field) {
  const prop = { title: field.label.trim() }
  if (field.type === 'text') prop.type = 'string'
  if (field.type === 'number' || field.type === 'integer' || field.type === 'boolean') prop.type = field.type
  if (field.type === 'date') Object.assign(prop, { type: 'string', format: 'date' })
  if (field.type === 'choice') Object.assign(prop, { type: 'string', enum: splitOptions(field.options) })
  return prop
}

export const splitOptions = (text) => [...new Set(text.split(',').map((o) => o.trim()).filter(Boolean))]

export function buildSchema(fields) {
  const required = fields.filter((f) => f.required).map((f) => f.key)
  const schema = {
    type: 'object',
    properties: Object.fromEntries(fields.map((f) => [f.key, propertyFor(f)])),
  }
  if (required.length) schema.required = required
  return { json_schema: schema, ui_schema: { 'ui:order': fields.map((f) => f.key) } }
}

// Problems with one field row given every row, or null.
export function fieldError(field, fields) {
  if (!field.label.trim()) return 'Enter a label.'
  if (!KEY_PATTERN.test(field.key)) return 'The key must start with a letter and use only a–z, 0–9 and _.'
  if (fields.filter((f) => f.key === field.key).length > 1) return 'Two fields use this key.'
  if (field.type === 'choice' && splitOptions(field.options).length < 2) return 'A choice list needs at least two options.'
  return null
}

function describeProperty(prop) {
  if (prop.enum) return `Choice: ${prop.enum.join(', ')}`
  if (prop.format === 'date') return typeLabel('date')
  if (prop.type === 'string') return typeLabel('text')
  return typeLabel(prop.type) || 'Any'
}

// The fields of a stored schema in display order: [{ key, title, description, required }].
// Works on any schema, including ones not made with this builder.
export function describeSchema(jsonSchema, uiSchema) {
  const props = jsonSchema?.properties || {}
  const required = new Set(jsonSchema?.required || [])
  const order = (uiSchema?.['ui:order'] || []).filter((k) => k in props)
  const keys = [...order, ...Object.keys(props).filter((k) => !order.includes(k))]
  return keys.map((key) => ({
    key,
    title: props[key]?.title || key,
    description: describeProperty(props[key] || {}),
    required: required.has(key),
  }))
}

// ---------- Vertical pack sections ----------
// A pack version stores sections in the builder's own shape:
//   { type: 'custom_fields', object_type, fields: [{ key, label, type, required, options: [] }] }
// The editor keeps choice options as one comma-separated string per row.

export const toEditorRows = (fields, makeRow) =>
  fields.map((f) => ({ ...makeRow(), key: f.key, keyEdited: true, label: f.label, type: f.type, required: !!f.required, options: (f.options || []).join(', ') }))

export const toPackFields = (rows) =>
  rows.map((r) => ({
    key: r.key,
    label: r.label.trim(),
    type: r.type,
    required: r.required,
    options: r.type === 'choice' ? splitOptions(r.options) : [],
  }))

const packTypeLabel = (field) => (field.type === 'choice' ? `Choice: ${field.options.join(', ')}` : typeLabel(field.type))
export const describePackField = (field) => ({ key: field.key, title: field.label, description: packTypeLabel(field), required: field.required })

// How installing a version affects one record type (preview and install results).
export const PLAN_ACTIONS = {
  create: { label: 'New fields', badge: 'active' },
  update: { label: 'Fields change', badge: 'upcoming' },
  unchanged: { label: 'No change', badge: 'inactive' },
  retire: { label: 'Fields retired', badge: 'expired' },
}
