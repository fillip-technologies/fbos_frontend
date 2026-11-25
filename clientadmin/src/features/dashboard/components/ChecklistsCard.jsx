import { Link } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { tasksApi } from '@/features/delivery/api.js'
import '@/features/delivery/playbooks.css'
import { PLAYBOOK_LABEL } from '@/features/delivery/playbooks.js'
import { OPEN_TASK_STATUSES } from '@/features/delivery/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { useQuery } from '@/shared/api/useQuery.js'

// Service checklists in progress (SMM for a client, and so on): each with how much is ticked.
// They are the open tasks started from a checklist; what a person sees is what their task access
// lets them read, so a team sees its own clients and an admin sees all of them.
export default function ChecklistsCard() {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const enabled = Boolean(orgId) && hasAccess(user, ACCESS.tasks)
  const { data } = useQuery(
    ['tasks', orgId, 'playbooks'],
    ({ signal }) => tasksApi.list(orgId, { limit: 100, status: OPEN_TASK_STATUSES }, { signal }),
    { enabled, keepPrevious: true }
  )
  const rows = (data?.data ?? [])
    .filter((t) => (t.labels ?? []).includes(PLAYBOOK_LABEL) && (t.checklist ?? []).length > 0)
    .map((t) => ({ task: t, done: t.checklist.filter((i) => i.done).length, total: t.checklist.length }))
    .sort((a, b) => a.done / a.total - b.done / b.total)
  if (rows.length === 0) return null

  return (
    <section className="home-section" aria-label="Checklists">
      <div className="home-section-head">
        <h2>Client checklists</h2>
        <span>{rows.length} in progress</span>
      </div>
      <div className="panel">
        <ul className="pbd-list">
          {rows.slice(0, 8).map(({ task, done, total }) => (
            <li key={task.id}>
              <Link className="pbd-title" to={`/tasks/${task.id}`} title={task.title}>{task.title}</Link>
              <span className={`pbd-bar${done === total ? ' is-done' : ''}`} aria-hidden="true"><span style={{ width: `${(done / total) * 100}%` }} /></span>
              <span className="pbd-nums">{done} of {total} done</span>
            </li>
          ))}
        </ul>
        {rows.length > 8 && <p className="muted small" style={{ margin: '10px 0 0' }}>Showing 8 of {rows.length}. The rest are under Tasks.</p>}
      </div>
    </section>
  )
}
