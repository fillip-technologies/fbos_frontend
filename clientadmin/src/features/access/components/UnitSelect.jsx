// Org-unit picker rendered as an indented tree. `emptyLabel` is the "no unit" choice.
export default function UnitSelect({ id, units, value, onChange, emptyLabel, className, disabled }) {
  return (
    <select id={id} className={className} value={value || ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{emptyLabel}</option>
      {units.map((u) => (
        <option key={u.id} value={u.id}>
          {'  '.repeat(u.depth)}
          {u.name} ({u.unit_type})
        </option>
      ))}
    </select>
  )
}
