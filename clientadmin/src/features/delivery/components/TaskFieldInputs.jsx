// The inputs for a task's fields, whatever its kind of work: a pull request link for a story,
// a phone number for a call, an asset link for a deliverable, a site for a work order.
// `values` is form state keyed by field key; `stage` marks which fields are required
// ('create': needed to create, 'submit': needed to submit as well).
export default function TaskFieldInputs({ fields, values, onChange, errors = {}, stage = 'create', idPrefix = 'attr' }) {
  if (!fields.length) return null
  const set = (key, value) => onChange({ ...values, [key]: value })
  return (
    <div className="task-fields">
      {fields.map((field) => {
        const id = `${idPrefix}_${field.key}`
        const required = field.required || (stage === 'submit' && field.required_on_submit)
        const wide = field.type === 'long_text' || field.type === 'multi_choice'
        return (
          <div key={field.key} className={`field${wide ? ' span-all' : ''}`}>
            {field.type === 'boolean' ? (
              <label className="inline-check" htmlFor={id} style={{ fontWeight: 600, fontSize: 13 }}>
                <input id={id} type="checkbox" checked={Boolean(values[field.key])} onChange={(e) => set(field.key, e.target.checked)} />
                {field.label}{required ? ' *' : ''}
              </label>
            ) : (
              <>
                <label htmlFor={id}>
                  {field.label}{required ? ' *' : ''}
                  {field.custom && <span className="muted" style={{ fontWeight: 400 }}> · company field</span>}
                </label>
                <FieldInput id={id} field={field} value={values[field.key]} onChange={(value) => set(field.key, value)} invalid={Boolean(errors[field.key])} />
              </>
            )}
            {field.help && <div className="hint">{field.help}</div>}
            {errors[field.key] && <div className="field-error">{errors[field.key]}</div>}
          </div>
        )
      })}
    </div>
  )
}

const INPUT_TYPES = { url: 'url', email: 'email', phone: 'tel', date: 'date', datetime: 'datetime-local', number: 'number', integer: 'number' }
const PLACEHOLDERS = { url: 'https://…', email: 'name@company.com', phone: '+91 98765 43210' }

function FieldInput({ id, field, value, onChange, invalid }) {
  const className = invalid ? 'invalid' : undefined
  if (field.type === 'long_text') {
    return <textarea id={id} rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  }
  if (field.type === 'choice') {
    return (
      <select id={id} className={className} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.options.map((option) => (
          <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
        ))}
      </select>
    )
  }
  if (field.type === 'multi_choice') {
    const chosen = new Set(Array.isArray(value) ? value : [])
    const toggle = (option) => {
      const next = new Set(chosen)
      next.has(option) ? next.delete(option) : next.add(option)
      onChange(field.options.filter((o) => next.has(o)))
    }
    return (
      <div id={id} className="chips" role="group">
        {field.options.map((option) => (
          <label key={option} className="inline-check chip subtle" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={chosen.has(option)} onChange={() => toggle(option)} />
            {option.replace(/_/g, ' ')}
          </label>
        ))}
      </div>
    )
  }
  return (
    <input
      id={id}
      className={className}
      type={INPUT_TYPES[field.type] || 'text'}
      step={field.type === 'integer' ? 1 : field.type === 'number' ? 'any' : undefined}
      placeholder={PLACEHOLDERS[field.type]}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
