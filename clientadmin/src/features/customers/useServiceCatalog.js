import { categoriesApi, providersApi } from '@/features/customers/api.js'
import { useLookup } from '@/shared/api/useQuery.js'

// Providers and categories for service forms and filters, for one organization. Cached per
// organization and shared by every page that uses them; `reload` after changing either.
export default function useServiceCatalog(orgId) {
  const enabled = Boolean(orgId)
  const providers = useLookup(['service-providers', orgId, 'all'], ({ signal }) => providersApi.listAll(orgId, { signal }), {
    enabled,
  })
  const categories = useLookup(['service-categories', orgId], ({ signal }) => categoriesApi.list(orgId, { signal }), {
    enabled,
  })
  return {
    providers: providers.data ?? [],
    categories: categories.data ?? [],
    loading: providers.loading || categories.loading,
    error: providers.error || categories.error,
    reload: () => Promise.all([providers.reload(), categories.reload()]),
  }
}
