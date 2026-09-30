import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { authApi, setAccessToken, setUnauthorizedHandler, ApiError } from '../api/client.js'

const STORAGE_KEY = 'fbos_superadmin_session'
const AuthContext = createContext(null)

// Only the platform super-admin may use this console; the backend gates every
// /clients route behind require_platform_admin, so we mirror that check here.
function isPlatformAdmin(user) {
  return user?.user_type === 'platform_admin'
}

export class NotSuperAdminError extends Error {
  constructor() {
    super('This console is for platform super-admins only.')
    this.name = 'NotSuperAdminError'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate a persisted access token, then confirm it still resolves to an
  // active platform_admin via /me (source of truth), else drop it.
  useEffect(() => {
    let cancelled = false
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      setLoading(false)
      return
    }
    let token = null
    try {
      token = JSON.parse(raw).accessToken
    } catch {
      token = null
    }
    if (!token) {
      setLoading(false)
      return
    }
    setAccessToken(token)
    authApi
      .me()
      .then((me) => {
        if (cancelled) return
        if (isPlatformAdmin(me)) {
          setUser(me)
        } else {
          clearSession()
        }
      })
      .catch(() => {
        if (!cancelled) clearSession()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persist(token) {
    setAccessToken(token)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: token }))
  }

  function clearSession() {
    setAccessToken(null)
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  // When any authenticated call 401s (expired token), drop the session; the
  // route guard then redirects to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAccessToken(null)
      localStorage.removeItem(STORAGE_KEY)
      setUser(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // Establishes the session from a completed login token response, enforcing
  // the platform_admin requirement before we trust it.
  const establish = useCallback(async (tokenResponse) => {
    const token = tokenResponse.access_token
    if (!token) throw new ApiError('No access token returned', { status: 500 })
    persist(token)
    const me = tokenResponse.user ?? (await authApi.me())
    if (!isPlatformAdmin(me)) {
      clearSession()
      throw new NotSuperAdminError()
    }
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // best-effort; clear locally regardless
    }
    clearSession()
  }, [])

  const value = useMemo(
    () => ({ user, loading, establish, logout, isAuthenticated: !!user }),
    [user, loading, establish, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
