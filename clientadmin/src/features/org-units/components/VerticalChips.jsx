import { effectiveVerticals } from '@/features/org-units/utils.js'

// A unit's own verticals as chips; inherited ones greyed out with where they come from.
export default function VerticalChips({ unit, unitsById, names }) {
  const { ids, from } = effectiveVerticals(unit, unitsById)
  const shown = ids.filter((id) => names[id])
  if (!shown.length) return <span className="muted">—</span>
  return (
    <span className="chips" style={{ margin: 0 }} title={from ? `Inherited from ${from.name}` : undefined}>
      {shown.map((id) => <span key={id} className={`chip${from ? ' subtle' : ''}`}>{names[id]}</span>)}
      {from && <span className="muted small">from {from.name}</span>}
    </span>
  )
}
