import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import SlaBadge from '@/features/delivery/components/SlaBadge.jsx'
import TaskFilterBar, { NO_TASK_FILTERS } from '@/features/delivery/components/TaskFilterBar.jsx'
import { SubmitForm } from '@/features/delivery/components/TaskForms.jsx'
import { formatFieldValue, isEmpty } from '@/features/delivery/taskFields.js'
import { useEffectiveTaskFields } from '@/features/delivery/useTaskTypes.js'
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, formatDay, isOverdue, subjectLabel, subjectPath } from '@/features/delivery/utils.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// Working through tasks one at a time, most urgent first: a rep's calls and emails for the day,
// a service desk's tickets, a team's pool to take work from. The focused task shows what's
// needed to do it (who to call, where, the brief) and its outcome is logged in place, after
// which the next one comes up.
export default function WorkQueue({ orgId, names, taskTypes }) {
  const [mode, setMode] = useState('mine') // 'mine' | 'pool'
  const [filters, setFilters] = useState(NO_TASK_FILTERS)
  const [dueSoonOnly, setDueSoonOnly] = useState(false)
  const [focusId, setFocusId] = useState(null)
  const [doneCount, setDoneCount] = useState(0)
  const [notice, setNotice] = useState('')

  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const params = {
    ...filters,
    limit: 50,
    ...(mode === 'mine' ? { assignee: 'me' } : { unassigned: true, assignee: '' }),
    ...(dueSoonOnly ? { due_before: endOfToday.toISOString() } : {}),
  }
  const { data, error, loading, refreshing, reload } = useQuery(
    ['tasks', orgId, 'queue', params],
    ({ signal }) => tasksApi.queue(orgId, params, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const tasks = data?.data ?? []
  const focused = tasks.find((t) => t.id === focusId) ?? tasks[0] ?? null
  const position = focused ? tasks.indexOf(focused) : -1
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const typeOf = (task) => taskTypes.find((t) => t.code === task.task_type.code)

  function advance(fromTask) {
    const index = tasks.findIndex((t) => t.id === fromTask.id)
    const next = tasks[index + 1] ?? tasks[index - 1] ?? null
    setFocusId(next?.id ?? null)
  }

  function finished(task, message) {
    setDoneCount((n) => n + 1)
    setNotice(message)
    advance(task)
    invalidate(['tasks', orgId])
    invalidate(['task', orgId, task.id])
  }

  return (
    <>
      <div className="toolbar">
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'mine'} className={mode === 'mine' ? 'active' : ''} onClick={() => { setMode('mine'); setFocusId(null) }}>
            My queue
          </button>
          <button type="button" role="tab" aria-selected={mode === 'pool'} className={mode === 'pool' ? 'active' : ''} onClick={() => { setMode('pool'); setFocusId(null) }}>
            Team pool
          </button>
        </div>
        <label className="inline-check">
          <input type="checkbox" checked={dueSoonOnly} onChange={(e) => setDueSoonOnly(e.target.checked)} />
          Due today or overdue
        </label>
        {data && (
          <span className="muted small">
            {data.total} to do{doneCount > 0 && ` · ${doneCount} done this session`}
          </span>
        )}
      </div>
      <TaskFilterBar filters={filters} setFilter={setFilter} names={names} taskTypes={taskTypes} hide={['assignee', 'priority', ...(mode === 'mine' ? ['owning_unit_id'] : [])]} />
      {notice && <div className="alert success" role="status">{notice}</div>}
      <ErrorBanner error={error} onRetry={reload} />

      {loading ? (
        <PanelSkeleton />
      ) : tasks.length === 0 ? (
        <div className="panel center-note">
          {mode === 'mine' ? 'Your queue is clear.' : 'Nothing waiting in the pool. Pick a team to see its queue.'}
        </div>
      ) : (
        <div className={`queue${refreshing ? ' is-refreshing' : ''}`}>
          <ol className="queue-list" aria-label="Queue">
            {tasks.map((task) => (
              <li key={task.id}>
                <button type="button" className={`queue-item${focused?.id === task.id ? ' active' : ''}`} onClick={() => setFocusId(task.id)}>
                  <span className="queue-item-title">{task.title}</span>
                  <span className="queue-item-meta">
                    <span className="muted">{task.task_type.name}</span>
                    {task.due_at && <span className={isOverdue(task) ? 'overdue' : 'muted'}>{formatDay(task.due_at)}</span>}
                    <SlaBadge task={task} compact />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {focused && (
            <FocusedTask
              key={focused.id}
              orgId={orgId}
              task={focused}
              taskType={typeOf(focused)}
              names={names}
              pool={mode === 'pool'}
              position={position}
              total={tasks.length}
              onSkip={() => advance(focused)}
              onDone={(message) => finished(focused, message)}
            />
          )}
        </div>
      )}
    </>
  )
}

function FocusedTask({ orgId, task, taskType, names, pool, position, total, onSkip, onDone }) {
  const fields = useEffectiveTaskFields(orgId, task, taskType)
  const [logging, setLogging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const shown = fields.filter((f) => !isEmpty(task.attributes?.[f.key]))
  const path = subjectPath(task.subject)

  async function act(call) {
    setError(null)
    setBusy(true)
    try {
      await call()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const claim = () =>
    act(async () => {
      await tasksApi.claim(orgId, task)
      onDone(`Taken: “${task.title}” is in your queue.`)
    })

  // Logging an outcome on a task not yet started starts it first: a call is picked up and done in one go.
  const submit = (body) =>
    act(async () => {
      const working = ['assigned'].includes(task.status) ? await tasksApi.start(orgId, task) : task
      const saved = await tasksApi.submit(orgId, working, body)
      const next = saved.follow_up_task_id ? ' Next touch scheduled.' : ''
      onDone(`${saved.code} ${saved.status === 'done' ? 'done' : 'submitted'}.${next}`)
    })

  return (
    <section className="panel queue-focus" aria-label="Current task">
      <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="muted small">{position + 1} of {total}</span>
        <Link to={`/tasks/${task.id}`} className="small">Open the task →</Link>
      </div>
      <h2 style={{ margin: '6px 0 4px' }}>{task.title}</h2>
      <div className="row-actions" style={{ flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <span className="mono muted">{task.code}</span>
        <StatusBadge status={task.status} label={TASK_STATUS_LABELS[task.status]} />
        <StatusBadge status={task.priority} label={TASK_PRIORITY_LABELS[task.priority]} />
        <SlaBadge task={task} />
        {task.cadence_step > 1 && <span className="chip subtle">Touch {task.cadence_step}</span>}
        {task.subject && (path ? <Link className="small" to={path}>{subjectLabel(task.subject)} →</Link> : <span className="chip subtle">{subjectLabel(task.subject)}</span>)}
      </div>

      {shown.length > 0 && (
        <dl className="focus-fields">
          {shown.map((f) => (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd><FieldValue field={f} value={task.attributes[f.key]} /></dd>
            </div>
          ))}
        </dl>
      )}
      {task.description && <p style={{ whiteSpace: 'pre-wrap' }}>{task.description}</p>}
      {!logging && <ErrorBanner error={error} />}

      {pool ? (
        <div className="row-actions">
          <button className="btn" disabled={busy} aria-busy={busy} onClick={claim}>Take it</button>
          <button className="btn secondary" onClick={onSkip}>Skip</button>
        </div>
      ) : logging ? (
        <SubmitForm task={task} taskType={taskType} fields={fields} busy={busy} error={error} onCancel={() => setLogging(false)} onSubmit={submit} />
      ) : (
        <div className="row-actions">
          {task.status === 'assigned' && !taskType?.outcomes?.length && (
            <button className="btn" disabled={busy} onClick={() => act(async () => { await tasksApi.start(orgId, task); onDone(`${task.code} started.`) })}>Start</button>
          )}
          {['assigned', 'in_progress', 'rework'].includes(task.status) && (taskType?.outcomes?.length || task.status !== 'assigned') && (
            <button className="btn" onClick={() => setLogging(true)}>{taskType?.outcomes?.length ? 'Log outcome' : taskType?.requires_review ? 'Submit for review' : 'Complete'}</button>
          )}
          <button className="btn secondary" onClick={onSkip}>Skip</button>
          {task.assignee && <span className="muted small" style={{ alignSelf: 'center' }}>{names.personName(task.assignee)}</span>}
        </div>
      )}
    </section>
  )
}

// A value as something to act on: call a phone number, write to an address, open a link.
function FieldValue({ field, value }) {
  if (field.type === 'phone') return <a href={`tel:${String(value).replace(/[^+0-9]/g, '')}`}>{value}</a>
  if (field.type === 'email') return <a href={`mailto:${value}`}>{value}</a>
  if (field.type === 'url') return <a href={value} target="_blank" rel="noreferrer">{value}</a>
  return <span style={{ whiteSpace: 'pre-wrap' }}>{formatFieldValue(field, value)}</span>
}
