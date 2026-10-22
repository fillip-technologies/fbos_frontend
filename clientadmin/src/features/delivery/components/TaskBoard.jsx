import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import Dialog from '@/features/delivery/components/Dialog.jsx'
import TaskCard from '@/features/delivery/components/TaskCard.jsx'
import TaskFilterBar, { NO_TASK_FILTERS } from '@/features/delivery/components/TaskFilterBar.jsx'
import { ReasonForm, ReviewForm, SubmitForm } from '@/features/delivery/components/TaskForms.jsx'
import { useEffectiveTaskFields } from '@/features/delivery/useTaskTypes.js'
import { TASK_PRIORITY_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { invalidate, prefetch, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const GROUPINGS = [
  ['status', 'Status'],
  ['assignee', 'Assignee'],
  ['priority', 'Priority'],
  ['task_type', 'Task type'],
]

// The steps a card can take on the status board, as the backend's state machine allows them
// for this user: { to: column, label, kind }. 'dialog' kinds ask for more first.
export function movesFor(task, { me, canManage, canReview }) {
  const isAssignee = task.assignee?.id === me?.id
  const worksOn = isAssignee || canManage
  const mayReview = task.reviewer?.id === me?.id || canReview
  const finishColumn = task.task_type.requires_review ? 'in_review' : 'done'
  const moves = []
  if (!task.assignee && ['draft', 'open'].includes(task.status)) moves.push({ to: 'in_progress', label: 'Take it and start', kind: 'claim_start' })
  if (isAssignee && ['assigned', 'rework'].includes(task.status)) moves.push({ to: 'in_progress', label: 'Start work', kind: 'start' })
  if (isAssignee && ['in_progress', 'rework'].includes(task.status)) moves.push({ to: finishColumn, label: 'Submit…', kind: 'submit' })
  if (worksOn && ['open', 'assigned', 'in_progress', 'rework'].includes(task.status)) moves.push({ to: 'blocked', label: 'Mark blocked…', kind: 'block' })
  if (worksOn && task.status === 'blocked') moves.push({ to: 'in_progress', label: 'Unblock', kind: 'unblock' })
  if (mayReview && ['submitted', 'in_review'].includes(task.status)) {
    moves.push({ to: 'done', label: 'Approve…', kind: 'approve' }, { to: 'todo', label: 'Send back…', kind: 'send_back' })
  }
  return moves
}

// The tasks as columns. Grouped by status, cards move between columns by dragging or with
// their "Move" menu; each move is the task's real next step (start, submit, review, block),
// shown at once and undone if the backend refuses it.
export default function TaskBoard({ orgId, names, taskTypes }) {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const ctx = { me, canManage: hasAccess(me, ACCESS.manageTasks), canReview: hasAccess(me, ACCESS.reviewTasks) }
  const [filters, setFilters] = useState(NO_TASK_FILTERS)
  const [groupBy, setGroupBy] = useState('status')
  const [moved, setMoved] = useState({}) // task id -> column it was just moved to
  const [dragging, setDragging] = useState(null)
  const [overColumn, setOverColumn] = useState(null)
  const [dialog, setDialog] = useState(null) // { task, kind }
  const [busy, setBusy] = useState(false)
  const [moveError, setMoveError] = useState(null)

  const params = { ...filters, group_by: groupBy, per_column: 50 }
  const { data, error, loading, refreshing, reload } = useQuery(
    ['tasks', orgId, 'board', params],
    ({ signal }) => tasksApi.board(orgId, params, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  // Fresh columns replace the moves shown ahead of them.
  useEffect(() => setMoved({}), [data])
  const byStatus = groupBy === 'status'

  const columns = placeCards(data?.columns ?? [], byStatus ? moved : {})
  const typeOf = (task) => taskTypes.find((t) => t.code === task.task_type.code)

  const refresh = () => invalidate(['tasks', orgId])

  async function perform(task, move) {
    setMoveError(null)
    if (['submit', 'block', 'approve', 'send_back'].includes(move.kind)) {
      setDialog({ task, kind: move.kind })
      return
    }
    setMoved((m) => ({ ...m, [task.id]: move.to }))
    try {
      if (move.kind === 'claim_start') {
        const claimed = await tasksApi.claim(orgId, task)
        await tasksApi.start(orgId, claimed)
      }
      if (move.kind === 'start') await tasksApi.start(orgId, task)
      if (move.kind === 'unblock') await tasksApi.unblock(orgId, task)
      invalidate(['task', orgId, task.id])
      refresh()
    } catch (err) {
      setMoved((m) => {
        const { [task.id]: _, ...rest } = m
        return rest
      })
      setMoveError(err)
    }
  }

  async function finishDialog(call) {
    setMoveError(null)
    setBusy(true)
    try {
      await call()
      invalidate(['task', orgId, dialog.task.id])
      refresh()
      setDialog(null)
    } catch (err) {
      setMoveError(err)
    } finally {
      setBusy(false)
    }
  }

  const dropMove = (columnKey) => (dragging ? movesFor(dragging, ctx).find((m) => m.to === columnKey) : null)

  return (
    <>
      <TaskFilterBar filters={filters} setFilter={setFilter} names={names} taskTypes={taskTypes}>
        <label className="inline-check">
          Group by
          <select value={groupBy} onChange={(e) => { setMoved({}); setGroupBy(e.target.value) }}>
            {GROUPINGS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </TaskFilterBar>
      {!dialog && <ErrorBanner error={moveError || error} onRetry={moveError ? undefined : reload} />}
      {byStatus && <p className="muted small" style={{ margin: '-4px 0 10px' }}>Drag a card to its next step, or use its Move menu. Done shows the last 14 days.</p>}

      {loading ? (
        <PanelSkeleton />
      ) : columns.length === 0 ? (
        <div className="panel center-note">No open tasks match.</div>
      ) : (
        <div className={`board${refreshing ? ' is-refreshing' : ''}`}>
          {columns.map((column) => {
            const droppable = byStatus && Boolean(dropMove(column.key))
            return (
              <section
                key={column.key}
                className={`board-column${droppable ? ' can-drop' : ''}${overColumn === column.key && droppable ? ' drop-over' : ''}`}
                aria-label={columnLabel(column, groupBy, names)}
                onDragOver={(e) => {
                  if (!droppable) return
                  e.preventDefault()
                  setOverColumn(column.key)
                }}
                onDragLeave={() => setOverColumn((c) => (c === column.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault()
                  const move = dropMove(column.key)
                  const task = dragging
                  setDragging(null)
                  setOverColumn(null)
                  if (move && task) perform(task, move)
                }}
              >
                <header className="board-column-head">
                  <span>{columnLabel(column, groupBy, names)}</span>
                  <span className="count">{column.count}</span>
                </header>
                <div className="board-cards">
                  {column.tasks.length === 0 && <div className="muted small board-empty">Nothing here</div>}
                  {column.tasks.map((task) => {
                    const moves = byStatus ? movesFor(task, ctx) : []
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        taskType={typeOf(task)}
                        names={names}
                        onOpen={() => navigate(`/tasks/${task.id}`)}
                        dragProps={
                          moves.length
                            ? {
                                draggable: true,
                                onDragStart: (e) => {
                                  e.dataTransfer.effectAllowed = 'move'
                                  e.dataTransfer.setData('text/plain', task.id)
                                  setDragging(task)
                                },
                                onDragEnd: () => {
                                  setDragging(null)
                                  setOverColumn(null)
                                },
                                onMouseEnter: () => prefetch(['task', orgId, task.id], ({ signal }) => tasksApi.get(orgId, task.id, { signal })),
                              }
                            : undefined
                        }
                        footer={
                          moves.length > 0 && (
                            <select
                              className="move-menu"
                              aria-label={`Move ${task.code}`}
                              value=""
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const move = moves[Number(e.target.value)]
                                if (move) perform(task, move)
                              }}
                            >
                              <option value="">Move…</option>
                              {moves.map((m, i) => <option key={m.kind} value={i}>{m.label}</option>)}
                            </select>
                          )
                        }
                      />
                    )
                  })}
                  {column.has_more && <div className="muted small board-empty">+ {column.count - column.tasks.length} more: narrow the filters</div>}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {dialog && (
        <BoardDialog
          orgId={orgId}
          dialog={dialog}
          taskType={typeOf(dialog.task)}
          names={names}
          busy={busy}
          error={moveError}
          onClose={() => { setDialog(null); setMoveError(null) }}
          finish={finishDialog}
        />
      )}
    </>
  )
}

function BoardDialog({ orgId, dialog, taskType, names, busy, error, onClose, finish }) {
  const { task, kind } = dialog
  const fields = useEffectiveTaskFields(orgId, task, taskType)
  const props = { busy, error, onCancel: onClose }
  return (
    <Dialog title={`${task.code} · ${task.title}`} onClose={onClose} wide={kind === 'submit'}>
      {kind === 'submit' && (
        <SubmitForm task={task} taskType={taskType} fields={fields} {...props} onSubmit={(body) => finish(() => tasksApi.submit(orgId, task, body))} />
      )}
      {kind === 'block' && (
        <ReasonForm
          label="What is it waiting for? *"
          action="Mark blocked"
          withSlaPause={Boolean(task.sla)}
          {...props}
          onSubmit={(body) => finish(() => tasksApi.block(orgId, task, body))}
        />
      )}
      {(kind === 'approve' || kind === 'send_back') && (
        <ReviewForm
          orgId={orgId}
          task={task}
          taskType={taskType}
          names={names}
          initialResult={kind === 'approve' ? 'pass' : 'fail'}
          {...props}
          onSubmit={(body) => finish(() => tasksApi.review(orgId, task.id, body))}
        />
      )}
    </Dialog>
  )
}

// Cards just moved shown in their new column until the board reloads.
function placeCards(columns, moved) {
  if (!Object.keys(moved).length) return columns
  const home = new Map(columns.flatMap((c) => c.tasks.map((t) => [t.id, c.key])))
  const all = columns.flatMap((c) => c.tasks)
  return columns.map((column) => {
    const leaving = new Set(column.tasks.filter((t) => moved[t.id] && moved[t.id] !== column.key).map((t) => t.id))
    const arriving = all.filter((t) => moved[t.id] === column.key && home.get(t.id) !== column.key)
    return {
      ...column,
      tasks: [...arriving, ...column.tasks.filter((t) => !leaving.has(t.id))],
      count: column.count - leaving.size + arriving.length,
    }
  })
}

function columnLabel(column, groupBy, names) {
  if (groupBy === 'assignee') return column.key === 'unassigned' ? 'Unassigned' : names.personName(column.key)
  if (groupBy === 'priority') return TASK_PRIORITY_LABELS[column.key] || column.key
  return column.label || column.key
}
