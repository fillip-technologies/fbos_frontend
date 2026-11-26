import '@/features/delivery/task-flow.css'
import { useAuth } from '@/features/auth/AuthContext.jsx'

// Where the task is, drawn as the path it takes (Created → Given to someone → In progress →
// Being checked → Done), and one sentence on what happens now and what the viewer should do. It
// only reads the task: the buttons and the rules stay with TaskActions and the backend. A task that
// follows a workflow shows that workflow's own steps instead.
export default function TaskFlow({ task, taskType, names }) {
  const { user: me } = useAuth()
  if (task.governing_workflow) return null

  if (task.status === 'cancelled') {
    return (
      <div className="panel tf">
        <p className="tf-now"><strong>Cancelled.</strong> Nobody needs to do anything more on this task.</p>
      </div>
    )
  }

  const reviewed = Boolean(taskType?.requires_review || task.reviewer)
  const steps = [
    { key: 'created', label: 'Created' },
    { key: 'assigned', label: 'Given to someone' },
    { key: 'working', label: 'In progress' },
    ...(reviewed ? [{ key: 'review', label: 'Being checked' }] : []),
    { key: 'done', label: 'Done' },
  ]
  const indexOf = (key) => steps.findIndex((s) => s.key === key)
  const at = {
    draft: 0, open: 0, assigned: indexOf('assigned'), in_progress: indexOf('working'), blocked: indexOf('working'), rework: indexOf('working'),
    submitted: reviewed ? indexOf('review') : indexOf('working'), in_review: reviewed ? indexOf('review') : indexOf('working'),
    done: steps.length - 1,
  }[task.status] ?? 0
  const finished = task.status === 'done'

  const isAssignee = task.assignee?.id === me?.id
  // The one who gave the task sees a different story from the one who got it.
  const isGiver = !isAssignee && task.created_by?.id === me?.id
  const isChecker = task.reviewer?.id === me?.id
  const known = (ref) => {
    const name = ref ? names.personName(ref) : null
    return name && name !== '—' ? name : null
  }
  const who = known(task.assignee) ?? (task.assignee ? 'the person it was given to' : null)
  const reviewer = known(task.reviewer) ?? (task.reviewer ? 'the checker' : null)
  const giver = known(task.created_by) ?? 'your manager'
  const required = (task.checklist ?? []).filter((i) => i.mandatory && !i.done).length
  const todoLeft = required > 0 ? ` ${required} required ${required === 1 ? 'step is' : 'steps are'} still to tick before it can be handed in.` : ''
  const blockedWhy = task.attributes?.blocked_reason ? `: ${task.attributes.blocked_reason}` : ''

  // What the viewer is to this task, in one line above the path.
  const role = isAssignee
    ? `This task is yours. Given by ${giver}.`
    : isGiver
      ? who ? `You gave this to ${who}.` : 'You created this task.'
      : isChecker ? 'You are the one who checks this task.' : null

  const forReceiver = {
    draft: 'Nobody has this yet.',
    open: 'Nobody has this yet.',
    assigned: 'Press “Start work” when you begin.',
    in_progress: `You are working on it. Tick the steps and log your time, then hand it in.${todoLeft}`,
    blocked: `Stuck${blockedWhy}. Press “Unblock” when work can go on.`,
    rework: 'It was sent back for changes. Fix it, then resubmit.',
    submitted: `You handed it in. Waiting for ${reviewer ?? 'a reviewer'} to check it.`,
    in_review: `${reviewer ?? 'A reviewer'} is checking it.`,
    done: 'You finished this. Well done, nothing more to do.',
  }
  const forGiver = {
    draft: 'Nobody has picked it up yet.',
    open: 'Nobody has picked it up yet. Assign it, or a person in the team can take it.',
    assigned: `Waiting for ${who ?? 'them'} to start.`,
    in_progress: `${who ?? 'They are'} working on it.${todoLeft}`,
    blocked: `${who ?? 'They are'} stuck${blockedWhy}. You may need to help.`,
    rework: `${who ?? 'They are'} fixing what was sent back.`,
    submitted: isChecker ? 'Handed in. It is waiting for your check.' : `${who ?? 'They'} handed it in. Waiting for ${reviewer ?? 'a reviewer'} to check it.`,
    in_review: isChecker ? 'It is waiting for your check.' : `${reviewer ?? 'A reviewer'} is checking it.`,
    done: `${who ?? 'They'} finished this. It is complete.`,
  }
  const forOthers = {
    draft: 'Nobody has this yet. Assign it to someone, or a person in the team can take it.',
    open: 'Nobody has this yet. Assign it to someone, or a person in the team can take it.',
    assigned: `Waiting for ${who ?? 'them'} to start.`,
    in_progress: `${who ?? 'They are'} working on it.${todoLeft}`,
    blocked: `Stuck${blockedWhy}.`,
    rework: `${who ?? 'They are'} fixing what was sent back.`,
    submitted: isChecker ? 'Handed in. It is waiting for your check.' : `Handed in. Waiting for ${reviewer ?? 'a reviewer'} to check it.`,
    in_review: isChecker ? 'It is waiting for your check.' : `${reviewer ?? 'A reviewer'} is checking it.`,
    done: 'Finished. Nothing more to do.',
  }
  const now = (isAssignee ? forReceiver : isGiver ? forGiver : forOthers)[task.status]

  return (
    <div className="panel tf">
      {role && <p className="tf-role">{role}</p>}
      <ol className="tf-steps" aria-label="Where this task is">
        {steps.map((s, i) => {
          const state = finished || i < at ? 'done' : i === at ? 'now' : 'next'
          return (
            <li key={s.key} className={`tf-step is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
              <span className="tf-dot">{state === 'done' ? '✓' : i + 1}</span>
              <span className="tf-label">{s.label}</span>
            </li>
          )
        })}
      </ol>
      {now && <p className="tf-now"><strong>Now:</strong> {now}</p>}
    </div>
  )
}
