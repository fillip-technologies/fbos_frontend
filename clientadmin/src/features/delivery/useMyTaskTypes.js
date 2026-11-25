import { routingApi } from '@/features/delivery/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useLookup } from '@/shared/api/useQuery.js'

// The kinds of work a person is offered when adding a task. Whoever sets work up (an admin) sees
// them all. Anyone else, once their own team (home unit or a team they are on, or a unit above or
// below those) has a routing rule, sees that team's kinds of work and the general ones; work routed
// elsewhere is left out and they ask that team for it (a request).
// Delivery still decides where the task really goes.
export default function useMyTaskTypes(orgId, types, units) {
  const { user: me } = useAuth()
  const seesAll = hasAccess(me, ACCESS.deliverySetup)
  const { data: rules } = useLookup(['routing-rules', orgId], ({ signal }) => routingApi.rules(orgId, { signal }), {
    enabled: Boolean(orgId) && !seesAll,
  })
  if (seesAll) return { types, hiddenCount: 0, reason: 'admin' }
  if (!rules) return { types, hiddenCount: 0, reason: 'loading' }

  const mine = new Set([me?.home_unit?.id, ...(me?.teams ?? []).map((t) => t.id)].filter(Boolean))
  const teamName = me?.home_unit?.name ?? null
  if (mine.size === 0) return { types, hiddenCount: 0, reason: 'no-team', teamName }
  const unitById = new Map((units ?? []).map((u) => [u.id, u]))
  // A rule's team is mine when it is one of mine, sits below one of mine (a head's own teams), or
  // is above one of mine (a member of SMM is in the Digital Marketing department the rule names).
  const above = new Set([...mine].flatMap((id) => (unitById.get(id)?.path ?? '').split('/').filter(Boolean)))
  const isMine = (unitId) => mine.has(unitId) || above.has(unitId) || (unitById.get(unitId)?.path ?? '').split('/').some((id) => mine.has(id))

  const active = (Array.isArray(rules) ? rules : rules.data ?? []).filter((r) => r.active !== false)
  // Once the person's own team has a rule, they get that team's work and the general kinds (Task,
  // Review); everything else is for other teams, and they ask for it. A person whose team has no
  // rule yet (sales, say) is not narrowed down: nothing is left out until their team is set up.
  const ruleFor = (t) => {
    const own = active.filter((r) => r.task_type_code === t.code)
    return own.length ? own : active.filter((r) => !r.task_type_code && r.discipline === t.discipline)
  }
  const teamIsSetUp = active.some((r) => isMine(r.unit?.id))
  const offered = !teamIsSetUp
    ? types
    : types.filter((t) => {
        const found = ruleFor(t)
        return found.length === 0 ? t.discipline === 'general' : found.some((r) => isMine(r.unit?.id))
      })
  return { types: offered, hiddenCount: types.length - offered.length, reason: teamIsSetUp ? 'filtered' : 'no-rule', teamName }
}
