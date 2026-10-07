import { useState } from 'react'
import { Link } from 'react-router-dom'
import { handoversApi } from '@/features/delivery/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { invalidate } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// "Hand over" for a task or project: its owning team asks another team to take it on.
// `subject` is { type, id }; `fromUnit` is the current owning team ref.
export default function HandOver({ orgId, subject, fromUnit, names, finished = false }) {
  const { user: me } = useAuth()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ to_unit_id: '', reason: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [requested, setRequested] = useState(false)
  if (!hasAccess(me, ACCESS.manageHandovers) || !fromUnit || finished) return null

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const otherUnits = (names.units || []).filter((u) => u.id !== fromUnit.id && u.status !== 'inactive')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await handoversApi.request(orgId, {
        subject,
        from_unit_id: fromUnit.id,
        to_unit_id: form.to_unit_id,
        reason: form.reason.trim(),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      })
      invalidate(['handovers', orgId])
      setRequested(true)
      setOpen(false)
      setForm({ to_unit_id: '', reason: '', notes: '' })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="row-actions" style={{ alignItems: 'center', marginBottom: 16 }}>
        <button className="btn secondary" onClick={() => { setRequested(false); setOpen(true) }}>Hand over to another team</button>
        {requested && (
          <span className="small">
            Asked. <Link to="/tasks?view=handovers">See handovers</Link>
          </span>
        )}
      </div>
    )
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Hand over from {names.unitName(fromUnit)}</h2>
      <ErrorBanner error={error} />
      <div className="grid-2">
        <div className="field">
          <label htmlFor="handover_to">To *</label>
          <select id="handover_to" required value={form.to_unit_id} onChange={(e) => set('to_unit_id', e.target.value)}>
            <option value="">— Choose a team —</option>
            {otherUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="handover_reason">Why *</label>
          <input id="handover_reason" required maxLength={255} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="handover_notes">Notes for the other team</label>
        <textarea id="handover_notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Ask them</button>
        <button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}
