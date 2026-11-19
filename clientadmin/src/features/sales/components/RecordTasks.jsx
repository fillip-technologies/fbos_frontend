import { Link } from 'react-router-dom'
import { activitiesApi } from '@/features/sales/api.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import { formatDate } from '@/shared/utils/format.js'
import { OPEN_TASK_STATUSES, TASK_STATUS_LABELS } from '@/features/sales/utils.js'

// The tasks (delivery) about a lead, opportunity or contract (`subjectType`, its timeline name),
// open ones first: calls to make, follow-ups, and the activities already logged as done tasks.
// `addTo`: where "+ Add task" goes, when the person may add one here.
export default function RecordTasks({ orgId, subjectType, subjectId, personName, addTo }) {
  const { data, error, loading, reload } = useQuery(
    ['record-tasks', orgId, subjectType, subjectId, 'all'],
    ({ signal }) => activitiesApi.tasks(orgId, subjectType, subjectId, {}, { signal }),
    { enabled: Boolean(orgId && subjectId) }
  )
  const tasks = data?.data ?? []
  const open = tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status))
  const finished = tasks.filter((t) => !OPEN_TASK_STATUSES.includes(t.status))

  return (
    <div className="panel">
      <div className="page-head" style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>Tasks</h2>
        {addTo && <Link className="btn secondary small-btn" to={addTo}>+ Add task</Link>}
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      {loading ? (
        <PanelSkeleton />
      ) : !tasks.length ? (
        <p className="muted small" style={{ margin: 0 }}>No tasks about this yet. Logged calls, meetings and other activities appear here as done tasks.</p>
      ) : (
        <table>
          <tbody>
            {[...open, ...finished].map((t) => (
              <tr key={t.id} style={{ cursor: 'default' }}>
                <td>
                  <Link to={`/tasks/${t.id}`}>{t.code} · {t.title}</Link>
                  {!t.owning_unit && <span className="muted small"> · personal</span>}
                </td>
                <td className="small">{TASK_STATUS_LABELS[t.status] || t.status}</td>
                <td className="muted small">{t.assignee?.id ? personName?.(t.assignee.id) || t.assignee.name || 'Someone' : 'Unassigned'}</td>
                <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                  {t.status === 'done' && t.completed_at ? `Done ${formatDate(t.completed_at)}` : t.due_at ? `Due ${formatDate(t.due_at)}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data?.page?.has_more && <p className="muted small">Showing the latest 50.</p>}
    </div>
  )
}
