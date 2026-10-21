import { CHOICE_TYPES, KEY_PATTERN } from '@/shared/utils/customFields.js'
import { VERTICAL_INPUT } from '@/features/verticals/forms.js'

// The field editor's rows. A row keeps a choice list's options as one comma-separated
// string, and its rule as the input it watches ('' = always shown) plus the values ticked.

let nextRowKey = 1
export const blankRow = () => ({
  rowKey: nextRowKey++,
  label: '',
  key: '',
  keyEdited: false,
  type: 'text',
  options: '',
  required: false,
  help: '',
  ruleInput: '',
  ruleValues: [],
})

export const splitOptions = (text) => [...new Set(text.split(',').map((o) => o.trim()).filter(Boolean))]

// A field as Identity answers it -> an editor row.
export const toRow = (field) => {
  const byVertical = field.vertical_ids.length > 0
  return {
    ...blankRow(),
    key: field.key,
    keyEdited: true,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options.join(', '),
    help: field.help || '',
    ruleInput: byVertical ? VERTICAL_INPUT : field.show_when?.input || '',
    ruleValues: byVertical ? field.vertical_ids : field.show_when?.values || [],
  }
}

// An editor row -> the field to save.
export const toField = (row) => {
  const byVertical = row.ruleInput === VERTICAL_INPUT
  return {
    key: row.key,
    label: row.label.trim(),
    type: row.type,
    required: row.required,
    options: CHOICE_TYPES.includes(row.type) ? splitOptions(row.options) : [],
    help: row.help.trim() || null,
    vertical_ids: byVertical ? row.ruleValues : [],
    show_when: row.ruleInput && !byVertical ? { input: row.ruleInput, values: row.ruleValues } : null,
  }
}

// What's wrong with one row given every row, or null. Identity checks the same, plus the
// keys a form's records already use for something else.
export function rowError(row, rows) {
  if (!row.label.trim()) return 'Enter a label.'
  if (!KEY_PATTERN.test(row.key)) return 'The key must start with a letter and use only a–z, 0–9 and _.'
  if (rows.filter((r) => r.key === row.key).length > 1) return 'Two fields use this key.'
  if (CHOICE_TYPES.includes(row.type) && splitOptions(row.options).length < 2) return 'A choice list needs at least two options.'
  if (row.ruleInput && !row.ruleValues.length) return 'Tick at least one value under "Show", or show the field always.'
  return null
}

// Distinct field keys per form among the live lists: { [object_type]: count }.
export function fieldCounts(definitions) {
  const keys = {}
  for (const definition of definitions) {
    keys[definition.object_type] ??= new Set()
    for (const key of Object.keys(definition.json_schema?.properties || {})) keys[definition.object_type].add(key)
  }
  return Object.fromEntries(Object.entries(keys).map(([type, set]) => [type, set.size]))
}
