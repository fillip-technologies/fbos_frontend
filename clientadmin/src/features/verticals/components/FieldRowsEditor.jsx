import { CHOICE_TYPES, FIELD_TYPES, keyFromLabel } from '@/shared/utils/customFields.js'
import { blankRow } from '@/features/verticals/utils.js'

// A form's custom fields as editable cards: label, key, type and required, the options of a
// choice list, help text, and when the field shows. Rows are those of features/verticals/utils.js;
// `errors` maps rowKey -> message; `inputs` are the form's inputs a rule may watch, with
// their choices in `optionsByInput`.
export default function FieldRowsEditor({ rows, onChange, errors = {}, inputs = [], optionsByInput = {} }) {
  const update = (rowKey, patch) => onChange(rows.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)))
  // The key follows the label until the user types a key of their own.
  const setLabel = (row, label) => update(row.rowKey, row.keyEdited ? { label } : { label, key: keyFromLabel(label) })
  const remove = (rowKey) => onChange(rows.filter((r) => r.rowKey !== rowKey))
  const move = (index, by) => {
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(index + by, 0, row)
    onChange(next)
  }

  return (
    <>
      <div className="field-cards">
        {rows.map((row, index) => (
          <div key={row.rowKey} className="field-card">
            <div className="field-card-main">
              <input
                value={row.label}
                onChange={(e) => setLabel(row, e.target.value)}
                placeholder="Label, e.g. Site address"
                maxLength={120}
                aria-label="Field label"
              />
              <input
                value={row.key}
                onChange={(e) => update(row.rowKey, { key: e.target.value, keyEdited: true })}
                placeholder="site_address"
                maxLength={64}
                aria-label="Field key"
              />
              <select value={row.type} onChange={(e) => update(row.rowKey, { type: e.target.value })} aria-label="Field type">
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label className="inline-check">
                <input type="checkbox" checked={row.required} onChange={(e) => update(row.rowKey, { required: e.target.checked })} />
                Required
              </label>
              <span className="row-actions">
                <button type="button" className="link-btn" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">↑</button>
                <button type="button" className="link-btn" onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label="Move down">↓</button>
                <button type="button" className="link-btn danger" onClick={() => remove(row.rowKey)} aria-label="Remove field">✕</button>
              </span>
            </div>
            {CHOICE_TYPES.includes(row.type) && (
              <input
                className="field-card-options"
                value={row.options}
                onChange={(e) => update(row.rowKey, { options: e.target.value })}
                placeholder="Options, comma separated: Foundation, Walls, Roof"
                aria-label="Choice options"
              />
            )}
            <div className="field-card-more">
              <input
                value={row.help}
                onChange={(e) => update(row.rowKey, { help: e.target.value })}
                placeholder="Help text under the field (optional)"
                maxLength={500}
                aria-label="Help text"
              />
              <RuleEditor row={row} inputs={inputs} optionsByInput={optionsByInput} onUpdate={(patch) => update(row.rowKey, patch)} />
            </div>
            {errors[row.rowKey] && <div className="field-error small">{errors[row.rowKey]}</div>}
          </div>
        ))}
      </div>
      <button type="button" className="link-btn" onClick={() => onChange([...rows, blankRow()])} style={{ marginTop: 10 }}>
        + Add field
      </button>
    </>
  )
}

// When the field shows: always, or only while one input of the form holds a ticked value.
function RuleEditor({ row, inputs, optionsByInput, onUpdate }) {
  const known = inputs.some((input) => input.key === row.ruleInput)
  const toggle = (value, on) =>
    onUpdate({ ruleValues: on ? [...row.ruleValues, value] : row.ruleValues.filter((v) => v !== value) })

  return (
    <div>
      <select
        value={row.ruleInput}
        onChange={(e) => onUpdate({ ruleInput: e.target.value, ruleValues: [] })}
        disabled={!inputs.length && !row.ruleInput}
        aria-label="When the field shows"
      >
        <option value="">Show always</option>
        {inputs.map((input) => <option key={input.key} value={input.key}>Show only when {input.label} is…</option>)}
        {row.ruleInput && !known && <option value={row.ruleInput}>Show only when {row.ruleInput} is…</option>}
      </select>
      {row.ruleInput && (
        <div className="field-rule-values">
          {ruleChoices(row, optionsByInput).map((choice) => (
            <label key={choice.value} className="inline-check">
              <input type="checkbox" checked={row.ruleValues.includes(choice.value)} onChange={(e) => toggle(choice.value, e.target.checked)} />
              {choice.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// The values a rule can tick: the input's options, plus any value already ticked that the
// list no longer has (e.g. a deleted category).
function ruleChoices(row, optionsByInput) {
  const options = optionsByInput[row.ruleInput] || []
  const listed = new Set(options.map((o) => o.value))
  const missing = row.ruleValues
    .filter((value) => !listed.has(value))
    .map((value) => ({ value, label: `${value} (no longer listed)` }))
  return [...options, ...missing]
}
