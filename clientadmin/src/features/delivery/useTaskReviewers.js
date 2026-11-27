import { lookupsApi } from '@/features/delivery/api.js'
import { useLookup } from '@/shared/api/useQuery.js'

// Who may review your personal task: everyone else active in the company, by name. Asked only
// when a form offers the choice (`enabled`).
export default function useTaskReviewers(orgId, enabled = true) {
  const { data, error } = useLookup(
    ['task-reviewers', orgId],
    ({ signal }) => lookupsApi.taskReviewers(orgId, { signal }),
    { enabled: Boolean(orgId) && enabled }
  )
  return { people: data?.data ?? [], error }
}

// Whether handing the task in sends it to be checked (delivery's rule): a team's task only when its
// kind says someone checks it; a personal task also when it has a reviewer. A reviewer on a team
// task whose kind is not checked changes nothing: it is marked done when handed in.
export function goesForReview(task, taskType) {
  return Boolean(taskType?.requires_review) || (isPersonalTask(task) && Boolean(task?.reviewer))
}

// A personal task: no team, kept by the person who created it (delivery's rule).
export function isPersonalTask(task) {
  return !task?.owning_unit && Boolean(task?.created_by?.id) && task.created_by.id === task.assignee?.id
}
