// The Identity roles a post gives. Ticking a role adds it to the post, unticking takes it away; a role limited to the
// post's department says so. Roles People may not grant (system and admin roles) stay only where the post has them.
const SCOPES = [
  ['organization', 'Company-wide'],
  ['department', 'Post’s department'],
]

const key = (spec) => `${spec.role_code.toLowerCase()}|${spec.scope || 'organization'}|${spec.unit_id || ''}`

export default function RolePicker({ options, value, current = [], onChange, unitName }) {
  const heldNow = new Set(current.map((spec) => spec.role_code.toLowerCase()))
  const chosen = (code) => value.find((spec) => spec.role_code.toLowerCase() === code.toLowerCase())
  // A role held in some other department stays as it was; it is listed even if no option matches.
  const unitRoles = value.filter((spec) => spec.scope === 'unit')
  const toggle = (option) => {
    onChange(chosen(option.code) ? value.filter((spec) => spec.role_code.toLowerCase() !== option.code.toLowerCase()) : [...value, { role_code: option.code, scope: 'organization', name: option.name }])
  }
  const setScope = (code, scope) => onChange(value.map((spec) => (spec.role_code.toLowerCase() === code.toLowerCase() ? { ...spec, scope } : spec)))

  if (!options.length) return <div className="muted small">No roles to choose from.</div>
  return (
    <div className="role-picker">
      {options.map((option) => {
        const spec = chosen(option.code)
        const locked = !option.assignable_by_people && !heldNow.has(option.code.toLowerCase())
        return (
          <div key={option.code} className="checkbox-field">
            <label title={locked ? 'Cannot be given from People. Grant it under Users.' : undefined}>
              <input type="checkbox" checked={Boolean(spec)} disabled={locked} onChange={() => toggle(option)} />
              {option.name}
              {locked && <span className="muted small"> (Users only)</span>}
            </label>
            {spec && spec.scope !== 'unit' && (
              <select aria-label={`Scope of ${option.name}`} value={spec.scope || 'organization'} onChange={(e) => setScope(option.code, e.target.value)}>
                {SCOPES.map(([scope, label]) => <option key={scope} value={scope}>{label}</option>)}
              </select>
            )}
            {spec?.scope === 'unit' && <span className="muted small">{unitName ? unitName(spec.unit_id) : 'another department'}</span>}
          </div>
        )
      })}
      {unitRoles.filter((spec) => !options.some((o) => o.code.toLowerCase() === spec.role_code.toLowerCase())).map((spec) => (
        <div key={key(spec)} className="muted small">{spec.name || spec.role_code} (kept as it was)</div>
      ))}
    </div>
  )
}
