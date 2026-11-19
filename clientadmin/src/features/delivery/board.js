// Board rules with no React in them (tested in tests/board.test.mjs): the steps a card may take,
// which columns it may be dropped on, and where a dropped card goes.

// The status each step leaves the task in (the backend's state machine).
const STEP_STATUS = {
  claim_start: 'in_progress',
  start: 'in_progress',
  unblock: 'in_progress',
  block: 'blocked',
  approve: 'done',
  send_back: 'rework',
}
// Steps that ask for more first: the board opens their dialog.
export const DIALOG_STEPS = ['submit', 'block', 'approve', 'send_back']

// The steps a card can take, as the backend's state machine allows them for this user:
// { to: status-board column, status: the task's status after it, label, kind }.
export function movesFor(task, { me, canManage, canReview }) {
  const isAssignee = Boolean(me?.id) && task.assignee?.id === me.id
  const worksOn = isAssignee || canManage
  const mayReview = (Boolean(me?.id) && task.reviewer?.id === me.id) || canReview
  const needsReview = Boolean(task.task_type?.requires_review)
  const finishColumn = needsReview ? 'in_review' : 'done'
  const moves = []
  const add = (to, label, kind, status = STEP_STATUS[kind]) => moves.push({ to, label, kind, status })
  if (!task.assignee && ['draft', 'open'].includes(task.status)) add('in_progress', 'Take it and start', 'claim_start')
  if (isAssignee && ['assigned', 'rework'].includes(task.status)) add('in_progress', 'Start work', 'start')
  if (isAssignee && ['in_progress', 'rework'].includes(task.status)) add(finishColumn, 'Submit…', 'submit', needsReview ? 'submitted' : 'done')
  if (worksOn && ['open', 'assigned', 'in_progress', 'rework'].includes(task.status)) add('blocked', 'Mark blocked…', 'block')
  if (worksOn && task.status === 'blocked') add('in_progress', 'Unblock', 'unblock')
  if (mayReview && ['submitted', 'in_review'].includes(task.status)) {
    add('done', 'Approve…', 'approve')
    add('todo', 'Send back…', 'send_back')
  }
  return moves
}

// How a card gets into `column` of a configured board: 'place' (its status already belongs
// there), the step that takes it there, or null (it can't go there).
export function dropFor(task, column, moves) {
  const statuses = column?.statuses ?? []
  if (statuses.includes(task.status)) return { kind: 'place' }
  return moves.find((m) => statuses.includes(m.status)) ?? null
}

// The cards above and below a drop at `index` in `cards`, leaving the dragged card out:
// { after_task_id } or { before_task_id }, or {} for the top of an empty column.
export function anchorsFor(cards, draggedId, index) {
  const others = cards.filter((c) => c.id !== draggedId)
  const draggedAt = cards.findIndex((c) => c.id === draggedId)
  const at = draggedAt !== -1 && draggedAt < index ? index - 1 : index
  if (at > 0 && others[at - 1]) return { after_task_id: others[at - 1].id }
  if (others[at]) return { before_task_id: others[at].id }
  return {}
}

// The column a task with `status` shows in: its saved column if that holds the status, else
// the column marked default for it, else the first that holds it.
export function homeColumn(columns, status, savedColumnId) {
  const saved = columns.find((c) => c.id === savedColumnId)
  if (saved && saved.statuses.includes(status)) return saved
  const holding = columns.filter((c) => c.statuses.includes(status))
  return holding.find((c) => c.is_default_for_status) ?? holding[0] ?? null
}

// Columns with cards just moved shown where they were dropped, until the board reloads.
// `moved`: task id -> { columnId, anchors, status? }.
export function placeMoved(columns, moved) {
  if (!Object.keys(moved).length) return columns
  const all = new Map(columns.flatMap((c) => c.tasks.map((t) => [t.id, t])))
  const stripped = columns.map((c) => ({ ...c, tasks: c.tasks.filter((t) => !moved[t.id]) }))
  const placed = stripped.map((column) => {
    let tasks = column.tasks
    for (const [id, move] of Object.entries(moved)) {
      if (move.columnId !== column.id || !all.has(id)) continue
      const card = { ...all.get(id), ...(move.status ? { status: move.status } : {}) }
      const { after_task_id: after, before_task_id: before } = move.anchors ?? {}
      const at = after ? tasks.findIndex((t) => t.id === after) + 1 : before ? Math.max(0, tasks.findIndex((t) => t.id === before)) : 0
      tasks = [...tasks.slice(0, at), card, ...tasks.slice(at)]
    }
    return tasks === column.tasks ? column : { ...column, tasks }
  })
  return placed.map((column, i) => {
    const before = columns[i].tasks.length
    return { ...column, count: columns[i].count - before + column.tasks.length }
  })
}

// "3 / 5" (or "3" without a limit), and the estimate in hours: "6h", "1.5h".
export function columnCount(column) {
  return column.wip_limit ? `${column.count} / ${column.wip_limit}` : String(column.count)
}

export function estimateHours(minutes) {
  if (!minutes) return null
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours}h`
}

// A new task starts open or assigned: only columns holding those take "+ Add item".
export const takesNewItems = (column) => column.statuses.some((s) => ['draft', 'open', 'assigned'].includes(s))
