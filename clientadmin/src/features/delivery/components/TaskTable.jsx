import { useNavigate } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import SlaBadge from '@/features/delivery/components/SlaBadge.jsx'
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, formatDay, isOverdue } from '@/features/delivery/utils.js'
import { prefetch } from '@/shared/api/useQuery.js'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// A page of tasks; a row opens the task. `showTeam` adds the owning team column.
export default function TaskTable({ orgId, tasks, loading, refreshing, names, showTeam = true, showAsker = false, empty = 'No tasks found.' }) {
  const navigate = useNavigate()
  const warm = (id) => prefetch(['task', orgId, id], ({ signal }) => tasksApi.get(orgId, id, { signal }))
  const cols = (showTeam ? 6 : 5) + (showAsker ? 1 : 0)

  return (
    <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            {showAsker && <th>Asked by</th>}
            <th>Given to</th>
            {showTeam && <th>Team</th>}
            <th>Priority</th>
            <th>Status</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableSkeleton cols={cols} />
          ) : tasks.length === 0 ? (
            <tr><td colSpan={cols} className="center-note">{empty}</td></tr>
          ) : (
            tasks.map((t) => (
              <tr key={t.id} onClick={() => navigate(`/tasks/${t.id}`)} onMouseEnter={() => warm(t.id)}>
                <td>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  <div className="muted small">
                    <span className={`discipline-dot ${t.task_type.discipline}`} /> <span className="mono">{t.code}</span> · {t.task_type.name}
                    {t.outcome && ` · ${t.outcome.replace(/_/g, ' ')}`}
                  </div>
                  {t.checklist?.length > 0 && (() => {
                    const total = t.checklist.length
                    const done = t.checklist.filter((i) => i.done).length
                    return (
                      <div className="small" style={{ marginTop: 4, color: done === total ? 'var(--ok, #1baf7a)' : 'var(--muted)' }}>
                        {done === total ? '✓ ' : '☐ '}{done}/{total} steps done
                      </div>
                    )
                  })()}
                </td>
                {showAsker && <td>{t.created_by ? names.personName(t.created_by) : <span className="muted">—</span>}</td>}
                <td>{t.assignee ? names.personName(t.assignee) : <span className="muted">Nobody yet</span>}</td>
                {showTeam && <td>{names.unitName(t.owning_unit)}</td>}
                <td><StatusBadge status={t.priority} label={TASK_PRIORITY_LABELS[t.priority]} /></td>
                <td>
                  <StatusBadge status={t.status} label={TASK_STATUS_LABELS[t.status]} />
                  {t.governing_workflow && <div className="muted small">{t.governing_workflow.stage.name}</div>}
                  {(t.sla || t.response_sla) && <div style={{ marginTop: 4 }}><SlaBadge task={t} compact /></div>}
                </td>
                <td className={isOverdue(t) ? 'small' : 'muted small'} style={isOverdue(t) ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
                  {formatDay(t.due_at)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
