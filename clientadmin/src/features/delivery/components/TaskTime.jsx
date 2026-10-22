import { useState } from 'react'
import { timeApi } from '@/features/delivery/api.js'
import { formatMinutes, parseDuration } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { todayIso } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'

// Time logged on the task. Everyone who can see the task logs their own time on it; without
// access to everyone's time, the list shows only your own entries.
export default function TaskTime({ orgId, task, setTask, names }) {
  const { user: me } = useAuth()
  const seesEveryone = hasAccess(me, ACCESS.everyonesTime)
  const { data: entries = [], error, reload, setData } = useQuery(
    ['task', orgId, task.id, 'time'],
    ({ signal }) => timeApi.forTask(orgId, task.id, { signal }),
    { enabled: Boolean(orgId) }
  )
  const [form, setForm] = useState({ work_date: todayIso(), duration: '', billable: true, note: '' })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const minutes = parseDuration(form.duration)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  async function log(e) {
    e.preventDefault()
    if (!minutes) return
    setActionError(null)
    setBusy(true)
    try {
      const entry = await timeApi.log(orgId, task.id, {
        work_date: form.work_date,
        minutes,
        billable: form.billable,
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      })
      setData((list) => [entry, ...(list ?? [])])
      setTask({ ...task, logged_minutes: task.logged_minutes + entry.minutes })
      invalidate(['time-entries', orgId])
      setForm((f) => ({ ...f, duration: '', note: '' }))
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }

  async function remove(entry) {
    setActionError(null)
    try {
      await timeApi.remove(orgId, entry.id)
      setData((list) => (list ?? []).filter((e) => e.id !== entry.id))
      setTask({ ...task, logged_minutes: Math.max(0, task.logged_minutes - entry.minutes) })
      invalidate(['time-entries', orgId])
    } catch (err) {
      setActionError(err)
    }
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>
        Time <span className="muted small">{seesEveryone ? 'everyone' : 'yours'}</span>
      </h2>
      <ErrorBanner error={actionError || error} onRetry={actionError ? undefined : reload} />
      {entries.length > 0 && (
        <table style={{ marginBottom: 14 }}>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ cursor: 'default' }}>
                <td>{formatDate(e.work_date)}</td>
                <td>{names.personName(e.user)}</td>
                <td>{formatMinutes(e.minutes)}{!e.billable && <span className="muted small"> · not billable</span>}</td>
                <td className="muted small">{e.note}</td>
                <td>
                  {e.user.id === me?.id && (
                    <button className="btn secondary small-btn" onClick={() => remove(e)}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={log}>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="time_date">Day</label>
            <input id="time_date" type="date" required max={todayIso()} value={form.work_date} onChange={(e) => set('work_date', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="time_duration">Time spent *</label>
            <input id="time_duration" required placeholder="e.g. 1h 30m" value={form.duration} onChange={(e) => set('duration', e.target.value)} />
            {form.duration.trim() && !minutes && <div className="field-error">Write it like 90, 1h 30m or 1.5h.</div>}
          </div>
          <div className="field">
            <label htmlFor="time_note">Note</label>
            <input id="time_note" value={form.note} onChange={(e) => set('note', e.target.value)} />
          </div>
        </div>
        <div className="row-actions" style={{ alignItems: 'center' }}>
          <button className="btn secondary" type="submit" disabled={busy || !minutes} aria-busy={busy}>Log my time</button>
          <label className="inline-check">
            <input type="checkbox" checked={form.billable} onChange={(e) => set('billable', e.target.checked)} />
            Billable
          </label>
        </div>
      </form>
    </div>
  )
}
