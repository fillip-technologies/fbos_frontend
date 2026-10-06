import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tasksApi, timeApi } from '@/features/delivery/api.js'
import { formatMinutes } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import { toIsoDate } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'

function mondayOf(date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return day
}
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

// One week of logged time. The entries name only their task, so the week's few tasks are
// fetched with them to show their titles.
export default function Timesheet({ orgId, names }) {
  const { user: me } = useAuth()
  const canSeeEveryone = hasAccess(me, ACCESS.everyonesTime)
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [person, setPerson] = useState('me')
  const [removeError, setRemoveError] = useState(null)
  const dateFrom = toIsoDate(weekStart)
  const dateTo = toIsoDate(addDays(weekStart, 6))

  const { data, error, loading, refreshing, reload, setData } = useQuery(
    ['time-entries', orgId, { dateFrom, person }],
    async ({ signal }) => {
      const entries = await timeApi.timesheet(orgId, { date_from: dateFrom, date_to: dateTo, user_id: person }, { signal })
      const taskIds = [...new Set(entries.map((e) => e.task_id))]
      const tasks = await Promise.all(taskIds.map((id) => tasksApi.get(orgId, id, { signal }).catch(() => null)))
      return { entries, tasks: Object.fromEntries(tasks.filter(Boolean).map((t) => [t.id, t])) }
    },
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const entries = data?.entries ?? []
  const days = Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(weekStart, i)))
  const byDay = Object.fromEntries(days.map((d) => [d, entries.filter((e) => e.work_date === d)]))
  const weekTotal = entries.reduce((sum, e) => sum + e.minutes, 0)

  async function remove(entry) {
    setRemoveError(null)
    try {
      await timeApi.remove(orgId, entry.id)
      setData((current) => ({ ...current, entries: current.entries.filter((e) => e.id !== entry.id) }))
    } catch (err) {
      setRemoveError(err)
    }
  }

  return (
    <>
      <div className="toolbar">
        <button className="btn secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Previous week</button>
        <strong>{formatDate(dateFrom)} – {formatDate(dateTo)}</strong>
        <button className="btn secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next week →</button>
        {canSeeEveryone && names.people && (
          <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Whose time">
            <option value="me">My time</option>
            {names.people.filter((u) => u.id !== me?.id).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
        <span className="muted">Week total: <strong>{formatMinutes(weekTotal)}</strong></span>
      </div>

      <ErrorBanner error={removeError || error} onRetry={removeError ? undefined : reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Task</th>
              <th>Note</th>
              <th>Time</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={5} rows={5} />
            ) : (
              days.flatMap((day) => {
                const dayEntries = byDay[day]
                const dayTotal = dayEntries.reduce((sum, e) => sum + e.minutes, 0)
                const heading = (
                  <tr key={day} style={{ cursor: 'default', background: '#f8fafc' }}>
                    <td colSpan={3}><strong>{formatDate(day)}</strong></td>
                    <td><strong>{dayTotal ? formatMinutes(dayTotal) : <span className="muted">—</span>}</strong></td>
                    <td />
                  </tr>
                )
                return [
                  heading,
                  ...dayEntries.map((e) => {
                    const task = data.tasks[e.task_id]
                    return (
                      <tr key={e.id} style={{ cursor: 'default' }}>
                        <td />
                        <td>
                          <Link to={`/tasks/${e.task_id}`}>{task ? task.title : 'Open task'}</Link>
                          {task && <div className="muted small mono">{task.code}</div>}
                        </td>
                        <td className="muted small">{e.note || '—'}{!e.billable && ' · not billable'}</td>
                        <td>{formatMinutes(e.minutes)}</td>
                        <td>
                          {e.user.id === me?.id && (
                            <button className="btn secondary small-btn" onClick={() => remove(e)}>Remove</button>
                          )}
                        </td>
                      </tr>
                    )
                  }),
                ]
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small">Log time from a task's page.</p>
    </>
  )
}
