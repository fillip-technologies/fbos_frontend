import { useMemo } from 'react'

/**
 * Resolves the display type from a JSON schema property definition and optional UI schema.
 */
function resolveFieldType(prop = {}, ui = {}) {
  if (ui?.['ui:widget'] === 'textarea') return 'long_text'
  if (Array.isArray(prop.enum)) return 'choice'
  if (prop.type === 'boolean') return 'boolean'
  if (prop.type === 'integer') return 'integer'
  if (prop.type === 'number') return 'number'
  if (prop.type === 'string') {
    if (prop.format === 'date') return 'date'
    if (prop.format === 'date-time') return 'datetime'
    if (prop.format === 'uri') return 'url'
    if (prop.format === 'email') return 'email'
  }
  return 'text'
}

/**
 * Extracts normalized field definitions from a JSON Schema and UI Schema.
 */
export function parseSchemaFields(schema, uiSchema = {}) {
  if (!schema || !schema.properties) return []
  const required = new Set(schema.required || [])
  const order = uiSchema?.['ui:order'] || []
  const propKeys = Object.keys(schema.properties)
  const sortedKeys = [
    ...order.filter((k) => k in schema.properties),
    ...propKeys.filter((k) => !order.includes(k)),
  ]

  return sortedKeys.map((key) => {
    const prop = schema.properties[key] || {}
    const ui = uiSchema?.[key] || {}
    return {
      key,
      label: ui?.['ui:title'] || prop.title || key,
      help: ui?.['ui:help'] || ui?.['ui:description'] || prop.description,
      placeholder: ui?.['ui:placeholder'] || prop.placeholder,
      required: required.has(key),
      type: resolveFieldType(prop, ui),
      options: Array.isArray(prop.enum) ? prop.enum.map(String) : [],
    }
  })
}

/**
 * Extracts combined normalized fields from a list of FieldDefinition response objects.
 */
export function parseDefinitionsFields(definitions) {
  if (!definitions || !definitions.length) return []
  const fields = new Map()
  for (const def of definitions) {
    const parsed = parseSchemaFields(def.json_schema, def.ui_schema)
    for (const field of parsed) {
      if (!fields.has(field.key)) {
        fields.set(field.key, field)
      }
    }
  }
  return [...fields.values()]
}

/**
 * Coerce form values to JSON Schema types (numbers to Number, etc.) for API payload.
 */
export function cleanCustomFieldValues(fields, values = {}) {
  const result = {}
  for (const field of fields) {
    const raw = values[field.key]
    if (raw === undefined || raw === null || raw === '') continue
    if (field.type === 'integer') {
      const parsed = parseInt(raw, 10)
      if (!Number.isNaN(parsed)) result[field.key] = parsed
    } else if (field.type === 'number') {
      const parsed = parseFloat(raw)
      if (!Number.isNaN(parsed)) result[field.key] = parsed
    } else if (field.type === 'boolean') {
      result[field.key] = Boolean(raw)
    } else {
      result[field.key] = raw
    }
  }
  return result
}

const INPUT_TYPES = {
  url: 'url',
  email: 'email',
  date: 'date',
  datetime: 'datetime-local',
  number: 'number',
  integer: 'number',
}

const PLACEHOLDERS = {
  url: 'https://...',
  email: 'name@example.com',
}

/**
 * Dynamic Custom Fields form component.
 * Supports rendering either from raw JSON Schema + UI Schema or from a list of FieldDefinition objects.
 */
export default function DynamicCustomFields({
  schema,
  uiSchema,
  definitions,
  values = {},
  onChange,
  errors = {},
  idPrefix = 'cf',
  disabled = false,
  title,
  className = '',
}) {
  const fields = useMemo(() => {
    if (definitions && definitions.length > 0) {
      return parseDefinitionsFields(definitions)
    }
    if (schema && schema.properties) {
      return parseSchemaFields(schema, uiSchema)
    }
    return []
  }, [schema, uiSchema, definitions])

  if (!fields.length) return null

  const handleFieldChange = (key, val) => {
    if (onChange) {
      onChange({ ...values, [key]: val })
    }
  }

  return (
    <div className={`dynamic-custom-fields ${className}`}>
      {title && <h3 style={{ fontSize: 14, fontWeight: 700, margin: '16px 0 10px', color: '#334155' }}>{title}</h3>}
      <div className="grid-2">
        {fields.map((field) => {
          const id = `${idPrefix}_${field.key}`
          const isWide = field.type === 'long_text'
          const val = values[field.key]
          const fieldError = errors[field.key]

          return (
            <div
              key={field.key}
              className={`field${isWide ? ' span-all' : ''}`}
              style={isWide ? { gridColumn: '1 / -1' } : undefined}
            >
              {field.type === 'boolean' ? (
                <label className="inline-check" htmlFor={id} style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>
                  <input
                    id={id}
                    type="checkbox"
                    disabled={disabled}
                    checked={Boolean(val)}
                    onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                  />
                  {field.label}
                  {field.required && ' *'}
                </label>
              ) : (
                <>
                  <label htmlFor={id}>
                    {field.label}
                    {field.required && ' *'}
                  </label>
                  {field.type === 'long_text' ? (
                    <textarea
                      id={id}
                      rows={3}
                      disabled={disabled}
                      className={fieldError ? 'invalid' : ''}
                      placeholder={field.placeholder}
                      value={val ?? ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    />
                  ) : field.type === 'choice' ? (
                    <select
                      id={id}
                      disabled={disabled}
                      className={fieldError ? 'invalid' : ''}
                      value={val ?? ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    >
                      <option value="">— Choose —</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={id}
                      type={INPUT_TYPES[field.type] || 'text'}
                      disabled={disabled}
                      className={fieldError ? 'invalid' : ''}
                      step={field.type === 'integer' ? '1' : field.type === 'number' ? 'any' : undefined}
                      placeholder={field.placeholder || PLACEHOLDERS[field.type]}
                      value={val ?? ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    />
                  )}
                </>
              )}
              {field.help && <div className="hint">{field.help}</div>}
              {fieldError && <div className="field-error">{fieldError}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
