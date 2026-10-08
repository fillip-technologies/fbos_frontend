import { lookupsApi, setupApi } from '@/features/delivery/api.js'
import { fieldsFromSchemas, mergeFields } from '@/features/delivery/taskFields.js'
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
// tasks that apply to the owning team or project vertical (identity filters them by verticals). Custom
// fields the user may not read are simply left out.
export function useTaskFields(orgId, taskType, unitId, verticalId) {
  const { data: definitions } = useLookup(
    ['task-custom-fields', orgId, unitId || 'all', verticalId || 'none'],
    ({ signal }) => lookupsApi.taskCustomFields(orgId, unitId, verticalId, { signal }).catch(() => []),
    { enabled: Boolean(orgId) }
  )
  return mergeFields(taskType?.fields ?? [], fieldsFromSchemas(definitions))
}
