// The operator company that runs FBOS (Fillip) has no service end date and no quotas.
// Identity stores that as null subscription_end / max_organizations / max_users_per_org.
export default function UnlimitedToggle({ checked, onChange }) {
  return (
    <div className="field">
      <div className="checkbox-field">
        <label>
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          Unlimited (internal)
        </label>
      </div>
      <div className="hint">
        For the company that runs FBOS: no service end date, no organization or user limits.
      </div>
    </div>
  )
}

// True when Identity reports the client has no end date and no quotas.
export function isUnlimitedClient(client) {
  return (
    client != null &&
    client.subscription_end == null &&
    client.max_organizations == null &&
    client.max_users_per_org == null
  )
}
