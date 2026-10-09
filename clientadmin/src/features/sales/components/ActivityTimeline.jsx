import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { activitiesApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { ACTIVITY_TYPES, formatDateTime, nowLocalInput } from '@/features/sales/utils.js'

// Revenue keeps activity times in UTC without saying so: read them as UTC, not local time.
const asUtc = (iso) => (iso && !/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? `${iso}Z` : iso)

const EMPTY = () => ({ activity_type: 'call', occurred_at: nowLocalInput(), summary: '', outcome: '' })

// Calls, meetings and notes logged on one lead, opportunity or contract.
export default function ActivityTimeline({ orgId, subjectType, subjectId }) {
  const { user: me } = useAuth()
  const canLog = hasAccess(me, ACCESS.logActivities)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const load = useCallback(() => {
    setLoading(true)
    activitiesApi
      .list(orgId, subjectType, subjectId)
      .then((res) => setActivities([...res.data].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, subjectType, subjectId])
  useEffect(load, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        subject: { type: subjectType, id: subjectId },
        activity_type: form.activity_type,
        occurred_at: new Date(form.occurred_at).toISOString(),
        summary: form.summary.trim(),
      }
      if (form.outcome.trim()) body.outcome = form.outcome.trim()
      await activitiesApi.create(orgId, body)
      setForm(null)
      load()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel">
      <div className="section-head">
        <h2 style={{ fontSize: 17 }}>Activity</h2>
        {canLog && !form && (
          <button type="button" className="btn secondary small-btn" onClick={() => setForm(EMPTY())}>+ Log activity</button>
        )}
      </div>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} onRetry={load} />}

      {form && (
        <form className="inline-panel" onSubmit={handleSubmit} style={{ marginTop: 0, marginBottom: 14 }}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="act-type">Type</label>
              <select id="act-type" value={form.activity_type} onChange={(e) => set('activity_type', e.target.value)}>
                {Object.entries(ACTIVITY_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="act-when">When</label>
              <input
                id="act-when"
                type="datetime-local"
                required
                value={form.occurred_at}
                onChange={(e) => set('occurred_at', e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="act-summary">What happened *</label>
            <textarea id="act-summary" required rows={2} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
            {fieldErrors.summary && <div className="field-error">{fieldErrors.summary}</div>}
          </div>
          <div className="field">
            <label htmlFor="act-outcome">Outcome</label>
            <input id="act-outcome" value={form.outcome} onChange={(e) => set('outcome', e.target.value)} />
          </div>
          <div className="row-actions">
            <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log'}</button>
            <button type="button" className="btn secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="center-note">Loading…</div>
      ) : activities.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>Nothing logged yet.</p>
      ) : (
        <table>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id} style={{ cursor: 'default' }}>
                <td style={{ whiteSpace: 'nowrap', width: 1 }}>
                  <span className="chip subtle">{ACTIVITY_TYPES[a.activity_type] || a.activity_type}</span>
                </td>
                <td>
                  <div style={{ whiteSpace: 'pre-line' }}>{a.summary}</div>
                  {a.outcome && <div className="muted small">Outcome: {a.outcome}</div>}
                  {a.source?.type === 'task.task' && (
                    <div className="small"><Link to={`/tasks/${a.source.id}`}>From a task</Link></div>
                  )}
                </td>
                <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(asUtc(a.occurred_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
