import { useEffect, useState } from 'react'
import { customersApi } from '@/features/customers/api.js'

// The company's active users, to pick and name customer owners. Listing users needs its
// own permission: when it is refused, `owners` is null and forms offer only the signed-in user.
export default function useOwners(orgId) {
  const [owners, setOwners] = useState(null)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    customersApi
      .ownerOptions(orgId)
      .then((users) => !cancelled && setOwners(users))
      .catch(() => !cancelled && setOwners(null))
    return () => {
      cancelled = true
    }
  }, [orgId])

  // The backend doesn't know user names (it stores the owner's id only).
  const ownerName = (id) => owners?.find((u) => u.id === id)?.name
  return { owners, ownerName }
}
