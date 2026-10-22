import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import { SUBJECT_TYPES, TASK_STATUS_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// The tasks this one waits for: it can't start until they are finished.
export default function TaskDependencies({ orgId, task }) {
  const { user: me } = useAuth()
  const canManage = hasAccess(me, ACCESS.manageTasks)
  const { data: dependencies = [], error, reload, setData } = useQuery(
    ['task', orgId, task.id, 'dependencies'],
    ({ signal }) => tasksApi.dependencies(orgId, task.id, { signal }),
    { enabled: Boolean(orgId) }
  )
  // Other tasks of the same project, to wait for one of them.
  const { data: siblings } = useQuery(
    ['tasks', orgId, { project: task.work_unit_id, picker: true }],
    ({ signal }) => tasksApi.list(orgId, { limit: 100, subject_type: SUBJECT_TYPES.project, subject_id: task.work_unit_id }, { signal }),
    { enabled: Boolean(orgId && canManage && task.work_unit_id) }
  )
  const [choice, setChoice] = useState('')
  const [actionError, setActionError] = useState(null)

  const waitedFor = new Set(dependencies.map((d) => d.task_id))
  const candidates = (siblings?.data ?? []).filter((t) => t.id !== task.id && !waitedFor.has(t.id))
  if (!canManage && dependencies.length === 0) return null

  async function change(call) {
    setActionError(null)
    try {
      await call()
      setData(await tasksApi.dependencies(orgId, task.id))
      setChoice('')
    } catch (err) {
      setActionError(err)
    }
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Waits for</h2>
      <ErrorBanner error={actionError || error} onRetry={actionError ? undefined : reload} />
      {dependencies.length === 0 && <p className="muted small">Nothing: it can start any time.</p>}
      {dependencies.map((d) => (
        <div key={d.task_id} className="row-actions" style={{ alignItems: 'center', padding: '4px 0' }}>
          <Link to={`/tasks/${d.task_id}`}><span className="mono">{d.code}</span> {d.title}</Link>
          <StatusBadge status={d.status} label={TASK_STATUS_LABELS[d.status]} />
          {canManage && (
            <button className="btn secondary small-btn" onClick={() => change(() => tasksApi.removeDependency(orgId, task.id, d.task_id))}>
              Remove
            </button>
          )}
        </div>
      ))}
      {canManage && candidates.length > 0 && (
        <div className="row-actions" style={{ marginTop: 10 }}>
          <select aria-label="Task to wait for" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">— Another task of this project —</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>{t.code} · {t.title}</option>
            ))}
          </select>
          <button className="btn secondary" disabled={!choice} onClick={() => change(() => tasksApi.addDependency(orgId, task.id, choice))}>
            Wait for it
          </button>
        </div>
      )}
    </div>
  )
}
