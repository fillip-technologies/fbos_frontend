import { useState } from 'react'
import { tasksApi } from '@/features/delivery/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// The assignee or a task manager ticks items while the task is open; required items must be
// ticked before it can be submitted.
export default function TaskChecklist({ orgId, task, setTask }) {
  const { user: me } = useAuth()
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  if (task.checklist.length === 0) return null

  const canTick =
    (task.assignee?.id === me?.id || hasAccess(me, ACCESS.manageTasks)) && !['done', 'cancelled'].includes(task.status)
  const doneCount = task.checklist.filter((i) => i.done).length

  async function tick(item, done) {
    setError(null)
    setBusyId(item.id)
    try {
      const saved = await tasksApi.tickChecklistItem(orgId, task.id, item.id, done)
      setTask({ ...task, checklist: task.checklist.map((i) => (i.id === saved.id ? saved : i)) })
    } catch (err) {
      setError(err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>
        Checklist <span className="muted small">{doneCount} of {task.checklist.length}</span>
      </h2>
      <ErrorBanner error={error} />
      {task.checklist.map((item) => (
        <div key={item.id} style={{ padding: '4px 0' }}>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={item.done}
              disabled={!canTick || busyId === item.id}
              onChange={(e) => tick(item, e.target.checked)}
            />
            <span style={item.done ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{item.text}</span>
            {item.mandatory && !item.done && <span className="muted small">required</span>}
          </label>
        </div>
      ))}
    </div>
  )
}
