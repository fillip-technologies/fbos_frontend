import { useNavigate } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, formatDay, isOverdue } from '@/features/delivery/utils.js'
import { prefetch } from '@/shared/api/useQuery.js'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// A page of tasks; a row opens the task. `showTeam` adds the owning team column.
export default function TaskTable({ orgId, tasks, loading, refreshing, names, showTeam = true, empty = 'No tasks found.' }) {
  const navigate = useNavigate()
  const warm = (id) => prefetch(['task', orgId, id], ({ signal }) => tasksApi.get(orgId, id, { signal }))
  const cols = showTeam ? 6 : 5

  return (
    <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Assignee</th>
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
                    <span className="mono">{t.code}</span> · {t.task_type.name}
                  </div>
                </td>
                <td>{t.assignee ? names.personName(t.assignee) : <span className="muted">Unassigned</span>}</td>
                {showTeam && <td>{names.unitName(t.owning_unit)}</td>}
                <td><StatusBadge status={t.priority} label={TASK_PRIORITY_LABELS[t.priority]} /></td>
                <td><StatusBadge status={t.status} label={TASK_STATUS_LABELS[t.status]} /></td>
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
