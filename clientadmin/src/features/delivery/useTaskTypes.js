import { setupApi } from '@/features/delivery/api.js'
import { mergeFields } from '@/features/delivery/taskFields.js'
import useFormFields from '@/features/verticals/useFormFields.js'
import { useLookup } from '@/shared/api/useQuery.js'

// The task types (built-in and own, archived included so old tasks still find theirs), with
// a lookup by code. Shared by every page through one cached request.
export default function useTaskTypes(orgId) {
  const { data, error, loading } = useLookup(['task-types', orgId], ({ signal }) => setupApi.taskTypes(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  const types = data ?? []
  const byCode = new Map(types.map((t) => [t.code, t]))
  return { types, active: types.filter((t) => !t.archived), byCode, typeOf: (ref) => byCode.get(ref?.code ?? ref), error, loading }
}

// Every field a task of `taskType` shows: the type's own, then the company's custom fields for
// tasks kept for the project's vertical or the owning team's verticals, less those whose rule
// hides them for `values` (`task_type_code`, `priority`). Custom fields the user may not read
// are simply left out.
export function useTaskFields(orgId, taskType, unitId, verticalId, values) {
  const customFields = useFormFields(orgId, 'task.task', { verticalId, unitId, values })
  return mergeFields(taskType?.fields ?? [], customFields.map((field) => ({ ...field, custom: true })))
}

// The fields of a saved task. Delivery says which custom fields apply (`custom_field_scope`):
// a task in a project takes the project's vertical (none when it has none) and no team; any
// other task takes its team. So every page shows the same fields, and nobody needs to be
// allowed to read the project for it.
export function useEffectiveTaskFields(orgId, task, taskType) {
  const scope = task?.custom_field_scope
  const values = { task_type_code: task?.task_type?.code, priority: task?.priority }
  return useTaskFields(orgId, taskType, scope?.unit_id ?? null, scope?.vertical_id ?? null, values)
}

