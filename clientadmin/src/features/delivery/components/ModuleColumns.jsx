import { useState } from 'react'
import { columnCount, estimateHours, taskProgress } from '@/features/delivery/board.js'
import { TASK_PRIORITY_LABELS, formatDay } from '@/features/delivery/utils.js'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// Board columns of modules, shared by a project's board and a customer's: GitHub-style heads
// ("count / limit", estimate, description) and cards dragged to a place in a column, with a line
// where they will land. What a drop does is the page's (`onDrop(module, column, index)`).
//
// columns: [{ key, name, description, wip_limit, count, estimate_minutes_total, over_limit, modules }]
export default function ModuleColumns({ columns, names, canDrag, canDropOn, onDrop, onOpen, menuFor, headAction, footerFor, children }) {
  const [dragging, setDragging] = useState(null)
  const [drop, setDrop] = useState(null) // { key, index }

  return (
    <div className="board">
      {columns.map((column) => {
        const droppable = Boolean(dragging) && canDropOn(dragging, column)
        const dropHere = droppable && drop?.key === column.key
        const estimate = estimateHours(column.estimate_minutes_total)
        return (
          <section
            key={column.key}
            className={`board-column${droppable ? ' can-drop' : ''}${dropHere ? ' drop-over' : ''}`}
            aria-label={column.name}
            onDragOver={(e) => {
              if (!droppable) return
              e.preventDefault()
              if (drop?.key !== column.key) setDrop({ key: column.key, index: column.modules.length })
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setDrop((d) => (d?.key === column.key ? null : d))
            }}
            onDrop={(e) => {
              e.preventDefault()
              const module = dragging
              const index = drop?.key === column.key ? drop.index : column.modules.length
              setDragging(null)
              setDrop(null)
              if (module && droppable) onDrop(module, column, index)
            }}
          >
            <header className="board-column-head stacked">
              <div className="board-column-title">
                <span title={column.name}>{column.name}</span>
                <span className={`count${column.over_limit ? ' over' : ''}`} title={column.wip_limit ? `Item limit: ${column.wip_limit}` : undefined}>
                  {columnCount(column)}
                </span>
                {headAction?.(column)}
              </div>
              {estimate && <div className="board-column-meta">Estimate: {estimate}</div>}
              {column.description && <div className="board-column-desc">{column.description}</div>}
            </header>
            <div className="board-cards">
              {column.modules.length === 0 && !dropHere && <div className="muted small board-empty">Nothing here</div>}
              {column.modules.map((module, index) => {
                const options = menuFor?.(module, column, index) ?? []
                return (
                  <div
                    key={module.id}
                    className="board-slot"
                    onDragOver={(e) => {
                      if (!droppable) return
                      e.preventDefault()
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      const at = index + (e.clientY > rect.top + rect.height / 2 ? 1 : 0)
                      if (drop?.key !== column.key || drop.index !== at) setDrop({ key: column.key, index: at })
                    }}
                  >
                    {dropHere && drop.index === index && <div className="board-drop-line" />}
                    <ModuleCard
                      module={module}
                      names={names}
                      onOpen={() => onOpen(module)}
                      dragProps={
                        canDrag(module)
                          ? {
                              draggable: true,
                              onDragStart: (e) => {
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', module.id)
                                setDragging(module)
                              },
                              onDragEnd: () => {
                                setDragging(null)
                                setDrop(null)
                              },
                            }
                          : undefined
                      }
                      footer={
                        options.length > 0 && (
                          <select
                            className="move-menu"
                            aria-label={`Move ${module.title}`}
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
              {dropHere && drop.index >= column.modules.length && <div className="board-drop-line" />}
            </div>
            {footerFor?.(column)}
          </section>
        )
      })}
      {children}
    </div>
  )
}

// One module as a card: title, priority, labels, who owns it, when it's due, its estimate and
// how far its linked tasks are. `extra` shows above the title (a customer board names the project).
export function ModuleCard({ module, names, onOpen, dragProps, footer }) {
  const estimate = estimateHours(module.estimate_minutes)
  const progress = taskProgress(module)
  const overdue = module.due_on && module.due_on < new Date().toISOString().slice(0, 10)
  return (
    <article
      className={`task-card module-card${dragProps ? ' draggable' : ''}`}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen?.()}
      {...dragProps}
    >
      {module.projectName && <div className="muted small">{module.projectName}</div>}
      <div className="task-card-title">{module.title}</div>
      {(module.priority !== 'p3' || module.labels.length > 0) && (
        <div className="task-card-meta">
          {module.priority !== 'p3' && <StatusBadge status={module.priority} label={TASK_PRIORITY_LABELS[module.priority]} />}
          {module.labels.map((label) => <span key={label} className="chip subtle">{label}</span>)}
        </div>
      )}
      {progress && (
        <div className="module-progress" title={progress}>
          <div className="module-progress-bar" style={{ width: `${Math.round((module.tasks_done / module.task_count) * 100)}%` }} />
          <span className="muted small">{progress}</span>
        </div>
      )}
      <div className="task-card-foot">
        <span className={module.owner ? '' : 'muted'}>{module.owner ? names.personName(module.owner) : 'No owner'}</span>
        <span className="muted">
          {estimate && `${estimate}`}
          {estimate && module.due_on && ' · '}
          {module.due_on && <span className={overdue ? 'overdue' : ''}>{overdue ? 'Overdue · ' : 'Due '}{formatDay(module.due_on)}</span>}
        </span>
      </div>
      {footer}
    </article>
  )
}
