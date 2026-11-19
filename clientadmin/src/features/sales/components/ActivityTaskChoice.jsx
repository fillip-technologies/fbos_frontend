import { activitiesApi } from '@/features/sales/api.js'
import { useQuery } from '@/shared/api/useQuery.js'
import { OPEN_TASK_STATUSES } from '@/features/sales/utils.js'

// The task fields of a new activity's form state.
export const taskChoiceDefaults = (canRecord) => ({ task_mode: canRecord ? 'record' : 'none', task_id: '', follow_up_task: true })

// The `task` an activity is logged with (revenue asks delivery): recorded as a done task of
// mine, finishing one of my open tasks about the record, or none; and the follow-up task.
export function taskChoiceBody(form, canRecord, hasFollowUp) {
  const task = { mode: form.task_mode, follow_up: hasFollowUp && form.follow_up_task && (canRecord || form.task_mode === 'complete') }
  if (form.task_mode === 'complete') task.task_id = form.task_id
  return task
}

// What happens in tasks when an activity (call, meeting, email…) is logged on a lead,
// opportunity or contract. `canRecord`: the person may add tasks (task write or personal);
// `canSeeTasks`: they may read tasks, so their open ones about the record are offered.
// `form` holds task_mode, task_id and follow_up_task; `followUp` describes the follow-up when one is set.
export default function ActivityTaskChoice({ orgId, subjectType, subjectId, canRecord, canSeeTasks, form, set, setForm, followUp }) {
  const myTasks = useQuery(
    ['record-tasks', orgId, subjectType, subjectId, 'mine-open'],
    ({ signal }) => activitiesApi.tasks(orgId, subjectType, subjectId, { assignee: 'me', status: OPEN_TASK_STATUSES }, { signal }).then((page) => page.data),
    { enabled: Boolean(orgId && subjectId) && canSeeTasks }
  )
  const openTasks = myTasks.data ?? []
  if (!canRecord && openTasks.length === 0) return null

  return (
    <fieldset className="field">
      <legend>Task</legend>
      {canRecord && (
        <label className="inline-check">
          <input type="radio" name="activity-task" checked={form.task_mode === 'record'} onChange={() => set('task_mode', 'record')} />
          Record it as a task of mine, done
        </label>
      )}
      {openTasks.length > 0 && (
        <label className="inline-check">
          <input
            type="radio"
            name="activity-task"
            checked={form.task_mode === 'complete'}
            onChange={() => setForm((f) => ({ ...f, task_mode: 'complete', task_id: f.task_id || openTasks[0].id }))}
          />
          It finishes one of my tasks
        </label>
      )}
      <label className="inline-check">
        <input type="radio" name="activity-task" checked={form.task_mode === 'none'} onChange={() => set('task_mode', 'none')} />
        No task
      </label>
      {form.task_mode === 'complete' && (
        <select aria-label="Task this finishes" required value={form.task_id} onChange={(e) => set('task_id', e.target.value)} style={{ marginTop: 6 }}>
          {openTasks.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.title}</option>)}
        </select>
      )}
      {followUp && (canRecord || form.task_mode === 'complete') && (
        <label className="inline-check" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={form.follow_up_task} onChange={(e) => set('follow_up_task', e.target.checked)} />
          Add a follow-up task {followUp}
        </label>
      )}
    </fieldset>
  )
}
