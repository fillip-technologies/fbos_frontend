import { useCallback, useEffect, useState } from 'react'
import { accessApi } from '@/features/access/api.js'
import { unitTree } from '@/features/access/permissions.js'

// Loads what the access editor needs for one organization: the permission catalog,
// its roles (presets) and its active org units (as an indented tree).
export default function useAccessCatalog(orgId) {
  const [state, setState] = useState({ catalog: [], roles: [], units: [], loading: true, error: null })

  const load = useCallback(() => {
    if (!orgId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.all([accessApi.permissions(orgId), accessApi.roles(orgId), accessApi.orgUnits(orgId)])
      .then(([catalog, roles, units]) =>
        setState({ catalog, roles, units: unitTree(units), loading: false, error: null })
      )
      .catch((error) => setState((s) => ({ ...s, loading: false, error })))
  }, [orgId])

  useEffect(load, [load])
  return { ...state, reload: load }
}
