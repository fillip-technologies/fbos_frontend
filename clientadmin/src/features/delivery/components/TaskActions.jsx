import { useState } from 'react'
import { tasksApi } from '@/features/delivery/api.js'
import AssigneeOptions from '@/features/delivery/components/AssigneeOptions.jsx'
import { ReasonForm, ReviewForm, SubmitForm } from '@/features/delivery/components/TaskForms.jsx'
import useAssignablePeople from '@/features/delivery/useAssignablePeople.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const FINISHED = ['done', 'cancelled']

// The steps open to the signed-in user from the task's status. The backend decides in the
// end; this only offers what it would allow (the assignee starts and submits, anyone may take
// an unassigned task from the queue, the reviewer or a reviewer by permission reviews, task
// managers assign and cancel). `taskType` and `fields` come from the task's type.
export default function TaskActions({ orgId, task, setTask, names, taskType, fields }) {
  const { user: me } = useAuth()
  const [form, setForm] = useState(null) // 'assign' | 'block' | 'cancel' | 'review' | 'submit'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const isAssignee = task.assignee?.id === me?.id
  const canManage = hasAccess(me, ACCESS.manageTasks)
  const worksOn = isAssignee || canManage
  const mayReview = task.reviewer?.id === me?.id || hasAccess(me, ACCESS.reviewTasks)
  const open = !FINISHED.includes(task.status)
  const hasSla = Boolean(task.sla)

  const openForm = (name) => {
    setError(null)
    setForm(name)
  }

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
    !task.assignee && ['draft', 'open'].includes(task.status) && (
      <button key="claim" className="btn" disabled={busy} onClick={() => run(() => tasksApi.claim(orgId, task))}>Take it</button>
    ),
    isAssignee && ['assigned', 'rework'].includes(task.status) && (
      <button key="start" className="btn" disabled={busy} onClick={() => run(() => tasksApi.start(orgId, task))}>Start work</button>
    ),
    isAssignee && ['in_progress', 'rework'].includes(task.status) && (
      <button key="submit" className="btn" onClick={() => openForm('submit')}>
        {task.status === 'rework'
          ? 'Resubmit'
          : taskType?.requires_review ? 'Submit for review' : taskType?.outcomes?.length ? 'Log outcome' : 'Complete'}
      </button>
    ),
    mayReview && ['submitted', 'in_review'].includes(task.status) && (
      <button key="review" className="btn" onClick={() => openForm('review')}>Review</button>
    ),
    worksOn && task.status === 'blocked' && (
      <button key="unblock" className="btn" disabled={busy} onClick={() => run(() => tasksApi.unblock(orgId, task))}>Unblock</button>
    ),
    canManage && open && (
      <button key="assign" className="btn secondary" onClick={() => openForm('assign')}>{task.assignee ? 'Reassign' : 'Assign'}</button>
    ),
    worksOn && open && !['blocked', 'submitted', 'in_review'].includes(task.status) && (
      <button key="block" className="btn secondary" onClick={() => openForm('block')}>Mark blocked</button>
    ),
    canManage && open && (
      <button key="cancel" className="btn secondary" onClick={() => openForm('cancel')}>Cancel task</button>
    ),
  ].filter(Boolean)

  if (buttons.length === 0 && !error) return null
  const close = () => setForm(null)
  return (
    <div className="panel">
      {!form && <ErrorBanner error={error} />}
      <div className="row-actions" style={{ flexWrap: 'wrap' }}>{buttons}</div>
      {form === 'assign' && (
        <AssignForm orgId={orgId} task={task} names={names} busy={busy} error={error} onCancel={close} onSubmit={(body) => run(() => tasksApi.assign(orgId, task, body))} />
      )}
      {form === 'block' && (
        <ReasonForm
          label="What is it waiting for? *"
          action="Mark blocked"
          withSlaPause={hasSla}
          busy={busy}
          error={error}
          onCancel={close}
          onSubmit={(body) => run(() => tasksApi.block(orgId, task, body))}
        />
      )}
      {form === 'cancel' && (
        <ReasonForm
          label="Why cancel it? *"
          action="Cancel task"
          busy={busy}
          error={error}
          onCancel={close}
          onSubmit={(body) => run(() => tasksApi.cancel(orgId, task, body))}
        />
      )}
      {form === 'submit' && (
        <SubmitForm
          task={task}
          taskType={taskType}
          fields={fields}
          busy={busy}
          error={error}
          onCancel={close}
          onSubmit={(body) => run(() => tasksApi.submit(orgId, task, body))}
        />
      )}
      {form === 'review' && (
        <ReviewForm
          orgId={orgId}
          task={task}
          taskType={taskType}
          names={names}
          busy={busy}
          error={error}
          onCancel={close}
          // The review answers with the review, not the task: fetch the task again.
          onSubmit={(body) => run(() => tasksApi.review(orgId, task.id, body), { refetch: true })}
        />
      )}
    </div>
  )
}

function AssignForm({ orgId, task, names, busy, error, onCancel, onSubmit }) {
  const { user: me } = useAuth()
  const [assignee, setAssignee] = useState(task.assignee?.id || '')
  const [reviewer, setReviewer] = useState(task.reviewer?.id || '')
  const [note, setNote] = useState('')
  // Reviewers may be anyone; the assignee is someone the task's team may give its work to.
  const people = names.people || [me].filter(Boolean)
  const assignable = useAssignablePeople(orgId, task.owning_unit?.id)
  return (
    <form
      style={{ marginTop: 14 }}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ assignee_user_id: assignee, ...(reviewer ? { reviewer_user_id: reviewer } : {}), ...(note.trim() ? { note: note.trim() } : {}) })
      }}
    >
      <ErrorBanner error={error} />
      <div className="grid-3">
        <div className="field">
          <label htmlFor="assign_to">Assign to *</label>
          <select id="assign_to" required value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">— Choose —</option>
            <AssigneeOptions people={assignable.people} me={me} />
          </select>
          {assignable.teamOnly && <div className="hint">Only people in this team can be given its tasks.</div>}
          {assignable.error && <div className="hint">The team’s people couldn’t be loaded, so only you are offered. Try again shortly.</div>}
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
        <div className="field">
          <label htmlFor="assign_note">Why</label>
          <input id="assign_note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Assign</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Close</button>
      </div>
    </form>
  )
}
