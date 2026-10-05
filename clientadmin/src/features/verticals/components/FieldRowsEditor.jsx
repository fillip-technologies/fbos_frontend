import { FIELD_TYPES, keyFromLabel } from '@/features/verticals/utils.js'

let rowKey = 1
export const blankField = () => ({ rowKey: rowKey++, label: '', key: '', keyEdited: false, type: 'text', options: '', required: false })

// Rows of { rowKey, label, key, keyEdited, type, options (comma separated), required }.
// `errors` maps rowKey -> message (see fieldError in utils.js).
export default function FieldRowsEditor({ fields, onChange, errors = {}, idPrefix = 'f' }) {
  const update = (key, patch) => onChange(fields.map((f) => (f.rowKey === key ? { ...f, ...patch } : f)))
  // The key follows the label until the user types a key of their own.
  const setLabel = (f, label) => update(f.rowKey, f.keyEdited ? { label } : { label, key: keyFromLabel(label) })
  const remove = (key) => onChange(fields.filter((f) => f.rowKey !== key))
  const move = (index, by) => {
    const next = [...fields]
    const [row] = next.splice(index, 1)
    next.splice(index + by, 0, row)
    onChange(next)
  }

  return (
    <>
      <table className="compact field-rows">
        <thead>
          <tr>
            <th>Label</th>
            <th style={{ width: 170 }}>Key</th>
            <th style={{ width: 150 }}>Type</th>
            <th style={{ width: 90 }}>Required</th>
            <th style={{ width: 80 }} />
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={f.rowKey}>
              <td>
                <input id={`${idPrefix}-${f.rowKey}`} value={f.label} onChange={(e) => setLabel(f, e.target.value)} placeholder="Site address" maxLength={120} aria-label="Field label" />
                {f.type === 'choice' && (
                  <input
                    value={f.options}
                    onChange={(e) => update(f.rowKey, { options: e.target.value })}
                    placeholder="Options, comma separated: Foundation, Walls, Roof"
                    aria-label="Choice options"
                    style={{ marginTop: 6 }}
                  />
                )}
                {errors[f.rowKey] && <div className="field-error small">{errors[f.rowKey]}</div>}
              </td>
              <td>
                <input value={f.key} onChange={(e) => update(f.rowKey, { key: e.target.value, keyEdited: true })} placeholder="site_address" maxLength={64} aria-label="Field key" />
              </td>
              <td>
                <select value={f.type} onChange={(e) => update(f.rowKey, { type: e.target.value })} aria-label="Field type">
                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </td>
              <td>
                <input type="checkbox" checked={f.required} onChange={(e) => update(f.rowKey, { required: e.target.checked })} aria-label="Required" />
              </td>
              <td className="row-actions">
                <button type="button" className="link-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button type="button" className="link-btn" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="Move down">↓</button>
                {fields.length > 1 && (
                  <button type="button" className="link-btn danger" onClick={() => remove(f.rowKey)} aria-label="Remove field">✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="link-btn" onClick={() => onChange([...fields, blankField()])} style={{ marginTop: 8 }}>+ Add field</button>
    </>
  )
}
