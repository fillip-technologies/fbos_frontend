import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { boardsApi, tasksApi } from '@/features/delivery/api.js'
import {
  DIALOG_STEPS,
  anchorsFor,
  columnCount,
  dropFor,
  estimateHours,
  movesFor,
  placeMoved,
  takesNewItems,
} from '@/features/delivery/board.js'
import Dialog from '@/features/delivery/components/Dialog.jsx'
import TaskCard from '@/features/delivery/components/TaskCard.jsx'
import TaskFilterBar, { NO_TASK_FILTERS } from '@/features/delivery/components/TaskFilterBar.jsx'
import { BoardDialog } from '@/features/delivery/components/TaskBoard.jsx'
import useTaskTypes from '@/features/delivery/useTaskTypes.js'
import { TASK_STATUS_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { friendlyMessage } from '@/shared/api/errors.js'
import { invalidate, prefetch, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

// A project's or a customer's board: its own columns, each holding some task statuses, with
// "count / limit", the estimate total and a description. Cards are dragged to a place in a
// column (a line shows where) or moved with their "Move…" menu. A column with another status
// takes the task's real step (start, submit, review…), with the same dialogs as the Tasks board.
// `scope`: { work_unit_id } or { client_id }.
export default function BoardView({ orgId, scope, names, intro }) {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const { types: taskTypes } = useTaskTypes(orgId)
  const ctx = { me, canManage: hasAccess(me, ACCESS.manageTasks), canReview: hasAccess(me, ACCESS.reviewTasks) }
  const [filters, setFilters] = useState(NO_TASK_FILTERS)
  const [moved, setMoved] = useState({}) // task id -> { columnId, anchors, status }
  const [dragging, setDragging] = useState(null)
  const [drop, setDrop] = useState(null) // { columnId, index }
  const [dialog, setDialog] = useState(null) // { task, kind, target: { columnId, anchors } }
  const [editing, setEditing] = useState(null) // a column, or {} for a new one
  const [adding, setAdding] = useState(null) // column id with the "+ Add item" input open
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const scopeKey = scope.work_unit_id ? { project: scope.work_unit_id } : { customer: scope.client_id }
  const boards = useQuery(['boards', orgId, scopeKey], ({ signal }) => boardsApi.list(orgId, scope, { signal }), {
    enabled: Boolean(orgId),
  })
  const boardId = boards.data?.[0]?.id
  const params = { ...filters, per_column: 50 }
  const { data: board, error, loading, refreshing, reload } = useQuery(
    ['board', orgId, boardId, params],
    ({ signal }) => boardsApi.get(orgId, boardId, params, { signal }),
    { enabled: Boolean(orgId && boardId), keepPrevious: true }
  )
  // Fresh columns replace the moves shown ahead of them.
  useEffect(() => setMoved({}), [board])

  const columns = placeMoved(board?.columns ?? [], moved)
  const typeOf = (task) => taskTypes.find((t) => t.code === task.task_type.code)
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const refresh = () => invalidate(['board', orgId, boardId])
  const canAdd = Boolean(board?.work_unit_id) && ctx.canManage

  async function place(task, columnId, anchors, status) {
    setActionError(null)
    setMoved((m) => ({ ...m, [task.id]: { columnId, anchors, status } }))
    try {
      await boardsApi.place(orgId, boardId, task, { column_id: columnId, ...anchors })
      if (status) {
        invalidate(['task', orgId, task.id])
        invalidate(['tasks', orgId])
      }
      refresh()
    } catch (err) {
      setMoved(({ [task.id]: _, ...rest }) => rest)
      setActionError(err)
    }
  }

  // Into `column` at `index`: its place only, a step, or a step's dialog first.
  function moveTo(task, column, index) {
    const how = dropFor(task, column, movesFor(task, ctx))
    if (!how) return
    const anchors = anchorsFor(column.tasks, task.id, index)
    if (DIALOG_STEPS.includes(how.kind)) {
      setDialog({ task, kind: how.kind, target: { columnId: column.id, anchors } })
      return
    }
    place(task, column.id, anchors, how.kind === 'place' ? undefined : how.status)
  }

  async function finishDialog(call) {
    setActionError(null)
    setBusy(true)
    try {
      await call()
      // Then the card goes where it was dropped, if its new status belongs there.
      const fresh = await tasksApi.get(orgId, dialog.task.id)
      const target = columns.find((c) => c.id === dialog.target.columnId)
      if (target?.statuses.includes(fresh.status)) {
        await boardsApi.place(orgId, boardId, fresh, { column_id: target.id, ...dialog.target.anchors }).catch(() => null)
      }
      invalidate(['task', orgId, dialog.task.id])
      invalidate(['tasks', orgId])
      refresh()
      setDialog(null)
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }

  // The keyboard way: each step or column the card can go to, and up / down in its column.
  function menuOptions(task, column, index) {
    const options = []
    if (index > 0) options.push({ label: 'Move up', run: () => moveTo(task, column, index - 1) })
    if (index < column.tasks.length - 1) options.push({ label: 'Move down', run: () => moveTo(task, column, index + 2) })
    for (const move of movesFor(task, ctx)) {
      const target = column.statuses.includes(move.status) ? column : columns.find((c) => c.statuses.includes(move.status))
      if (target) options.push({ label: `${move.label} (${target.name})`, run: () => moveTo(task, target, 0) })
    }
    for (const other of columns) {
      if (other.id !== column.id && other.statuses.includes(task.status)) {
        options.push({ label: `Move to ${other.name}`, run: () => moveTo(task, other, 0) })
      }
    }
    return options
  }

  if (boards.error) return <ErrorBanner error={boards.error} onRetry={boards.reload} />
  if (boards.loading || loading || !board) return error ? <ErrorBanner error={error} onRetry={reload} /> : <PanelSkeleton />

  return (
    <>
      {intro && <p className="muted small" style={{ margin: '0 0 10px' }}>{intro}</p>}
      <TaskFilterBar filters={filters} setFilter={setFilter} names={names} taskTypes={taskTypes} />
      {!dialog && !editing && <ErrorBanner error={actionError || error} onRetry={actionError ? undefined : reload} />}
      {board.uncovered_statuses.length > 0 && (
        <p className="muted small">
          No column holds {board.uncovered_statuses.map((s) => TASK_STATUS_LABELS[s] || s).join(', ')} tasks, so they aren't on this board.
        </p>
      )}

      <div className={`board${refreshing ? ' is-refreshing' : ''}`}>
        {columns.map((column) => {
          const droppable = Boolean(dragging) && Boolean(dropFor(dragging, column, movesFor(dragging, ctx)))
          const dropHere = drop?.columnId === column.id && droppable
          const estimate = estimateHours(column.estimate_minutes_total)
          return (
            <section
              key={column.id}
              className={`board-column${droppable ? ' can-drop' : ''}${dropHere ? ' drop-over' : ''}`}
              aria-label={column.name}
              onDragOver={(e) => {
                if (!droppable) return
                e.preventDefault()
                if (drop?.columnId !== column.id || drop.index == null) setDrop({ columnId: column.id, index: column.tasks.length })
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDrop((d) => (d?.columnId === column.id ? null : d))
              }}
              onDrop={(e) => {
                e.preventDefault()
                const task = dragging
                const index = drop?.columnId === column.id ? drop.index : column.tasks.length
                setDragging(null)
                setDrop(null)
                if (task && droppable) moveTo(task, column, index)
              }}
            >
              <header className="board-column-head stacked">
                <div className="board-column-title">
                  <span>{column.name}</span>
                  <span className={`count${column.over_limit ? ' over' : ''}`} title={column.wip_limit ? `Limit: ${column.wip_limit}` : undefined}>
                    {columnCount(column)}
                  </span>
                  {board.can_configure && (
                    <button type="button" className="board-column-menu" aria-label={`Edit column ${column.name}`} onClick={() => setEditing(column)}>
                      ⋯
                    </button>
                  )}
                </div>
                {estimate && <div className="board-column-meta">Estimate: {estimate}</div>}
                {column.description && <div className="board-column-desc">{column.description}</div>}
              </header>
              <div className="board-cards">
                {column.tasks.length === 0 && !dropHere && <div className="muted small board-empty">Nothing here</div>}
                {column.tasks.map((task, index) => {
                  const options = menuOptions(task, column, index)
                  return (
                    <div
                      key={task.id}
                      className="board-slot"
                      onDragOver={(e) => {
                        if (!droppable) return
                        e.preventDefault()
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const at = index + (e.clientY > rect.top + rect.height / 2 ? 1 : 0)
                        if (drop?.columnId !== column.id || drop.index !== at) setDrop({ columnId: column.id, index: at })
                      }}
                    >
                      {dropHere && drop.index === index && <div className="board-drop-line" />}
                      <TaskCard
                        task={task}
                        taskType={typeOf(task)}
                        names={names}
                        onOpen={() => navigate(`/tasks/${task.id}`)}
                        dragProps={{
                          draggable: true,
                          onDragStart: (e) => {
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', task.id)
                            setDragging(task)
                          },
                          onDragEnd: () => {
                            setDragging(null)
                            setDrop(null)
                          },
                          onMouseEnter: () => prefetch(['task', orgId, task.id], ({ signal }) => tasksApi.get(orgId, task.id, { signal })),
                        }}
                        footer={
                          options.length > 0 && (
                            <select
                              className="move-menu"
                              aria-label={`Move ${task.code}`}
                              value=""
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              onChange={(e) => options[Number(e.target.value)]?.run()}
                            >
                              <option value="">Move…</option>
                              {options.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
                            </select>
                          )
                        }
                      />
                    </div>
                  )
                })}
                {dropHere && drop.index >= column.tasks.length && <div className="board-drop-line" />}
                {column.has_more && <div className="muted small board-empty">+ {column.count - column.tasks.length} more: narrow the filters</div>}
              </div>
              {canAdd && takesNewItems(column) && (
                <AddItem
                  open={adding === column.id}
                  onOpen={() => setAdding(column.id)}
                  onClose={() => setAdding(null)}
                  onAdd={async (title) => {
                    await boardsApi.addItem(orgId, boardId, column.id, { title })
                    invalidate(['tasks', orgId])
                    refresh()
                  }}
                />
              )}
            </section>
          )
        })}
        {board.can_configure && (
          <button type="button" className="board-add-column" onClick={() => setEditing({})}>
            + Column
          </button>
        )}
      </div>

      {dialog && (
        <BoardDialog
          orgId={orgId}
          dialog={dialog}
          taskType={typeOf(dialog.task)}
          names={names}
          busy={busy}
          error={actionError}
          onClose={() => { setDialog(null); setActionError(null) }}
          finish={finishDialog}
        />
      )}
      {editing && (
        <ColumnDialog
          orgId={orgId}
          board={board}
          column={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </>
  )
}

// "+ Add item": a title, Enter to add, Esc to stop.
function AddItem({ open, onOpen, onClose, onAdd }) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  if (!open) {
    return (
      <button type="button" className="board-add" onClick={onOpen}>
        + Add item
      </button>
    )
  }
  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onAdd(title.trim())
      setTitle('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="board-add-form" onSubmit={submit}>
      <input
        autoFocus
        aria-label="New task title"
        placeholder="Title, then Enter"
        value={title}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />
      {error && <div className="field-error">{friendlyMessage(error)}</div>}
      <div className="row-actions">
        <button type="submit" className="btn small-btn" disabled={busy || !title.trim()} aria-busy={busy}>Add</button>
        <button type="button" className="btn secondary small-btn" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

const STATUS_CHOICES = Object.keys(TASK_STATUS_LABELS)

// Add or change a column: its name, description, the statuses it holds and its item limit;
// for an existing one also its place on the board, and removing it.
function ColumnDialog({ orgId, board, column, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: column?.name ?? '',
    description: column?.description ?? '',
    statuses: column?.statuses ?? [],
    wip_limit: column?.wip_limit ? String(column.wip_limit) : '',
    is_default_for_status: column?.is_default_for_status ?? false,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const toggle = (status) =>
    set('statuses', form.statuses.includes(status) ? form.statuses.filter((s) => s !== status) : [...form.statuses, status])
  const position = column ? board.columns.findIndex((c) => c.id === column.id) : -1

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
    const limit = form.wip_limit.trim() ? Number(form.wip_limit) : null
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      statuses: STATUS_CHOICES.filter((s) => form.statuses.includes(s)),
      wip_limit: limit,
      is_default_for_status: form.is_default_for_status,
    }
    run(() => (column ? boardsApi.updateColumn(orgId, board.id, column.id, body) : boardsApi.addColumn(orgId, board.id, body)))
  }

  function shift(by) {
    const ids = board.columns.map((c) => c.id)
    const [id] = ids.splice(position, 1)
    ids.splice(position + by, 0, id)
    run(() => boardsApi.orderColumns(orgId, board.id, ids))
  }

  const limitValid = !form.wip_limit.trim() || (Number.isInteger(Number(form.wip_limit)) && Number(form.wip_limit) >= 1)
  const valid = form.name.trim() && form.statuses.length > 0 && limitValid
  return (
    <Dialog title={column ? `Edit ${column.name}` : 'New column'} onClose={onClose}>
      <form onSubmit={save}>
        <ErrorBanner error={error} />
        <div className="field">
          <label htmlFor="column_name">Name *</label>
          <input id="column_name" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="column_description">Description</label>
          <input
            id="column_description"
            value={form.description}
            maxLength={500}
            placeholder="What belongs in this column"
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <div className="field">
          <span>Tasks it holds *</span>
          <div className="board-status-choices">
            {STATUS_CHOICES.map((status) => (
              <label key={status} className="inline-check">
                <input type="checkbox" checked={form.statuses.includes(status)} onChange={() => toggle(status)} />
                {TASK_STATUS_LABELS[status]}
              </label>
            ))}
          </div>
          <p className="muted small">
            A card moved between columns with the same status only changes where it sits. A column with another status moves the task on to its next step.
          </p>
        </div>
        <div className="field">
          <label htmlFor="column_limit">Item limit</label>
          <input
            id="column_limit"
            type="number"
            min="1"
            max="999"
            value={form.wip_limit}
            placeholder="No limit"
            onChange={(e) => set('wip_limit', e.target.value)}
          />
          {!limitValid && <div className="field-error">A whole number from 1</div>}
        </div>
        <label className="inline-check" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={form.is_default_for_status} onChange={(e) => set('is_default_for_status', e.target.checked)} />
          Tasks that reach these statuses elsewhere show here
        </label>
        <div className="row-actions">
          <button type="submit" className="btn" disabled={busy || !valid} aria-busy={busy}>{column ? 'Save' : 'Add column'}</button>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
      {column && (
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn secondary" disabled={busy || position <= 0} onClick={() => shift(-1)}>← Move left</button>
          <button type="button" className="btn secondary" disabled={busy || position >= board.columns.length - 1} onClick={() => shift(1)}>Move right →</button>
          {confirmDelete ? (
            <button type="button" className="btn danger" disabled={busy} onClick={() => run(() => boardsApi.removeColumn(orgId, board.id, column.id))}>
              Yes, delete it
            </button>
          ) : (
            <button type="button" className="btn secondary" disabled={busy || board.columns.length <= 1} onClick={() => setConfirmDelete(true)}>
              Delete column
            </button>
          )}
        </div>
      )}
      {confirmDelete && <p className="muted small">Its cards go back to the column their status belongs to.</p>}
    </Dialog>
  )
}
