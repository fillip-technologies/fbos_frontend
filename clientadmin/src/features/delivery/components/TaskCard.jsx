import SlaBadge from '@/features/delivery/components/SlaBadge.jsx'
import { cardFields, disciplineLabel, formatFieldValue } from '@/features/delivery/taskFields.js'
import { TASK_PRIORITY_LABELS, formatDay, isOverdue, subjectLabel } from '@/features/delivery/utils.js'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// One task as a card (board, queue): what it is, who has it, when it's due, its SLA, and the
// few fields its type puts on cards (story points, a phone number, a site).
export default function TaskCard({ task, taskType, names, onOpen, dragProps, footer, selected = false }) {
  const overdue = isOverdue(task)
  const points = task.task_type.estimation_unit === 'points' ? task.attributes?.story_points : null
  return (
    <article
      className={`task-card${selected ? ' selected' : ''}${dragProps ? ' draggable' : ''}`}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen?.()}
      {...dragProps}
    >
      <div className="task-card-top">
        <span className={`discipline-dot ${task.task_type.discipline}`} title={disciplineLabel(task.task_type.discipline)} />
        <span className="mono muted">{task.code}</span>
        <span className="muted small">{task.task_type.name}</span>
        {points && <span className="points" title="Story points">{points}</span>}
      </div>
      <div className="task-card-title">{task.title}</div>
      {cardFields(taskType, task.attributes).filter((f) => f.key !== 'story_points').length > 0 && (
        <div className="task-card-fields">
          {cardFields(taskType, task.attributes)
            .filter((f) => f.key !== 'story_points')
            .map((f) => (
              <span key={f.key} title={f.label}>
                {f.type === 'url' ? <a href={task.attributes[f.key]} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{f.label}</a> : formatFieldValue(f, task.attributes[f.key])}
              </span>
            ))}
        </div>
      )}
      <div className="task-card-meta">
        <StatusBadge status={task.priority} label={TASK_PRIORITY_LABELS[task.priority]} />
        <SlaBadge task={task} compact />
        {task.cadence_step > 1 && <span className="chip subtle" title="Touch in the cadence">Touch {task.cadence_step}</span>}
        {task.review_round > 0 && <span className="chip subtle" title="Sent back for rework">Round {task.review_round + 1}</span>}
        {task.subject && task.subject.type !== 'work.work_unit' && <span className="chip subtle">{subjectLabel(task.subject)}</span>}
      </div>
      <div className="task-card-foot">
        <span className={task.assignee ? '' : 'muted'}>{task.assignee ? names.personName(task.assignee) : 'Unassigned'}</span>
        {task.due_at && (
          <span className={overdue ? 'overdue' : 'muted'}>{overdue ? 'Overdue · ' : 'Due '}{formatDay(task.due_at)}</span>
        )}
      </div>
      {footer}
    </article>
  )
}
