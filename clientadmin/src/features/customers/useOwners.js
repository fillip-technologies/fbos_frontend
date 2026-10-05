import { customersApi } from '@/features/customers/api.js'
import { useLookup } from '@/shared/api/useQuery.js'

// The company's active users, to pick and name customer owners. Listing users needs its
// own permission: when it is refused, `owners` is null and forms offer only the signed-in user.
// Cached per organization, so every page that names owners shares one request.
export default function useOwners(orgId) {
  const { data } = useLookup(
    ['users', orgId, 'owners'],
    ({ signal }) => customersApi.ownerOptions(orgId, { signal }).catch(() => null),
    { enabled: Boolean(orgId) }
  )
  const owners = data ?? null

  // The backend doesn't know user names (it stores the owner's id only).
  const ownerName = (id) => owners?.find((u) => u.id === id)?.name
  return { owners, ownerName }
}
