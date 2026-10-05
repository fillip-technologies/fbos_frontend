import { verticalOptions } from '@/features/sales/api.js'
import { useLookup } from '@/shared/api/useQuery.js'

// The client's active verticals, to pick one for a lead or offering and to name them
// (revenue stores only the id). Cached per organization.
export default function useVerticals(orgId) {
  const { data } = useLookup(['verticals', orgId, 'active'], ({ signal }) => verticalOptions(orgId, { signal }).catch(() => []), {
    enabled: Boolean(orgId),
  })
  const verticals = data ?? []
  const verticalName = (id) => verticals.find((v) => v.id === id)?.name
  return { verticals, verticalName }
}
