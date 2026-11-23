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

// A personal task: no team, kept by the person who created it (delivery's rule).
export function isPersonalTask(task) {
  return !task?.owning_unit && Boolean(task?.created_by?.id) && task.created_by.id === task.assignee?.id
}
