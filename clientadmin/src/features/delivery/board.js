// Project board rules with no React in them (tested in tests/board.test.mjs): where a dropped
// module goes, what a column head says, and which column of a project a customer-board drop
// lands in. Modules are the board's own cards: moving them never changes a task.

// The modules above and below a drop at `index` in `cards`, leaving the dragged one out:
// { after_module_id } or { before_module_id }; {} (the bottom) for an empty column.
export function anchorsFor(cards, draggedId, index) {
  const others = cards.filter((c) => c.id !== draggedId)
  const draggedAt = cards.findIndex((c) => c.id === draggedId)
  const at = draggedAt !== -1 && draggedAt < index ? index - 1 : index
  if (at > 0 && others[at - 1]) return { after_module_id: others[at - 1].id }
  if (others[at]) return { before_module_id: others[at].id }
  return {}
}

// Columns with modules just moved shown where they were dropped, until the board reloads.
// `moved`: module id -> { columnKey, anchors }; `keyOf(column)` names a column (its id, or on
// a customer's board its name).
export function placeMoved(columns, moved, keyOf = (c) => c.id) {
  if (!Object.keys(moved).length) return columns
  const all = new Map(columns.flatMap((c) => c.modules.map((m) => [m.id, m])))
  return columns.map((column) => {
    let modules = column.modules.filter((m) => !moved[m.id])
    for (const [id, move] of Object.entries(moved)) {
      if (move.columnKey !== keyOf(column) || !all.has(id)) continue
      const { after_module_id: after, before_module_id: before } = move.anchors ?? {}
      const at = after
        ? modules.findIndex((m) => m.id === after) + 1
        : before
          ? Math.max(0, modules.findIndex((m) => m.id === before))
          : modules.length
      modules = [...modules.slice(0, at), all.get(id), ...modules.slice(at)]
    }
    const estimate = modules.reduce((sum, m) => sum + (m.estimate_minutes || 0), 0)
    const count = modules.length
    const overLimit = column.wip_limit ? count > column.wip_limit : false
    return { ...column, modules, count, estimate_minutes_total: estimate, over_limit: overLimit }
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

// "3 / 5 tasks done", or null without linked tasks.
export function taskProgress(module) {
  if (!module.task_count) return null
  return `${module.tasks_done} / ${module.task_count} tasks done`
}

// On a customer's board, the column of the module's own project with the same name (or null).
export function projectColumnNamed(project, name) {
  const key = String(name ?? '').trim().toLowerCase()
  return project?.columns.find((c) => c.name.trim().toLowerCase() === key) ?? null
}

// Hours typed in a form ("6", "1.5") as minutes, or null when blank or not a number.
export function hoursToMinutes(text) {
  const value = Number(String(text ?? '').trim())
  if (!String(text ?? '').trim() || !Number.isFinite(value) || value < 0) return null
  return Math.round(value * 60)
}

// "backend, api" as a clean list of labels.
export function parseLabels(text) {
  return [...new Set(String(text ?? '').split(',').map((l) => l.trim()).filter(Boolean))]
}

// On a customer's board a column mixes projects, but a module is placed only among its own
// project's modules: the nearest one of `sameGroup` above the drop, else below, else the bottom.
export function anchorsWithin(cards, draggedId, index, sameGroup) {
  const above = cards.slice(0, index).filter((c) => c.id !== draggedId && sameGroup(c))
  if (above.length) return { after_module_id: above[above.length - 1].id }
  const below = cards.slice(index).find((c) => c.id !== draggedId && sameGroup(c))
  return below ? { before_module_id: below.id } : {}
}
