import { useState } from 'react'

// A small inline form: fields are [{ name, label, required?, options?: [[value, label]], textarea? }].
export default function ActionForm({ title, fields, busy, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, ''])))
  return (
    <form className="panel" style={{ marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); onSubmit(Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''))) }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {fields.map((f) => (
        <label key={f.name} className="field">
          <span>{f.label}</span>
          {f.options ? (
            <select required={f.required} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
              <option value="">Choose…</option>
              {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : f.textarea ? (
            <textarea rows={3} required={f.required} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          ) : (
            <input type={f.type ?? 'text'} required={f.required} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          )}
        </label>
      ))}
      <div className="row-actions">
        <button className="btn" disabled={!!busy} aria-busy={!!busy}>Save</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
