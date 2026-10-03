import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { authApi } from '@/features/auth/api.js'
import { ApiError } from '@/shared/api/http.js'
import { endSession, onSessionChange, startSession } from '@/shared/api/session.js'

// Older builds kept the access token here; it now lives in memory only.
const LEGACY_STORAGE_KEY = 'fbos_superadmin_session'
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

  // Restore the session from the HttpOnly refresh cookie (`fbos_prt`): reloads and new
  // tabs stay signed in for as long as the refresh token lives (rotated on every use).
  useEffect(() => {
    let cancelled = false
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      /* storage unavailable */
    }
    authApi
      .restore()
      .then(() => authApi.me())
      .then((me) => {
        if (cancelled) return
        if (isPlatformAdmin(me)) setUser(me)
        else endSession()
      })
      .catch(() => {
        /* no session (or it ended): show the sign-in page */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Follow the session manager: sign-outs (here, in another tab, or because the refresh
  // token died) and sign-ins done in another tab.
  useEffect(
    () =>
      onSessionChange((event) => {
        if (event.type === 'logout') setUser(null)
        else if (event.type === 'login' && event.remote) {
          authApi.me().then((me) => isPlatformAdmin(me) && setUser(me)).catch(() => {})
        }
      }),
    []
  )

  // Establishes the session from a completed login token response, enforcing
  // the platform_admin requirement before we trust it.
  const establish = useCallback(async (tokenResponse) => {
    if (!tokenResponse.access_token) throw new ApiError('No access token returned', { status: 500 })
    startSession(tokenResponse)
    const me = tokenResponse.user ?? (await authApi.me())
    if (!isPlatformAdmin(me)) {
      await authApi.logout()
      throw new NotSuperAdminError()
    }
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
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
