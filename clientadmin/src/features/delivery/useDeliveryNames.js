import { lookupsApi } from '@/features/delivery/api.js'
import useOwners from '@/features/customers/useOwners.js'
import { useLookup } from '@/shared/api/useQuery.js'

const byId = (rows) => new Map((rows ?? []).map((row) => [row.id, row]))

// Delivery stores only ids for people, units (branch / department / team), customers and
// verticals, and answers with `name: null`. This names them from the console's cached lookups.
// Keys and error handling match the other pages that read the same lists, so they share one
// request: units let the error through; a refused customer or vertical list is just empty.
// A lookup the user may not read shows "—" rather than an error.
export default function useDeliveryNames(orgId) {
  const enabled = Boolean(orgId)
  const { owners } = useOwners(orgId)
  const unitsQuery = useLookup(['org-units', orgId, 'all'], ({ signal }) => lookupsApi.units(orgId, { signal }), { enabled })
  const customersQuery = useLookup(
    ['customers', orgId, 'all'],
    ({ signal }) => lookupsApi.customers(orgId, { signal }).catch(() => []),
    { enabled }
  )
  const verticalsQuery = useLookup(
    ['verticals', orgId, 'active'],
    ({ signal }) => lookupsApi.verticals(orgId, { signal }).catch(() => []),
    { enabled }
  )

  const people = byId(owners)
  const units = byId(unitsQuery.data)
  const customers = byId(customersQuery.data)
  const verticals = byId(verticalsQuery.data)

  return {
    // Option lists for pickers (null while unknown or not allowed).
    people: owners,
    units: unitsQuery.data ?? null,
    customers: customersQuery.data ?? null,
    verticals: verticalsQuery.data ?? null,
    // Names for an id, or a ref ({ id }); "—" when there is nothing to name.
    personName: (ref) => nameOf(people, ref),
    unitName: (ref) => nameOf(units, ref),
    customerName: (ref) => nameOf(customers, ref),
    verticalName: (ref) => nameOf(verticals, ref),
  }
}

function nameOf(rows, ref) {
  const id = typeof ref === 'string' ? ref : ref?.id
  return rows.get(id)?.name || '—'
}
