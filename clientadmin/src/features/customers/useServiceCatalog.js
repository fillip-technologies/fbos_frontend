import { useCallback, useEffect, useState } from 'react'
import { categoriesApi, providersApi } from '@/features/customers/api.js'

// Providers and categories for service forms and filters, for one organization.
export default function useServiceCatalog(orgId) {
  const [state, setState] = useState({ providers: [], categories: [], loading: true, error: null })

  const load = useCallback(() => {
    if (!orgId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.all([providersApi.listAll(orgId), categoriesApi.list(orgId)])
      .then(([providers, categories]) => setState({ providers, categories, loading: false, error: null }))
      .catch((error) => setState({ providers: [], categories: [], loading: false, error }))
  }, [orgId])

  useEffect(load, [load])
  return { ...state, reload: load }
}
