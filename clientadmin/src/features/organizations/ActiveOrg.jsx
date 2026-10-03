import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { organizationsApi } from '@/features/organizations/api.js'
import { isClientAdmin } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'

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
  const [orgs, setOrgs] = useState([])
  const [activeId, setActiveId] = useState(readStored)
  const [loading, setLoading] = useState(multiOrg)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    if (!multiOrg) return
    setLoading(true)
    setError(null)
    organizationsApi
      .list({ limit: 100 })
      .then((res) => setOrgs(res.data))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [multiOrg])
  useEffect(load, [load])

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

  const value = useMemo(
    () => ({ orgs, activeOrg, orgId: activeOrg?.id, selectOrg, loading, error, reload: load }),
    [orgs, activeOrg, selectOrg, loading, error, load]
  )
  return <ActiveOrgContext.Provider value={value}>{children}</ActiveOrgContext.Provider>
}

export function useActiveOrg() {
  const ctx = useContext(ActiveOrgContext)
  if (!ctx) throw new Error('useActiveOrg must be used within ActiveOrgProvider')
  return ctx
}
