import { useState } from 'react'
import { tasksApi } from '@/features/delivery/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const FINISHED = ['done', 'cancelled']

// The steps open to the signed-in user from the task's status. The backend decides in the
// end; this only offers what it would allow (the assignee starts and submits, the reviewer
// or a reviewer by permission reviews, task managers assign and cancel).
export default function TaskActions({ orgId, task, setTask, names }) {
  const { user: me } = useAuth()
  const [form, setForm] = useState(null) // 'assign' | 'block' | 'cancel' | 'review'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const isAssignee = task.assignee?.id === me?.id
  const canManage = hasAccess(me, ACCESS.manageTasks)
  const worksOn = isAssignee || canManage
  const mayReview = task.reviewer?.id === me?.id || hasAccess(me, ACCESS.reviewTasks)
  const open = !FINISHED.includes(task.status)

  async function run(call, { refetch = false } = {}) {
    setError(null)
    setBusy(true)
    try {
      const result = await call()
      setTask(refetch ? await tasksApi.get(orgId, task.id) : result)
      setForm(null)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const buttons = [
    isAssignee && ['assigned', 'rework'].includes(task.status) && (
      <button key="start" className="btn" disabled={busy} onClick={() => run(() => tasksApi.start(orgId, task))}>Start work</button>
    ),
    isAssignee && ['in_progress', 'rework'].includes(task.status) && (
      <button key="submit" className="btn" disabled={busy} onClick={() => run(() => tasksApi.submit(orgId, task, {}))}>
        {task.status === 'rework' ? 'Resubmit' : 'Submit'}
      </button>
    ),
    mayReview && ['submitted', 'in_review'].includes(task.status) && (
      <button key="review" className="btn" onClick={() => setForm('review')}>Review</button>
    ),
    worksOn && task.status === 'blocked' && (
      <button key="unblock" className="btn" disabled={busy} onClick={() => run(() => tasksApi.unblock(orgId, task))}>Unblock</button>
    ),
    canManage && open && (
      <button key="assign" className="btn secondary" onClick={() => setForm('assign')}>{task.assignee ? 'Reassign' : 'Assign'}</button>
    ),
    worksOn && open && task.status !== 'blocked' && (
      <button key="block" className="btn secondary" onClick={() => setForm('block')}>Mark blocked</button>
    ),
    canManage && open && (
      <button key="cancel" className="btn secondary" onClick={() => setForm('cancel')}>Cancel task</button>
    ),
  ].filter(Boolean)

  if (buttons.length === 0 && !error) return null
  return (
    <div className="panel">
      <ErrorBanner error={error} />
      <div className="row-actions" style={{ flexWrap: 'wrap' }}>{buttons}</div>
      {form === 'assign' && (
        <AssignForm
          task={task}
          names={names}
          busy={busy}
          onCancel={() => setForm(null)}
          onSubmit={(body) => run(() => tasksApi.assign(orgId, task, body))}
        />
      )}
      {form === 'block' && (
        <ReasonForm
          label="What is it waiting for? *"
          action="Mark blocked"
          busy={busy}
          onCancel={() => setForm(null)}
          onSubmit={(reason) => run(() => tasksApi.block(orgId, task, { reason }))}
        />
      )}
      {form === 'cancel' && (
        <ReasonForm
          label="Why cancel it? *"
          action="Cancel task"
          busy={busy}
          onCancel={() => setForm(null)}
          onSubmit={(reason) => run(() => tasksApi.cancel(orgId, task, { reason }))}
        />
      )}
      {form === 'review' && (
        <ReviewForm
          busy={busy}
          onCancel={() => setForm(null)}
          // The review answers with the review, not the task: fetch the task again.
          onSubmit={(body) => run(() => tasksApi.review(orgId, task.id, body), { refetch: true })}
        />
      )}
    </div>
  )
}

function AssignForm({ task, names, busy, onCancel, onSubmit }) {
  const { user: me } = useAuth()
  const [assignee, setAssignee] = useState(task.assignee?.id || '')
  const [reviewer, setReviewer] = useState(task.reviewer?.id || '')
  const people = names.people || [me].filter(Boolean)
  return (
    <form
      style={{ marginTop: 14 }}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ assignee_user_id: assignee, ...(reviewer ? { reviewer_user_id: reviewer } : {}) })
      }}
    >
      <div className="grid-2">
        <div className="field">
          <label htmlFor="assign_to">Assign to *</label>
          <select id="assign_to" required value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">— Choose —</option>
            {people.map((u) => (
              <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="review_by">Reviewer</label>
          <select id="review_by" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
            <option value="">— Keep as is —</option>
            {people.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Assign</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Close</button>
      </div>
    </form>
  )
}

function ReasonForm({ label, action, busy, onCancel, onSubmit }) {
  const [reason, setReason] = useState('')
  return (
    <form
      style={{ marginTop: 14 }}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(reason.trim())
      }}
    >
      <div className="field">
        <label htmlFor="action_reason">{label}</label>
        <input id="action_reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{action}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Close</button>
      </div>
    </form>
  )
}

function ReviewForm({ busy, onCancel, onSubmit }) {
  const [result, setResult] = useState('pass')
  const [rating, setRating] = useState('')
  const [feedback, setFeedback] = useState('')
  return (
    <form
      style={{ marginTop: 14 }}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ result, ...(rating ? { rating: Number(rating) } : {}), ...(feedback.trim() ? { feedback: feedback.trim() } : {}) })
      }}
    >
      <div className="grid-2">
        <div className="field">
          <label htmlFor="review_result">Outcome</label>
          <select id="review_result" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="pass">Approve: the task is done</option>
            <option value="fail">Send back for rework</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="review_rating">Rating</label>
          <select id="review_rating" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">—</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="review_feedback">Feedback{result === 'fail' ? ' *' : ''}</label>
        <textarea id="review_feedback" rows={2} required={result === 'fail'} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Save review</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Close</button>
      </div>
    </form>
  )
}
