import { useMemo } from 'react'
import { accessApi } from '@/features/access/api.js'
import { unitTree } from '@/features/access/permissions.js'
import { useLookup } from '@/shared/api/useQuery.js'

// Loads what the access editor needs for one organization: the permission catalog,
// its roles (presets) and its active org units (as an indented tree).
//
// Each list needs its own read permission (role read for the first two, org-unit read for
// units). Access is per user, so one may be refused while the others load: a refused
// list comes back empty instead of failing the whole page. Only when all three fail is
// `error` set. The lists are cached per organization and shared by every page using them.
const settled = (promise) => promise.then((value) => ({ value }), (reason) => ({ reason }))

export default function useAccessCatalog(orgId) {
  const enabled = Boolean(orgId)
  const catalog = useLookup(['permissions', orgId], ({ signal }) => settled(accessApi.permissions(orgId, { signal })), { enabled })
  const roles = useLookup(['roles', orgId], ({ signal }) => settled(accessApi.roles(orgId, { signal })), { enabled })
  const units = useLookup(['org-units', orgId, 'active'], ({ signal }) => settled(accessApi.orgUnits(orgId, { signal })), {
    enabled,
  })

  const results = [catalog.data, roles.data, units.data]
  const unitList = units.data?.value
  const tree = useMemo(() => unitTree(unitList ?? []), [unitList])
  const allFailed = results.every((r) => r?.reason)

  return {
    catalog: catalog.data?.value ?? [],
    roles: roles.data?.value ?? [],
    units: tree,
    loading: catalog.loading || roles.loading || units.loading,
    error: allFailed ? catalog.data.reason : null,
    reload: () => Promise.all([catalog.reload(), roles.reload(), units.reload()]),
  }
}
