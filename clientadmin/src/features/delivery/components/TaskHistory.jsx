import { tasksApi } from '@/features/delivery/api.js'
import { TASK_STATUS_LABELS, formatDateTime } from '@/features/delivery/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// Who worked on the task and until when, every review round and every status change (who, when, why).
export default function TaskHistory({ orgId, task, names }) {
  const enabled = Boolean(orgId)
  const history = useQuery(['task', orgId, task.id, 'history'], ({ signal }) => tasksApi.history(orgId, task.id, { signal }), { enabled })
  const reviews = useQuery(['task', orgId, task.id, 'reviews'], ({ signal }) => tasksApi.reviews(orgId, task.id, { signal }), { enabled })
  const assignments = useQuery(
    ['task', orgId, task.id, 'assignments'],
    ({ signal }) => tasksApi.assignments(orgId, task.id, { signal }),
    { enabled }
  )
  const label = (status) => (status ? TASK_STATUS_LABELS[status] || status : 'Created')

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>History</h2>
      <ErrorBanner error={history.error || reviews.error || assignments.error} onRetry={history.reload} />
      {(assignments.data ?? []).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="detail-label">Worked on by</div>
          {assignments.data.map((a, index) => (
            <div key={`${a.assigned_at}-${index}`} className="small" style={{ padding: '2px 0' }}>
              <strong>{names.personName(a.user)}</strong> {a.role === 'reviewer' ? '(reviewer)' : ''}{' '}
              <span className="muted">
                {formatDateTime(a.assigned_at)} → {a.ended_at ? formatDateTime(a.ended_at) : 'now'}
                {a.end_reason && ` · ${a.end_reason}`}
              </span>
            </div>
          ))}
        </div>
      )}
      {(reviews.data ?? []).map((r) => (
        <div key={r.id} className="small" style={{ padding: '4px 0' }}>
          <strong>Review round {r.round}:</strong> {r.result === 'pass' ? 'approved' : 'sent back'} by {names.personName(r.reviewer)}
          {r.rating && ` · rated ${r.rating}/5`} <span className="muted">{formatDateTime(r.reviewed_at)}</span>
          {r.feedback && <div className="muted">“{r.feedback}”</div>}
        </div>
      ))}
      {(history.data ?? []).map((h, index) => (
        <div key={`${h.at}-${index}`} className="small" style={{ padding: '4px 0' }}>
          {h.from_status ? `${label(h.from_status)} → ` : ''}<strong>{label(h.to_status)}</strong>
          {h.by && ` by ${names.personName(h.by)}`} <span className="muted">{formatDateTime(h.at)}</span>
          {h.reason && <div className="muted">{h.reason}</div>}
        </div>
      ))}
    </div>
  )
}
