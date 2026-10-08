import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { setupApi } from '@/features/delivery/api.js'
import { useLookup } from '@/shared/api/useQuery.js'

export const ASSIGNMENT_POLICY_LABELS = {
  queue: 'Leave it in the queue',
  round_robin: 'Take turns',
  least_busy: 'Give it to the least busy',
}

// What a team does with work left without an assignee, in words for the forms.
const GIVEN_OUT = {
  round_robin: 'the team’s people take turns at it',
  least_busy: 'whoever in the team has the fewest open tasks gets it',
}

// How each team hands out the work that reaches it unassigned (delivery's assignment policies):
// a team not listed leaves it in its queue. Reading them needs task access; without it the
// forms simply don't say.
export default function useAssignmentPolicies(orgId) {
  const { user: me } = useAuth()
  const { data, error, reload } = useLookup(
    ['assignment-policies', orgId],
    ({ signal }) => setupApi.assignmentPolicies(orgId, { signal }),
    { enabled: Boolean(orgId) && hasAccess(me, ACCESS.tasks) }
  )
  const rows = data?.data ?? []
  const byUnit = new Map(rows.map((p) => [p.unit.id, p]))
  return {
    rows,
    rowOf: (unitId) => byUnit.get(unitId) ?? null,
    // How the team gives out work left without an assignee; null when it waits in the queue.
    givenOut: (unitId) => GIVEN_OUT[byUnit.get(unitId)?.policy] ?? null,
    error,
    reload,
  }
}
