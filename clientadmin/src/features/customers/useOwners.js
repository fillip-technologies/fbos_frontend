import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { customersApi } from '@/features/customers/api.js'
import { useLookup } from '@/shared/api/useQuery.js'

// The company's active users, to pick and name customer owners. Listing users needs its
// own permission: without it the list isn't requested, `owners` is null and forms offer
// only the signed-in user. Cached per organization, so every page that names owners shares
// one request.
export default function useOwners(orgId) {
  const { user: me } = useAuth()
  const { data } = useLookup(
    ['users', orgId, 'owners'],
    ({ signal }) => customersApi.ownerOptions(orgId, { signal }).catch(() => null),
    { enabled: Boolean(orgId) && hasAccess(me, ACCESS.users) }
  )
  const owners = data ?? null

  // The backend doesn't know user names (it stores the owner's id only).
  const ownerName = (id) => owners?.find((u) => u.id === id)?.name
  return { owners, ownerName }
}
