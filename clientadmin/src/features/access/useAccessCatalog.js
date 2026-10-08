import { useMemo } from 'react'
import { accessApi } from '@/features/access/api.js'
import { unitTree } from '@/features/access/permissions.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useLookup } from '@/shared/api/useQuery.js'

// Loads what the access editor needs for one organization: the permission catalog,
// its roles (presets) and its active org units (as an indented tree).
//
// Each list needs its own read permission (role read for the first two, org-unit read for
// units). A list the signed-in user may not read is not requested at all (a refused request
// would only add an expected 403 to the console) and comes back empty. A list that is
// requested and still fails also comes back empty; only when every requested list fails is
// `error` set. The lists are cached per organization and shared by every page using them.
const settled = (promise) => promise.then((value) => ({ value }), (reason) => ({ reason }))

export default function useAccessCatalog(orgId) {
  const { user } = useAuth()
  const canReadRoles = Boolean(orgId) && hasAccess(user, ACCESS.roles)
  const canReadUnits = Boolean(orgId) && hasAccess(user, ACCESS.orgUnits)
  const catalog = useLookup(['permissions', orgId], ({ signal }) => settled(accessApi.permissions(orgId, { signal })), {
    enabled: canReadRoles,
  })
  const roles = useLookup(['roles', orgId], ({ signal }) => settled(accessApi.roles(orgId, { signal })), { enabled: canReadRoles })
  const units = useLookup(['org-units', orgId, 'active'], ({ signal }) => settled(accessApi.orgUnits(orgId, { signal })), {
    enabled: canReadUnits,
  })

  const requested = [canReadRoles && catalog, canReadRoles && roles, canReadUnits && units].filter(Boolean)
  const unitList = units.data?.value
  const tree = useMemo(() => unitTree(unitList ?? []), [unitList])
  const allFailed = requested.length > 0 && requested.every((query) => query.data?.reason)

  return {
    catalog: catalog.data?.value ?? [],
    roles: roles.data?.value ?? [],
    units: tree,
    loading: requested.some((query) => query.loading),
    error: allFailed ? requested[0].data.reason : null,
    reload: () => Promise.all(requested.map((query) => query.reload())),
  }
}
