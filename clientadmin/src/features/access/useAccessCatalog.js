import { useCallback, useEffect, useState } from 'react'
import { accessApi } from '@/features/access/api.js'
import { unitTree } from '@/features/access/permissions.js'

// Loads what the access editor needs for one organization: the permission catalog,
// its roles (presets) and its active org units (as an indented tree).
//
// Each list needs its own read permission (role read for the first two, org-unit read for
// units). Access is per user, so one may be refused while the others load: a refused
// list comes back empty instead of failing the whole page. Only when all three fail is
// `error` set.
export default function useAccessCatalog(orgId) {
  const [state, setState] = useState({ catalog: [], roles: [], units: [], loading: true, error: null })

  const load = useCallback(() => {
    if (!orgId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.allSettled([accessApi.permissions(orgId), accessApi.roles(orgId), accessApi.orgUnits(orgId)]).then(
      ([catalog, roles, units]) => {
        const value = (r) => (r.status === 'fulfilled' ? r.value : [])
        const allFailed = [catalog, roles, units].every((r) => r.status === 'rejected')
        setState({
          catalog: value(catalog),
          roles: value(roles),
          units: unitTree(value(units)),
          loading: false,
          error: allFailed ? catalog.reason : null,
        })
      }
    )
  }, [orgId])

  useEffect(load, [load])
  return { ...state, reload: load }
}
