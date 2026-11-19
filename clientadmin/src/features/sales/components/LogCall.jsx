import { useState } from 'react'
import { leadsApi } from '@/features/sales/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { nowLocalInput } from '@/features/sales/utils.js'

const EMPTY = () => ({ occurred_at: nowLocalInput(), summary: '', requirements: '', expectations: '', next_action: '', follow_up_on: '' })

// A call with the lead. The summary is required; each call is kept as its own entry on the
// lead's timeline, and the first one moves a new lead to contacted.
export default function LogCall({ orgId, lead, onLogged, onCancel }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = { occurred_at: new Date(form.occurred_at).toISOString(), summary: form.summary.trim() }
      for (const k of ['requirements', 'expectations', 'next_action']) if (form[k].trim()) body[k] = form[k].trim()
      if (form.follow_up_on) body.follow_up_on = form.follow_up_on
      onLogged(await leadsApi.logCall(orgId, lead.id, body))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={handleSubmit}>
      <h3>Log a call</h3>
      {lead.status === 'new' && (
        <p className="muted small" style={{ marginTop: 0 }}>Logging the first call marks this lead as contacted.</p>
      )}
      {error && <ErrorBanner error={error} />}
      <div className="field">
        <label htmlFor="call-summary">What did you discuss? *</label>
        <textarea id="call-summary" required rows={3} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
        {fieldErrors.summary && <div className="field-error">{fieldErrors.summary}</div>}
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="call-requirements">Customer requirements</label>
          <textarea id="call-requirements" rows={2} value={form.requirements} onChange={(e) => set('requirements', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="call-expectations">Interests and expectations</label>
          <textarea id="call-expectations" rows={2} value={form.expectations} onChange={(e) => set('expectations', e.target.value)} />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="call-next">Next action</label>
          <input id="call-next" value={form.next_action} onChange={(e) => set('next_action', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="call-follow-up">Follow up on</label>
          <input id="call-follow-up" type="date" value={form.follow_up_on} onChange={(e) => set('follow_up_on', e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="call-when">When</label>
        <input id="call-when" type="datetime-local" required value={form.occurred_at} onChange={(e) => set('occurred_at', e.target.value)} />
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving} aria-busy={saving}>Log call</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}
