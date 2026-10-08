import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { lookupsApi } from '@/features/delivery/api.js'
import { useLookup } from '@/shared/api/useQuery.js'

// Who a task of `unitId` may be given to, from delivery: the team's people first (`in_unit`),
// or only them when the company gives tasks only within the team (`teamOnly`). Task and
// handover managers may ask; for anyone else, and until a team is chosen, `people` is null
// and forms offer only the signed-in user.
export default function useAssignablePeople(orgId, unitId) {
  const { user: me } = useAuth()
  const allowed = hasAccess(me, ACCESS.manageTasks) || hasAccess(me, ACCESS.manageHandovers)
  const { data, error } = useLookup(
    ['assignable-people', orgId, unitId],
    ({ signal }) => lookupsApi.assignablePeople(orgId, unitId, { signal }),
    { enabled: Boolean(orgId && unitId) && allowed }
  )
  return { people: data?.data ?? null, teamOnly: Boolean(data?.team_only), error }
}
