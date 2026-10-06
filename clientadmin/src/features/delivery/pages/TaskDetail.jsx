import { Link, useNavigate, useParams } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import TaskActions from '@/features/delivery/components/TaskActions.jsx'
import TaskChecklist from '@/features/delivery/components/TaskChecklist.jsx'
import HandOver from '@/features/delivery/components/HandOver.jsx'
import TaskComments from '@/features/delivery/components/TaskComments.jsx'
import TaskDependencies from '@/features/delivery/components/TaskDependencies.jsx'
import TaskHistory from '@/features/delivery/components/TaskHistory.jsx'
import TaskTime from '@/features/delivery/components/TaskTime.jsx'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { SUBJECT_TYPES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, formatDay, formatMinutes, isOverdue } from '@/features/delivery/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

export default function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { orgId } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const { data: task, error, loading, reload, setData } = useQuery(
    ['task', orgId, id],
    ({ signal }) => tasksApi.get(orgId, id, { signal }),
    { enabled: Boolean(orgId) }
  )

  // A changed task: shown at once; lists, its project's counts and its history refetch.
  const setTask = (saved) => {
    setData(saved)
    invalidate(['tasks', orgId])
    invalidate(['task', orgId, id, 'history'])
    invalidate(['task', orgId, id, 'assignments'])
    if (saved.work_unit_id) invalidate(['project', orgId, saved.work_unit_id])
  }

  if (loading) return <DetailSkeleton />
  if (!task)
    return (
      <div>
        <ErrorBanner error={error} onRetry={reload} />
        <button className="btn secondary" onClick={() => navigate('/tasks')}>← Back</button>
      </div>
    )

  const props = { orgId, task, setTask, reload, names }
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {task.title} <StatusBadge status={task.status} label={TASK_STATUS_LABELS[task.status]} />{' '}
            <StatusBadge status={task.priority} label={TASK_PRIORITY_LABELS[task.priority]} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <span className="mono">{task.code}</span> · {task.task_type.name}
            {task.work_unit_id && (
              <>
                {' · '}
                <Link to={`/projects/${task.work_unit_id}?tab=tasks`}>Open project</Link>
              </>
            )}
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <TaskActions {...props} />

      <div className="panel">
        <div className="details-grid">
          <Detail label="Assignee">{task.assignee ? names.personName(task.assignee) : 'Unassigned'}</Detail>
          <Detail label="Reviewer">{task.reviewer && names.personName(task.reviewer)}</Detail>
          <Detail label="Team">{names.unitName(task.owning_unit)}</Detail>
          <Detail label="Due">
            {task.due_at && <span style={isOverdue(task) ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>{formatDay(task.due_at)}</span>}
          </Detail>
          <Detail label="Time">
            {`${formatMinutes(task.logged_minutes)} logged${task.estimate_minutes ? ` of ${formatMinutes(task.estimate_minutes)}` : ''}`}
          </Detail>
          <Detail label="Created by">{task.created_by && names.personName(task.created_by)}</Detail>
          <Detail label="Labels">{task.labels.length > 0 && task.labels.join(', ')}</Detail>
          {task.review_round > 0 && <Detail label="Review rounds">{String(task.review_round)}</Detail>}
        </div>
        {task.description && <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{task.description}</p>}
        {task.status === 'blocked' && task.attributes.blocked_reason && (
          <div className="alert warn" style={{ margin: '12px 0 0' }}>Blocked: {task.attributes.blocked_reason}</div>
        )}
      </div>

      <HandOver
        orgId={orgId}
        subject={{ type: SUBJECT_TYPES.task, id: task.id }}
        fromUnit={task.owning_unit}
        names={names}
        finished={['done', 'cancelled'].includes(task.status)}
      />
      <TaskChecklist {...props} />
      <TaskTime {...props} />
      <TaskDependencies {...props} />
      <TaskComments {...props} />
      <TaskHistory {...props} />
    </div>
  )
}
