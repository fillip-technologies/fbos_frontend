import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { organizationsApi } from '@/features/organizations/api.js'
import { isClientAdmin } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useQuery } from '@/shared/api/useQuery.js'

// The organization the users / roles / units / calendars screens work in. A client admin
// owns several organizations; the choice is remembered per browser and sent as
// X-Organization-Id. Everyone else always works in their own organization (the backend
// refuses X-Organization-Id for them, and only client admins may list organizations).
const STORAGE_KEY = 'fbos_clientadmin_active_org'
const ActiveOrgContext = createContext(null)

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function ActiveOrgProvider({ children }) {
  const { user } = useAuth()
  const multiOrg = isClientAdmin(user)
  const [activeId, setActiveId] = useState(readStored)
  const query = useQuery(['organizations', 'switcher'], ({ signal }) => organizationsApi.list({ limit: 100 }, { signal }), {
    enabled: multiOrg,
    staleTime: 5 * 60_000,
  })
  const orgs = useMemo(() => query.data?.data ?? [], [query.data])
  const loading = multiOrg && query.loading
  const { error, reload } = query

  // Fall back to the admin's own organization when nothing (or a stale id) is stored.
  const activeOrg = useMemo(() => {
    if (!orgs.length) return user?.organization ? { ...user.organization } : null
    return orgs.find((o) => o.id === activeId) || orgs.find((o) => o.id === user?.organization?.id) || orgs[0]
  }, [orgs, activeId, user])

  const selectOrg = useCallback((id) => {
    setActiveId(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* storage unavailable */
    }
  }, [])

  // While the list loads, activeOrg is the admin's own organization. If another one is
  // remembered, hold orgId back until the list confirms it, or every page would fetch
  // the own org's data first and then fetch again for the remembered one.
  const settling = loading && Boolean(activeId) && activeId !== user?.organization?.id
  const orgId = settling ? undefined : activeOrg?.id

  const value = useMemo(
    () => ({ orgs, activeOrg, orgId, selectOrg, loading, error, reload }),
    [orgs, activeOrg, orgId, selectOrg, loading, error, reload]
  )
  return <ActiveOrgContext.Provider value={value}>{children}</ActiveOrgContext.Provider>
}

export function useActiveOrg() {
  const ctx = useContext(ActiveOrgContext)
  if (!ctx) throw new Error('useActiveOrg must be used within ActiveOrgProvider')
  return ctx
}
