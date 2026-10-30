import { cloneElement } from 'react'

// A labelled form control: <Field label="Name" required error={fieldErrors.name}><input .../></Field>.
// The child gets `id` (so the label is clickable) and the red border when `error` is set.
export default function Field({ label, required = false, hint, error, full = false, children, ...rest }) {
  const id = rest.id || `f-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const control = cloneElement(children, {
    id,
    required: required || children.props.required,
    className: [children.props.className, error ? 'invalid' : ''].filter(Boolean).join(' ') || undefined,
  })
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="req">*</span>}
      </label>
      {control}
      {hint && !error && <div className="hint">{hint}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}
