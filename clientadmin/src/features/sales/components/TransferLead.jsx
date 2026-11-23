import { useState } from 'react'
import { leadsApi } from '@/features/sales/api.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const UNCLAIMED = 'unclaimed'

// Passes the lead to someone else who may take leads, or back to the unclaimed leads. A reason
// is required: it goes into the lead's history with who did it and when.
export default function TransferLead({ orgId, lead, people, onTransferred, onCancel }) {
  const others = people.filter((p) => p.id !== lead.owner?.id)
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = { to_user_id: to === UNCLAIMED ? null : to, reason: reason.trim() }
      onTransferred(await leadsApi.transfer(orgId, lead.id, lead.version, body))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={handleSubmit}>
      <h3>{lead.owner ? 'Pass this lead on' : 'Assign this lead'}</h3>
      {error && <ErrorBanner error={error} />}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="transfer-to">To *</label>
          <select id="transfer-to" required value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">— Choose —</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {lead.owner && <option value={UNCLAIMED}>Nobody: put it back with the unclaimed leads</option>}
          </select>
        </div>
        <div className="field">
          <label htmlFor="transfer-reason">Reason *</label>
          <input id="transfer-reason" required maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving} aria-busy={saving}>{lead.owner ? 'Pass on' : 'Assign'}</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}
