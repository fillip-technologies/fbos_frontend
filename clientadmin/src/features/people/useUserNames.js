import { useMemo } from 'react'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { usersApi } from '@/features/users/api.js'
import { useLookup } from '@/shared/api/useQuery.js'

// People are approvers by their login (Identity user), so naming them needs Identity's user list.
// Without permission to read it nothing is requested and `nameOf` falls back to the given text.
export default function useUserNames(orgId) {
  const { user } = useAuth()
  const query = useLookup(
    ['users', orgId, { status: 'active', limit: 100 }],
    ({ signal }) => usersApi.list(orgId, { limit: 100, status: 'active' }, { signal }).catch(() => ({ data: null })),
    { enabled: Boolean(orgId) && hasAccess(user, ACCESS.users) },
  )
  const users = useMemo(() => query.data?.data ?? [], [query.data])
  const names = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.name])), [users])
  return {
    users,
    canListUsers: users.length > 0,
    nameOf: (id, fallback = 'a named approver') => (id === user?.id ? 'you' : names[id] || fallback),
  }
}
