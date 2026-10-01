import { useActiveOrg } from '../auth/ActiveOrg.jsx'

// Picks the organization the current screen works in (sent as X-Organization-Id).
export default function OrgSwitcher({ onChange }) {
  const { orgs, activeOrg, selectOrg } = useActiveOrg()
  if (orgs.length <= 1) {
    return activeOrg ? <span className="org-pill">{activeOrg.name}</span> : null
  }
  return (
    <label className="org-switcher">
      <span className="muted small">Organization</span>
      <select
        value={activeOrg?.id || ''}
        onChange={(e) => {
          selectOrg(e.target.value)
          onChange?.(e.target.value)
        }}
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.code})
          </option>
        ))}
      </select>
    </label>
  )
}
