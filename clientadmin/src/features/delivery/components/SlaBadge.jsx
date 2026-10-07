import { SLA_STATE_BADGE, SLA_STATE_LABELS, formatTarget, relativeTime } from '@/features/delivery/taskFields.js'

// A task's SLA clock as a badge: the resolution clock, or the response clock while the task
// hasn't been picked up yet. `compact` shows only the state and time (cards, rows).
export default function SlaBadge({ task, compact = false }) {
  const clock = activeClock(task)
  if (!clock) return null
  const running = ['running', 'at_risk', 'breached'].includes(clock.state)
  const what = clock.kind === 'response' ? 'Response' : 'SLA'
  const when = running ? relativeTime(clock.due_at) : null
  const title = `${what} target ${formatTarget(clock.target_minutes)} · ${Math.round(clock.consumed_pct)}% used${clock.paused_minutes ? ` · paused ${clock.paused_minutes}m` : ''}`
  return (
    <span className={`badge ${SLA_STATE_BADGE[clock.state]}`} title={title}>
      {compact ? '' : `${what}: `}
      {SLA_STATE_LABELS[clock.state]}
      {when && ` · ${clock.state === 'breached' ? when : `due ${when}`}`}
    </span>
  )
}

// The clock that matters now: an unanswered response clock first, then the resolution clock.
export function activeClock(task) {
  const response = task.response_sla
  if (response && !['met', 'breached_closed'].includes(response.state)) return response
  return task.sla || response || null
}
