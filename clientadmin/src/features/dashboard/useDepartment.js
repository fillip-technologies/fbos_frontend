import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { routingApi } from '@/features/delivery/api.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { useLookup } from '@/shared/api/useQuery.js'

// What the home dashboard puts first for each kind of work: sales numbers, the team's tasks and
// projects, or people. A kind of work the company has no special view for keeps the "work" one.
const KIND_OF_DISCIPLINE = { sales: 'sales', hr: 'people' }
const KIND_BY_NAME = [
  [/sales|business develop|\bbd\b/i, 'sales'],
  [/\bhr\b|human|people|recruit/i, 'people'],
  [/dev|software|engineer|design|graphic|creative|marketing|seo|smm|social|content|support|operation/i, 'work'],
]

// The department the signed-in person belongs to, for the dashboard: { kind, unit: { id, name } }.
// It comes from the routing rules (which team gets which kind of work), the same ones that decide
// which kinds of work they are offered; without a rule, from the name of their own team.
// null when they belong to no team, so they keep the whole-company view.
export default function useDepartment(orgId) {
  const { user: me } = useAuth()
  const names = useDeliveryNames(orgId)
  const { data: rules } = useLookup(['routing-rules', orgId], ({ signal }) => routingApi.rules(orgId, { signal }), {
    enabled: Boolean(orgId) && hasAccess(me, ACCESS.tasks),
  })
  const home = me?.home_unit ?? null
  const mine = new Set([home?.id, ...(me?.teams ?? []).map((t) => t.id)].filter(Boolean))
  if (mine.size === 0) return null

  const unitById = new Map((names.units ?? []).map((u) => [u.id, u]))
  const above = new Set([...mine].flatMap((id) => (unitById.get(id)?.path ?? '').split('/').filter(Boolean)))
  const isMine = (id) => mine.has(id) || above.has(id) || (unitById.get(id)?.path ?? '').split('/').some((p) => mine.has(p))

  const active = (Array.isArray(rules) ? rules : []).filter((r) => r.active !== false && !r.task_type_code && r.discipline && r.unit?.id && isMine(r.unit.id))
  // The rule for the person's own team beats one for a department above or below it.
  const rule = active.find((r) => mine.has(r.unit.id)) ?? active[0]
  if (rule) {
    return { kind: KIND_OF_DISCIPLINE[rule.discipline] ?? 'work', unit: { id: rule.unit.id, name: unitById.get(rule.unit.id)?.name ?? rule.unit.name ?? home?.name } }
  }
  const byName = KIND_BY_NAME.find(([pattern]) => pattern.test(home?.name ?? ''))
  return home && byName ? { kind: byName[1], unit: { id: home.id, name: home.name } } : null
}
