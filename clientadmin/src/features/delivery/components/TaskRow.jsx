import SlaBadge from '@/features/delivery/components/SlaBadge.jsx'
import { initials } from '@/features/delivery/components/TaskCard.jsx'
import { TASK_PRIORITY_LABELS, formatDay, isOverdue } from '@/features/delivery/utils.js'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// One task as a single line of a grouped list: what it is, who has it, when it is due. Only urgent
// and high work gets a word; the dot's colour says the rest. `footer` holds the Move menu.
export default function TaskRow({ task, names, onOpen, dragProps, footer }) {
  const overdue = isOverdue(task)
  const who = task.assignee ? names.personName(task.assignee) : ''
  return (
    <div
      className={`gl-row${dragProps ? ' draggable' : ''}`}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen?.()}
      {...dragProps}
    >
      <span className={`gl-dot ${task.priority}`} title={TASK_PRIORITY_LABELS[task.priority]} aria-label={TASK_PRIORITY_LABELS[task.priority]} />
      <span className="gl-main">
        <span className="gl-name">{task.title}</span>
        <span className="gl-sub">
          <span className="mono">{task.code}</span> · {task.task_type.name}
          {task.review_round > 0 && ` · Round ${task.review_round + 1}`}
        </span>
      </span>
      <span className="gl-pri">
        {['p1', 'p2'].includes(task.priority) && <StatusBadge status={task.priority} label={TASK_PRIORITY_LABELS[task.priority]} />}
        <SlaBadge task={task} compact />
      </span>
      <span className="gl-who">
        <span className={`task-card-avatar${task.assignee ? '' : ' empty'}`} aria-hidden="true">{initials(who)}</span>
        <span className={task.assignee ? '' : 'muted'}>{task.assignee ? who : 'Nobody yet'}</span>
      </span>
      <span className={`gl-due ${overdue ? 'overdue' : 'muted'}`}>
        {task.due_at ? `${overdue ? 'Overdue · ' : 'Due '}${formatDay(task.due_at)}` : ''}
      </span>
      {footer}
    </div>
  )
}
