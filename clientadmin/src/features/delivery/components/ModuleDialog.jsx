import { useState } from 'react'
import { Link } from 'react-router-dom'
import { boardsApi, tasksApi } from '@/features/delivery/api.js'
import { estimateHours, hoursToMinutes, parseLabels } from '@/features/delivery/board.js'
import Dialog from '@/features/delivery/components/Dialog.jsx'
import { SUBJECT_TYPES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const toForm = (m) => ({
  title: m?.title ?? '',
  description: m?.description ?? '',
  owner_user_id: m?.owner?.id ?? '',
  estimate: m?.estimate_minutes ? String(Math.round((m.estimate_minutes / 60) * 100) / 100) : '',
  due_on: m?.due_on ?? '',
  priority: m?.priority ?? 'p3',
  labels: (m?.labels ?? []).join(', '),
})

// Add or change a module: title, description, owner, estimate (hours), due date, priority and
// labels; for an existing one also the project's tasks linked to it, and removing it.
// `module`: the module, or null for a new one in `columnId`.
export default function ModuleDialog({ orgId, boardId, workUnitId, module, columnId, canEdit, names, onClose, onSaved }) {
  const { user: me } = useAuth()
  const [form, setForm] = useState(() => toForm(module))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const estimateValid = !form.estimate.trim() || hoursToMinutes(form.estimate) !== null

  const detail = useQuery(
    ['board-module', orgId, boardId, module?.id],
    ({ signal }) => boardsApi.module(orgId, boardId, module.id, { signal }),
    { enabled: Boolean(orgId && module?.id) }
  )
  const current = detail.data ?? module

  async function run(call) {
    setBusy(true)
    setError(null)
    try {
      await call()
      onSaved()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  function save(e) {
    e.preventDefault()
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      owner_user_id: form.owner_user_id || null,
      estimate_minutes: hoursToMinutes(form.estimate),
      due_on: form.due_on || null,
      priority: form.priority,
      labels: parseLabels(form.labels),
    }
    run(() => (module ? boardsApi.updateModule(orgId, boardId, current, body) : boardsApi.addModule(orgId, boardId, { column_id: columnId, ...body })))
  }

  const people = names.people ?? []
  const title = module ? module.title : 'New module'
  if (!canEdit && module) {
    return (
      <Dialog title={title} onClose={onClose} wide>
        <ModuleSummary module={current} names={names} />
        <LinkedTasks orgId={orgId} boardId={boardId} workUnitId={workUnitId} module={current} detail={detail} canEdit={false} />
      </Dialog>
    )
  }
  return (
    <Dialog title={title} onClose={onClose} wide={Boolean(module)}>
      <form onSubmit={save}>
        <ErrorBanner error={error} />
        <div className="field">
          <label htmlFor="module_title">Title *</label>
          <input id="module_title" value={form.title} maxLength={255} autoFocus onChange={(e) => set('title', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="module_description">Description</label>
          <textarea id="module_description" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="grid-2">
          {people.length > 0 && (
            <div className="field">
              <label htmlFor="module_owner">Owner</label>
              <select id="module_owner" value={form.owner_user_id} onChange={(e) => set('owner_user_id', e.target.value)}>
                <option value="">No owner</option>
                {form.owner_user_id && !people.some((p) => p.id === form.owner_user_id) && (
                  <option value={form.owner_user_id}>{names.personName(form.owner_user_id)}</option>
                )}
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="module_priority">Priority</label>
            <select id="module_priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="module_estimate">Estimate (hours)</label>
            <input id="module_estimate" inputMode="decimal" placeholder="e.g. 16" value={form.estimate} onChange={(e) => set('estimate', e.target.value)} />
            {!estimateValid && <div className="field-error">Hours as a number, e.g. 6 or 1.5</div>}
          </div>
          <div className="field">
            <label htmlFor="module_due">Due date</label>
            <input id="module_due" type="date" value={form.due_on} onChange={(e) => set('due_on', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="module_labels">Labels</label>
          <input id="module_labels" placeholder="Separated by commas: backend, api" value={form.labels} onChange={(e) => set('labels', e.target.value)} />
        </div>
        <div className="row-actions">
          <button type="submit" className="btn" disabled={busy || !form.title.trim() || !estimateValid} aria-busy={busy}>
            {module ? 'Save' : 'Add module'}
          </button>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          {module &&
            (confirmDelete ? (
              <button type="button" className="btn danger" disabled={busy} onClick={() => run(() => boardsApi.removeModule(orgId, boardId, module.id))}>
                Yes, delete it
              </button>
            ) : (
              <button type="button" className="btn secondary" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete module</button>
            ))}
        </div>
        {confirmDelete && <p className="muted small">Its tasks stay as they are, just no longer linked to it.</p>}
      </form>
      {module && hasAccess(me, ACCESS.tasks) && (
        <LinkedTasks orgId={orgId} boardId={boardId} workUnitId={workUnitId} module={current} detail={detail} canEdit onChanged={detail.reload} />
      )}
    </Dialog>
  )
}

function ModuleSummary({ module, names }) {
  const estimate = estimateHours(module.estimate_minutes)
  return (
    <div style={{ marginBottom: 12 }}>
      {module.description && <p style={{ whiteSpace: 'pre-wrap' }}>{module.description}</p>}
      <p className="muted small">
        {module.owner ? `Owner: ${names.personName(module.owner)}` : 'No owner'}
        {estimate && ` · Estimate: ${estimate}`}
        {module.due_on && ` · Due ${module.due_on}`}
        {` · ${TASK_PRIORITY_LABELS[module.priority]}`}
        {module.labels.length > 0 && ` · ${module.labels.join(', ')}`}
      </p>
    </div>
  )
}

// The project's tasks linked to the module; link another or unlink one. Tasks never change.
function LinkedTasks({ orgId, boardId, workUnitId, module, detail, canEdit, onChanged }) {
  const [picked, setPicked] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const projectTasks = useQuery(
    ['tasks', orgId, { project: workUnitId, forModule: true }],
    ({ signal }) => tasksApi.list(orgId, { limit: 100, subject_type: SUBJECT_TYPES.project, subject_id: workUnitId }, { signal }),
    { enabled: Boolean(orgId && workUnitId && canEdit) }
  )
  const linked = detail.data?.tasks ?? []
  const linkedIds = new Set(linked.map((t) => t.id))
  const choices = (projectTasks.data?.data ?? []).filter((t) => !linkedIds.has(t.id) && t.status !== 'cancelled')

  async function change(call) {
    setBusy(true)
    setError(null)
    try {
      await call()
      setPicked('')
      onChanged?.()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Tasks in this module</h3>
      <ErrorBanner error={error || detail.error} />
      {detail.loading && <p className="muted small">Loading…</p>}
      {!detail.loading && linked.length === 0 && <p className="muted small">No tasks linked yet. Linking a task doesn't change it.</p>}
      {linked.map((task) => (
        <div key={task.id} className="row-actions" style={{ alignItems: 'center', padding: '4px 0' }}>
          <Link to={`/tasks/${task.id}`} className="mono small">{task.code}</Link>
          <span style={{ flex: 1 }}>{task.title}</span>
          <StatusBadge status={task.status} label={TASK_STATUS_LABELS[task.status]} />
          {canEdit && (
            <button
              type="button"
              className="btn secondary small-btn"
              disabled={busy}
              onClick={() => change(() => boardsApi.unlinkTask(orgId, boardId, module.id, task.id))}
            >
              Unlink
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="row-actions" style={{ marginTop: 10 }}>
          <select aria-label="Task to link" value={picked} onChange={(e) => setPicked(e.target.value)} disabled={busy || projectTasks.loading}>
            <option value="">{choices.length ? 'Link a task of this project…' : 'No other tasks to link'}</option>
            {choices.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.title}</option>)}
          </select>
          <button
            type="button"
            className="btn secondary"
            disabled={busy || !picked}
            onClick={() => change(() => boardsApi.linkTask(orgId, boardId, module.id, picked))}
          >
            Link
          </button>
        </div>
      )}
    </div>
  )
}
