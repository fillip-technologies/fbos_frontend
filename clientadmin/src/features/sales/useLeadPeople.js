import { leadsApi } from '@/features/sales/api.js'
import useOwners from '@/features/customers/useOwners.js'
import { useLookup } from '@/shared/api/useQuery.js'

// Who may take leads (revenue asks identity: active people allowed to work leads), to pass a
// lead on and to name who handles one. Anyone who can see leads may ask, so pages name people
// without needing the user list; someone who has since lost lead access is named from the user
// list when the viewer can read it. Cached per organization.
export default function useLeadPeople(orgId) {
  const { data, error } = useLookup(['lead-people', orgId], ({ signal }) => leadsApi.assignablePeople(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  const { ownerName } = useOwners(orgId)
  const people = data ?? []

  const personName = (id) => (id ? people.find((p) => p.id === id)?.name || ownerName(id) : null)
  return { people, personName, error }
}
