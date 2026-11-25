import { serviceLabel } from '@/features/access/permissions.js'

// How much access, as a level with its own colour. It says how much, not whether it is good or bad:
// more access is more power, so no green or red here. Shares of everything the catalog offers.
export function accessLevel(count, total) {
  const share = total > 0 ? count / total : 0
  if (share >= 0.85) return { key: 'full', label: 'Full access', hint: 'Can do almost everything' }
  if (share >= 0.35) return { key: 'wide', label: 'Wide access', hint: 'Works across many areas' }
  if (share >= 0.1) return { key: 'limited', label: 'Limited access', hint: 'A few areas' }
  return { key: 'minimal', label: count === 0 ? 'No access' : 'Minimal access', hint: 'Only the basics' }
}

export function AccessLevel({ count, total }) {
  const level = accessLevel(count, total)
  return <span className={`ac-level ac-${level.key}`} title={`${level.hint} (${count} of ${total} permissions)`}>{level.label}</span>
}

// A person's or a role's permissions in plain words: one chip per area ("Delivery · 8 actions")
// instead of a wall of codes. The catalog says which area each code belongs to.
export default function AccessChips({ codes, catalog, empty = 'Nothing yet.' }) {
  const serviceOf = new Map(catalog.map((p) => [p.code, p.service]))
  const counts = new Map()
  for (const code of new Set(codes)) {
    const service = serviceOf.get(code) ?? code.split('.')[0]
    counts.set(service, (counts.get(service) ?? 0) + 1)
  }
  if (counts.size === 0) return <p className="muted small">{empty}</p>
  return (
    <div className="ac-chips">
      {[...counts].map(([service, n]) => (
        <span key={service} className="ac-chip">
          <strong>{serviceLabel(service)}</strong>
          <small>{n} {n === 1 ? 'action' : 'actions'}</small>
        </span>
      ))}
    </div>
  )
}
